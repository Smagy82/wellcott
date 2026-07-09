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

/** Поиск по названию/городу (для строки поиска). */
export async function searchClinicsByText(
  db: SQLite.SQLiteDatabase,
  query: string,
  limit = 50,
): Promise<ClinicWithDistance[]> {
  const q = `%${query.trim()}%`;
  const rows = await db.getAllAsync<ClinicRow>(
    `SELECT * FROM clinics
      WHERE name LIKE ? OR city LIKE ?
      LIMIT ?`,
    [q, q, limit],
  );
  return rows.map((r) => ({ ...rowToClinic(r), distanceMiles: NaN }));
}
