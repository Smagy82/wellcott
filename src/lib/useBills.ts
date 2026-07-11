import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export type Bill = {
  id: string;
  visit_id: string | null;
  amount: number;
  category: string;
  bill_date: string;
  merchant: string | null;
  photo_path: string | null;
  note: string | null;
  created_at: string;
};

export type AddBillPayload = {
  visit_id?: string | null;
  amount: number;
  category: string;
  bill_date: string; // YYYY-MM-DD
  merchant?: string | null;
  photo_path?: string | null;
  note?: string | null;
};

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

    const row = {
      user_id: uid,
      visit_id: payload.visit_id ?? null,
      amount: payload.amount,
      category: payload.category,
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

  const deleteBill = useCallback(async (id: string) => {
    setBills(prev => prev.filter(b => b.id !== id));
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) console.error('BILL delete error:', error.message, error.details, error.hint);
  }, []);

  return { bills, loading, reload: load, addBill, deleteBill, totalSpent };
}
