import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export type Visit = {
  id: string;
  clinic_id: string | null;
  clinic_name: string | null;
  visit_date: string;
  reason: string | null;
  note: string | null;
  created_at: string;
};

export type AddVisitPayload = {
  clinic_id?: string | null;
  clinic_name?: string | null;
  visit_date: string; // YYYY-MM-DD
  reason?: string | null;
  note?: string | null;
};

export function useVisits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .order('visit_date', { ascending: false });
    if (!error && data) setVisits(data as Visit[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addVisit = useCallback(async (payload: AddVisitPayload): Promise<{ ok: boolean; error?: string }> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return { ok: false, error: 'Not logged in' };

    const row = {
      user_id: uid,
      clinic_id: payload.clinic_id ?? null,
      clinic_name: payload.clinic_name ?? null,
      visit_date: payload.visit_date,
      reason: payload.reason ?? null,
      note: payload.note ?? null,
    };

    const { data, error } = await supabase.from('visits').insert(row).select().single();
    if (error) {
      console.error('VISIT insert error:', error.message, error.details, error.hint);
      return { ok: false, error: error.message };
    }
    if (data) setVisits(prev => [data as Visit, ...prev]);
    return { ok: true };
  }, []);

  const deleteVisit = useCallback(async (id: string) => {
    setVisits(prev => prev.filter(v => v.id !== id));
    const { error } = await supabase.from('visits').delete().eq('id', id);
    if (error) console.error('VISIT delete error:', error.message, error.details, error.hint);
  }, []);

  return { visits, loading, reload: load, addVisit, deleteVisit };
}
