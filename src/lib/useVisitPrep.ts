import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

export const PREP_ITEM_IDS = [
  'id',
  'proofOfIncome',
  'proofOfAddress',
  'medications',
  'allergies',
  'payment',
] as const;

export type PrepItemId = typeof PREP_ITEM_IDS[number];

interface PrepData {
  items: Record<string, boolean>;
  updatedAt: number;
}

const initialItems = (): Record<string, boolean> =>
  Object.fromEntries(PREP_ITEM_IDS.map((k) => [k, false]));

function storageKey(clinicId?: string) {
  return `visitPrep:${clinicId ?? 'general'}`;
}

export function useVisitPrep(clinicId?: string) {
  const [items, setItems] = useState<Record<string, boolean>>(initialItems);

  useEffect(() => {
    setItems(initialItems());
    AsyncStorage.getItem(storageKey(clinicId)).then((raw) => {
      if (!raw) return;
      try {
        const data: PrepData = JSON.parse(raw);
        if (data?.items) setItems((prev) => ({ ...prev, ...data.items }));
      } catch {}
    });
  }, [clinicId]);

  const persist = useCallback(
    (next: Record<string, boolean>) => {
      const data: PrepData = { items: next, updatedAt: Date.now() };
      AsyncStorage.setItem(storageKey(clinicId), JSON.stringify(data));
    },
    [clinicId],
  );

  const toggle = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    const next = initialItems();
    setItems(next);
    persist(next);
  }, [persist]);

  const progress = PREP_ITEM_IDS.filter((id) => items[id]).length;

  return { items, toggle, reset, progress };
}
