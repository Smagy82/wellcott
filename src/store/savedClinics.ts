import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const KEY    = '@wellcott:saved_v2';
const KEY_V1 = '@wellcott:saved_v1';

export type SavedClinic = {
  id: string;
  source: 'clinic' | 'mh';
  name: string;
  address: string | null;
  note?: string;
  savedAt: string;
};

type Store = Record<string, SavedClinic>; // key: `${source}:${id}`
type Listener    = (ids: Set<string>) => void;
type VoidListener = () => void;

let cache: Store | null = null;
const listeners     = new Set<Listener>();
const voidListeners = new Set<VoidListener>();

function notify(): void {
  if (cache === null) return;
  const ids = new Set(Object.keys(cache));
  listeners.forEach((cb) => cb(ids));
  voidListeners.forEach((cb) => cb());
}

async function load(): Promise<Store> {
  if (cache !== null) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as Store;
    } else {
      // Migrate v1 → v2: v1 had no `source` field, all items were clinics
      const v1raw = await AsyncStorage.getItem(KEY_V1);
      if (v1raw) {
        const v1 = JSON.parse(v1raw) as Record<string, {
          id: string; name: string; address: string | null; savedAt: string;
        }>;
        cache = {};
        for (const item of Object.values(v1)) {
          cache[`clinic:${item.id}`] = { ...item, source: 'clinic' };
        }
        await AsyncStorage.setItem(KEY, JSON.stringify(cache));
        await AsyncStorage.removeItem(KEY_V1);
      } else {
        cache = {};
      }
    }
  } catch {
    cache = {};
  }
  return cache!;
}

async function persist(store: Store): Promise<void> {
  cache = store;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ }
  notify();
}

// ── Supabase mirror — fire-and-forget, errors are silent ─────────────────────

async function mirrorUpsert(item: SavedClinic): Promise<void> {
  const { data: ud } = await supabase.auth.getUser();
  const uid = ud.user?.id;
  if (!uid) return;
  await supabase.from('favorites').upsert({
    user_id:        uid,
    clinic_id:      item.id,
    clinic_name:    item.name,
    clinic_address: item.address ?? null,
    source:         item.source,
    note:           item.note ?? null,
  }, { onConflict: 'user_id,source,clinic_id' });
}

async function mirrorDelete(id: string, source: 'clinic' | 'mh'): Promise<void> {
  const { data: ud } = await supabase.auth.getUser();
  const uid = ud.user?.id;
  if (!uid) return;
  await supabase.from('favorites').delete()
    .eq('user_id', uid).eq('clinic_id', id).eq('source', source);
}

async function mirrorNoteUpdate(id: string, source: 'clinic' | 'mh', note: string | null): Promise<void> {
  const { data: ud } = await supabase.auth.getUser();
  const uid = ud.user?.id;
  if (!uid) return;
  await supabase.from('favorites').update({ note })
    .eq('user_id', uid).eq('clinic_id', id).eq('source', source);
}

/**
 * On login: fetch Supabase favorites and merge into AsyncStorage.
 * Local wins on key conflict — no data is overwritten, only new items added.
 * Call this from _layout.tsx on SIGNED_IN auth event.
 */
export async function mergeFromSupabase(): Promise<void> {
  const { data: ud } = await supabase.auth.getUser();
  if (!ud.user?.id) return;

  const { data, error } = await supabase.from('favorites').select('*');
  if (error || !data || data.length === 0) return;

  const store = { ...(await load()) };
  let changed = false;

  for (const row of data as Array<{
    clinic_id: string; clinic_name: string; clinic_address: string | null;
    source: 'clinic' | 'mh'; note: string | null; created_at: string;
  }>) {
    const key = `${row.source}:${row.clinic_id}`;
    if (!(key in store)) {
      store[key] = {
        id:      row.clinic_id,
        source:  row.source,
        name:    row.clinic_name,
        address: row.clinic_address,
        note:    row.note ?? undefined,
        savedAt: row.created_at,
      };
      changed = true;
    }
  }

  if (changed) await persist(store);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function init(): Promise<void> {
  await load();
  notify();
}

export async function getSaved(): Promise<SavedClinic[]> {
  const store = await load();
  return Object.values(store).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function getSavedIds(): Set<string> {
  return cache ? new Set(Object.keys(cache)) : new Set();
}

export function isSaved(id: string, source: 'clinic' | 'mh'): boolean {
  return cache ? `${source}:${id}` in cache : false;
}

export async function toggleSaved(
  id: string,
  source: 'clinic' | 'mh',
  meta?: { name?: string; address?: string | null },
): Promise<boolean> {
  const storeKey = `${source}:${id}`;
  const store = { ...(await load()) };
  if (storeKey in store) {
    delete store[storeKey];
    await persist(store);
    mirrorDelete(id, source).catch(() => {});
    return false;
  }
  const item: SavedClinic = {
    id, source,
    name:    meta?.name ?? '',
    address: meta?.address ?? null,
    savedAt: new Date().toISOString(),
  };
  store[storeKey] = item;
  await persist(store);
  mirrorUpsert(item).catch(() => {});
  return true;
}

export async function updateNote(
  id: string,
  source: 'clinic' | 'mh',
  note: string | null,
): Promise<void> {
  const storeKey = `${source}:${id}`;
  const store = { ...(await load()) };
  if (!(storeKey in store)) return;
  store[storeKey] = { ...store[storeKey], note: note ?? undefined };
  await persist(store);
  mirrorNoteUpdate(id, source, note).catch(() => {});
}

/** True after the first load() has completed. Cache is guaranteed non-null. */
export function isStoreReady(): boolean { return cache !== null; }

/** Synchronous read from cache — returns [] if not yet loaded. */
export function getSavedSync(): SavedClinic[] {
  if (!cache) return [];
  return Object.values(cache).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  if (cache !== null) cb(new Set(Object.keys(cache)));
  return () => { listeners.delete(cb); };
}

export function subscribeAny(cb: VoidListener): () => void {
  voidListeners.add(cb);
  return () => { voidListeners.delete(cb); };
}

// Optimistic toggle: updates cache synchronously, writes fire-and-forget.
export function toggleSavedSync(
  id: string,
  source: 'clinic' | 'mh',
  meta?: { name?: string; address?: string | null },
): void {
  const storeKey = `${source}:${id}`;
  if (cache === null) {
    toggleSaved(id, source, meta).catch(() => {});
    return;
  }
  const store = { ...cache };
  let added = false;
  if (storeKey in store) {
    delete store[storeKey];
  } else {
    store[storeKey] = {
      id, source,
      name:    meta?.name ?? '',
      address: meta?.address ?? null,
      savedAt: new Date().toISOString(),
    };
    added = true;
  }
  cache = store;
  notify();
  AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => {});
  if (added) {
    mirrorUpsert(store[storeKey]).catch(() => {});
  } else {
    mirrorDelete(id, source).catch(() => {});
  }
}
