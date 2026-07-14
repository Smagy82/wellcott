import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@wellcott:saved_v2';

export type SavedClinic = {
  id: string;
  source: 'clinic' | 'mh';
  name: string;
  address: string | null;
  savedAt: string;
};

type Store = Record<string, SavedClinic>; // key: `${source}:${id}`
type Listener = (ids: Set<string>) => void;
type VoidListener = () => void;

let cache: Store | null = null;
const listeners = new Set<Listener>();
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
    cache = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

async function persist(store: Store): Promise<void> {
  cache = store;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch { /* ignore */ }
  notify();
}

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
    return false;
  }
  store[storeKey] = {
    id,
    source,
    name: meta?.name ?? '',
    address: meta?.address ?? null,
    savedAt: new Date().toISOString(),
  };
  await persist(store);
  return true;
}

export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  if (cache !== null) cb(new Set(Object.keys(cache)));
  return () => { listeners.delete(cb); };
}

// Void-listener subscribe for useSyncExternalStore per-card hooks
export function subscribeAny(cb: VoidListener): () => void {
  voidListeners.add(cb);
  return () => { voidListeners.delete(cb); };
}

// Optimistic toggle: updates cache synchronously, writes to storage fire-and-forget.
// Safe to call without await — UI snaps instantly.
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
  if (storeKey in store) {
    delete store[storeKey];
  } else {
    store[storeKey] = {
      id,
      source,
      name: meta?.name ?? '',
      address: meta?.address ?? null,
      savedAt: new Date().toISOString(),
    };
  }
  cache = store;
  notify();
  AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => {});
}
