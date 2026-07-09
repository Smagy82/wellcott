import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { getDb } from './database';
import { findClinicsNear } from './clinicSearch';
import type { ClinicWithDistance } from '../types/clinic';

export type NearbyStatus = 'loading' | 'ready' | 'no-permission' | 'error';

export function useNearbyClinics(radiusMiles = 25) {
  const [clinics, setClinics] = useState<ClinicWithDistance[]>([]);
  const [status, setStatus] = useState<NearbyStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setStatus('loading');
    setClinics([]);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm !== 'granted') {
          if (!cancelled) setStatus('no-permission');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const db = await getDb();
        const results = await findClinicsNear(
          db,
          loc.coords.latitude,
          loc.coords.longitude,
          radiusMiles,
        );
        if (!cancelled) {
          setClinics(results);
          setStatus('ready');
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [radiusMiles, attempt]);

  return { clinics, status, retry };
}
