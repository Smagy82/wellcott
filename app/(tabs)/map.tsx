import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../src/components/Text';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import MapView from 'react-native-map-clustering';
import { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNearbyClinics } from '../../src/lib/useNearbyClinics';
import { findAllClinicsForMap, type MapClinic } from '../../src/lib/clinicSearch';
import { getDb } from '../../src/lib/database';
import { theme } from '../../src/theme';

const { colors, radius, font, shadow } = theme;

const US_REGION = {
  latitude: 39.8,
  longitude: -98.6,
  latitudeDelta: 30,
  longitudeDelta: 40,
};

export default function MapScreen() {
  const { t } = useTranslation();
  const { clinics: nearbyClinics, status, retry } = useNearbyClinics(25);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  const [allClinics, setAllClinics] = useState<MapClinic[]>([]);

  useEffect(() => {
    if (status !== 'ready') return;
    let cancelled = false;
    getDb()
      .then((db) => findAllClinicsForMap(db))
      .then((rows) => { if (!cancelled) setAllClinics(rows); })
      .catch((e) => console.error('Map: load all clinics failed', e));
    return () => { cancelled = true; };
  }, [status]);

  const requestLocation = async () => {
    await Location.requestForegroundPermissionsAsync();
    retry();
  };

  // Центрировать на текущей позиции. Разрешение уже выдано (status==='ready'),
  // повторного диалога не будет.
  const goToMyLocation = async () => {
    if (!mapRef.current) return;
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      mapRef.current.animateToRegion(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        500,
      );
    } catch {
      // геолокация недоступна — молча игнорируем
    }
  };

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.statusText}>{t('map.findingClinics')}</Text>
      </View>
    );
  }

  if (status === 'no-permission') {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>{t('common.locationOff')}</Text>
        <Text style={styles.statusText}>{t('map.locationOffSub')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestLocation}>
          <Text style={styles.primaryBtnText}>{t('common.enableLocation')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>{t('common.somethingWentWrong')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={retry}>
          <Text style={styles.primaryBtnText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const first = nearbyClinics[0];
  const initialRegion = first
    ? {
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      }
    : US_REGION;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        clusterColor={colors.primary}
        clusterTextColor="#ffffff"
        radius={50}
        animationEnabled={false}
      >
        {allClinics.map((c) => (
          <Marker
            key={c.id}
            coordinate={{ latitude: c.latitude, longitude: c.longitude }}
            title={c.name}
            description={`${c.address}, ${c.city}`}
            onCalloutPress={() => router.push(`/clinic/${encodeURIComponent(c.id)}`)}
            pinColor={colors.primary}
            tracksViewChanges={false}
          />
        ))}
      </MapView>

      <TouchableOpacity
        style={styles.locateBtn}
        onPress={goToMyLocation}
        activeOpacity={0.85}
      >
        <Ionicons name="navigate" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  locateBtn: {
    position: 'absolute',
    bottom: 96,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.bg,
  },
  permTitle: { fontFamily: font.bold, fontSize: 18, color: colors.text, marginBottom: 6 },
  statusText: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 18 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  primaryBtnText: { fontFamily: font.semibold, color: '#fff', fontSize: 14 },
});
