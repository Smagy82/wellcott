import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export type Bill = {
  id: string;
  visit_id: string | null;
  amount: number;
  category: string; // stored as JSON array string '["visit","labs"]' or legacy plain 'visit'
  bill_date: string;
  merchant: string | null;
  photo_path: string | null;
  note: string | null;
  created_at: string;
};

export type AddBillPayload = {
  visit_id?: string | null;
  amount: number;
  categories: string[]; // always an array; serialized to JSON on insert
  bill_date: string; // YYYY-MM-DD
  merchant?: string | null;
  photo_path?: string | null;
  note?: string | null;
};

export type UpdateBillPayload = AddBillPayload;

export async function fetchBillById(id: string): Promise<Bill | null> {
  const { data, error } = await supabase.from('bills').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as Bill;
}

/** Parse the stored category field into an array. Handles both legacy plain strings and JSON arrays. */
export function parseCategories(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return [raw]; // legacy format: plain string like 'visit'
  }
}

export function useBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .order('bill_date', { ascending: false });
    if (!error && data) setBills(data as Bill[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalSpent = bills.reduce((sum, b) => sum + Number(b.amount), 0);

  const addBill = useCallback(async (payload: AddBillPayload): Promise<{ ok: boolean; error?: string }> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return { ok: false, error: 'Not logged in' };

    const cats = payload.categories.length > 0 ? payload.categories : ['other'];
    const row = {
      user_id: uid,
      visit_id: payload.visit_id ?? null,
      amount: payload.amount,
      category: JSON.stringify(cats),
      bill_date: payload.bill_date,
      merchant: payload.merchant ?? null,
      photo_path: payload.photo_path ?? null,
      note: payload.note ?? null,
    };

    const { data, error } = await supabase.from('bills').insert(row).select().single();
    if (error) {
      console.error('BILL insert error:', error.message, error.details, error.hint);
      return { ok: false, error: error.message };
    }
    if (data) setBills(prev => [data as Bill, ...prev]);
    return { ok: true };
  }, []);

  const updateBill = useCallback(async (id: string, payload: UpdateBillPayload): Promise<{ ok: boolean; error?: string }> => {
    const cats = payload.categories.length > 0 ? payload.categories : ['other'];
    const row = {
      amount: payload.amount,
      category: JSON.stringify(cats),
      bill_date: payload.bill_date,
      merchant: payload.merchant ?? null,
      photo_path: payload.photo_path ?? null,
      note: payload.note ?? null,
      visit_id: payload.visit_id ?? null,
    };
    const { data, error } = await supabase.from('bills').update(row).eq('id', id).select().single();
    if (error) {
      console.error('BILL update error:', error.message, error.details, error.hint);
      return { ok: false, error: error.message };
    }
    if (data) setBills(prev => prev.map(b => b.id === id ? (data as Bill) : b));
    return { ok: true };
  }, []);

  const deleteBill = useCallback(async (id: string) => {
    setBills(prev => prev.filter(b => b.id !== id));
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) console.error('BILL delete error:', error.message, error.details, error.hint);
  }, []);

  return { bills, loading, reload: load, addBill, updateBill, deleteBill, totalSpent };
}
