import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@wellcott:saved_v1';

export type SavedClinic = {
  id: string;
  name: string;
  address: string | null;
  savedAt: string;
};

type Store = Record<string, SavedClinic>;
type Listener = (ids: Set<string>) => void;

let cache: Store | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  if (cache === null) return;
  const ids = new Set(Object.keys(cache));
  listeners.forEach((cb) => cb(ids));
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

export function isSaved(id: string): boolean {
  return cache ? id in cache : false;
}

export async function toggleSaved(
  id: string,
  meta?: { name?: string; address?: string | null },
): Promise<boolean> {
  const store = { ...(await load()) };
  if (id in store) {
    delete store[id];
    await persist(store);
    return false;
  }
  store[id] = {
    id,
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
