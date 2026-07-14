// src/lib/mentalHealthSearch.ts — офлайн поиск MH-объектов по таблице mh_facilities

import type * as SQLite from 'expo-sqlite';
import { rowToMh, type MhRow, type MhWithDistance, type MhFacility } from '../types/mentalHealth';

const EARTH_RADIUS_MI = 3958.8;
const MI_PER_DEG_LAT  = 69;

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
 * MH-объекты рядом. Bounding-box в SQL, точная дистанция в JS.
 * Записи без координат (1 040 шт) в результат НЕ попадают — намеренно.
 */
export async function findMhNear(
  db: SQLite.SQLiteDatabase,
  lat: number,
  lng: number,
  radiusMiles = 25,
  limit = 50,
  slidingFeeOnly = false,
): Promise<MhWithDistance[]> {
  const latDelta = radiusMiles / MI_PER_DEG_LAT;
  const cosLat   = Math.cos((lat * Math.PI) / 180) || 1e-6;
  const lngDelta = radiusMiles / (MI_PER_DEG_LAT * cosLat);

  const feeClause = slidingFeeOnly ? 'AND has_sliding_fee = 1' : '';

  const rows = await db.getAllAsync<MhRow>(
    `SELECT * FROM mh_facilities
      WHERE latitude  IS NOT NULL
        AND longitude IS NOT NULL
        AND latitude  BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
        ${feeClause}`,
    [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta],
  );

  return rows
    .map((r) => ({
      ...rowToMh(r),
      distanceMiles: haversineMiles(lat, lng, r.latitude!, r.longitude!),
    }))
    .filter((f) => f.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit);
}

/**
 * Текстовый поиск по всей таблице. Включает записи БЕЗ координат —
 * они найдутся по названию/городу, даже если не попадут на карту.
 */
export async function searchMhByText(
  db: SQLite.SQLiteDatabase,
  query: string,
  limit = 100,
  slidingFeeOnly = false,
): Promise<MhWithDistance[]> {
  const q = `%${query.trim().toLowerCase()}%`;
  const feeClause = slidingFeeOnly ? 'AND has_sliding_fee = 1' : '';

  const rows = await db.getAllAsync<MhRow>(
    `SELECT * FROM mh_facilities
      WHERE (LOWER(name1) LIKE ? OR LOWER(name2) LIKE ? OR LOWER(city) LIKE ?)
        ${feeClause}
      ORDER BY name1
      LIMIT ?`,
    [q, q, q, limit],
  );

  return rows.map((r) => ({ ...rowToMh(r), distanceMiles: NaN }));
}

/** Минимальный набор полей для пинов карты. Только объекты С координатами. */
export interface MapMhFacility {
  id: string;
  name1: string;
  city: string;
  latitude: number;
  longitude: number;
  hasSlidingFee: boolean;
}

/**
 * Все MH-объекты с координатами — только поля карты.
 * ~11k строк. Не вызывать синхронно в рендере — только в useEffect.
 */
export async function findAllMhForMap(
  db: SQLite.SQLiteDatabase,
): Promise<MapMhFacility[]> {
  const rows = await db.getAllAsync<{
    id: string; name1: string; city: string;
    latitude: number; longitude: number; has_sliding_fee: 0 | 1;
  }>(
    `SELECT id, name1, city, latitude, longitude, has_sliding_fee
       FROM mh_facilities
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL`,
  );
  return rows.map((r) => ({
    id:           r.id,
    name1:        r.name1,
    city:         r.city,
    latitude:     r.latitude,
    longitude:    r.longitude,
    hasSlidingFee: r.has_sliding_fee === 1,
  }));
}

/** Полная запись по id. */
export async function getMhById(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<MhFacility | null> {
  const row = await db.getFirstAsync<MhRow>(
    'SELECT * FROM mh_facilities WHERE id = ?',
    [id],
  );
  return row ? rowToMh(row) : null;
}
