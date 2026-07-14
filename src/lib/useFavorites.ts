import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export type Favorite = {
  id: string;
  clinic_id: string;
  clinic_name: string;
  clinic_address: string | null;
  source: 'clinic' | 'mh';
  created_at: string;
};

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setFavorites(data as Favorite[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isFavorite = useCallback(
    (clinicId: string, source: 'clinic' | 'mh' = 'clinic') =>
      favorites.some(f => f.clinic_id === clinicId && f.source === source),
    [favorites],
  );

  const toggleFavorite = useCallback(async (clinic: {
    clinic_id: string;
    clinic_name: string;
    clinic_address?: string | null;
    source: 'clinic' | 'mh';
  }) => {
    const existing = favorites.find(
      f => f.clinic_id === clinic.clinic_id && f.source === clinic.source,
    );
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;

    if (existing) {
      setFavorites(prev =>
        prev.filter(f => !(f.clinic_id === clinic.clinic_id && f.source === clinic.source)),
      );
      await supabase.from('favorites').delete().eq('id', existing.id);
    } else {
      const row = {
        user_id: uid,
        clinic_id: clinic.clinic_id,
        clinic_name: clinic.clinic_name,
        clinic_address: clinic.clinic_address ?? null,
        source: clinic.source,
      };
      const { data, error } = await supabase
        .from('favorites').insert(row).select().single();
      if (!error && data) {
        setFavorites(prev => [data as Favorite, ...prev]);
      }
    }
  }, [favorites]);

  return { favorites, loading, isFavorite, toggleFavorite, reload: load };
}
