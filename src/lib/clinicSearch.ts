// src/lib/clinicSearch.ts — офлайн гео-поиск клиник по бандл-базе (expo-sqlite)

import type * as SQLite from 'expo-sqlite';
import { rowToClinic, type ClinicRow, type ClinicWithDistance } from '../types/clinic';

const EARTH_RADIUS_MI = 3958.8;
const MI_PER_DEG_LAT = 69; // ~69 миль на градус широты

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Клиники рядом. Сначала грубый bounding-box в SQL (быстро, по индексу),
 * потом точная дистанция haversine + сортировка. Для ~10–15k точек — мгновенно.
 */
export async function findClinicsNear(
  db: SQLite.SQLiteDatabase,
  lat: number,
  lng: number,
  radiusMiles = 25,
  limit = 50,
): Promise<ClinicWithDistance[]> {
  const latDelta = radiusMiles / MI_PER_DEG_LAT;
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
  const lngDelta = radiusMiles / (MI_PER_DEG_LAT * cosLat);

  const rows = await db.getAllAsync<ClinicRow>(
    `SELECT * FROM clinics
      WHERE latitude  BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?`,
    [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta],
  );

  return rows
    .map((r) => ({
      ...rowToClinic(r),
      distanceMiles: haversineMiles(lat, lng, r.latitude, r.longitude),
    }))
    .filter((c) => c.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit);
}

/** Одна клиника по первичному ключу. */
export async function getClinicById(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<ReturnType<typeof rowToClinic> | null> {
  const row = await db.getFirstAsync<ClinicRow>(
    'SELECT * FROM clinics WHERE id = ?',
    [id],
  );
  return row ? rowToClinic(row) : null;
}

/** Минимальный набор полей для пинов карты. */
export interface MapClinic {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
}

/**
 * Все клиники — только поля нужные карте (без hours_json и тяжёлых колонок).
 * ~10k строк, ~30-50ms на устройстве. Не вызывать синхронно в рендере.
 */
export async function findAllClinicsForMap(
  db: SQLite.SQLiteDatabase,
): Promise<MapClinic[]> {
  return db.getAllAsync<MapClinic>(
    'SELECT id, name, address, city, latitude, longitude FROM clinics',
  );
}

/**
 * Клиники в видимой области карты (bounding-box). LIMIT жёсткий.
 * Использует индекс по (latitude, longitude) — запрос быстрый даже при 10k записей.
 */
export async function findClinicsInBounds(
  db: SQLite.SQLiteDatabase,
  minLat: number, maxLat: number,
  minLng: number, maxLng: number,
  limit = 300,
): Promise<MapClinic[]> {
  return db.getAllAsync<MapClinic>(
    `SELECT id, name, address, city, latitude, longitude FROM clinics
      WHERE latitude  BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
      LIMIT ?`,
    [minLat, maxLat, minLng, maxLng, limit],
  );
}

/** Подсказки городов по префиксу. Возвращает [] если query короче 2 символов. */
export interface CitySuggestion {
  city: string;
  state: string;
}

export async function suggestCities(
  db: SQLite.SQLiteDatabase,
  query: string,
  limit = 6,
): Promise<CitySuggestion[]> {
  if (query.trim().length < 2) return [];
  return db.getAllAsync<CitySuggestion>(
    `SELECT DISTINCT city, state FROM clinics
     WHERE LOWER(city) LIKE LOWER(?) || '%'
     ORDER BY city LIMIT ?`,
    [query.trim(), limit],
  );
}

/** Поиск по всей базе (имя + город), без привязки к радиусу. Регистр игнорируется. */
export async function searchClinicsByText(
  db: SQLite.SQLiteDatabase,
  query: string,
  limit = 100,
): Promise<ClinicWithDistance[]> {
  const q = `%${query.trim().toLowerCase()}%`;
  const rows = await db.getAllAsync<ClinicRow>(
    `SELECT * FROM clinics
      WHERE LOWER(name) LIKE ? OR LOWER(city) LIKE ?
      ORDER BY name
      LIMIT ?`,
    [q, q, limit],
  );
  return rows.map((r) => ({ ...rowToClinic(r), distanceMiles: NaN }));
}
