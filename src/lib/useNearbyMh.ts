import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { getDb } from './database';
import { findMhNear } from './mentalHealthSearch';
import type { MhWithDistance } from '../types/mentalHealth';

export type NearbyMhStatus = 'loading' | 'ready' | 'no-permission' | 'error';

export function useNearbyMh(radiusMiles = 25, slidingFeeOnly = false) {
  const [facilities, setFacilities] = useState<MhWithDistance[]>([]);
  const [status, setStatus] = useState<NearbyMhStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setStatus('loading');
    setFacilities([]);
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
        const results = await findMhNear(
          db,
          loc.coords.latitude,
          loc.coords.longitude,
          radiusMiles,
          50,
          slidingFeeOnly,
        );
        if (!cancelled) {
          setFacilities(results);
          setStatus('ready');
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [radiusMiles, slidingFeeOnly, attempt]);

  return { facilities, status, retry };
}
