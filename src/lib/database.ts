import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openBundledDb(): Promise<SQLite.SQLiteDatabase> {
  const name = 'clinics-v2.db';
  const dir = `${FileSystem.documentDirectory}SQLite`;
  const path = `${dir}/${name}`;

  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const asset = Asset.fromModule(require('../../assets/clinics-v2.db'));
    await asset.downloadAsync();
    await FileSystem.copyAsync({ from: asset.localUri!, to: path });
  }

  return SQLite.openDatabaseAsync(name);
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = openBundledDb();
  return dbPromise;
}
