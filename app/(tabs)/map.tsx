import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import MapView from 'react-native-map-clustering';
import { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNearbyClinics } from '../../src/lib/useNearbyClinics';
import { findAllClinicsForMap, type MapClinic } from '../../src/lib/clinicSearch';
import { getDb } from '../../src/lib/database';
import { theme } from '../../src/theme';

const { colors, radius, font } = theme;

// Географический центр USA — фолбэк если ближайших нет
const US_REGION = {
  latitude: 39.8,
  longitude: -98.6,
  latitudeDelta: 30,
  longitudeDelta: 40,
};

export default function MapScreen() {
  const { t } = useTranslation();
  // useNearbyClinics нужен только для: статуса разрешения и initialRegion (центр на юзере)
  const { clinics: nearbyClinics, status, retry } = useNearbyClinics(25);
  const router = useRouter();

  const [allClinics, setAllClinics] = useState<MapClinic[]>([]);

  // Загружаем все клиники ПОСЛЕ того как карта смонтировалась (status ready = геолокация есть).
  // useEffect выполняется после рендера → карта видна, затем через ~50ms появляются маркеры.
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
    <MapView
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
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
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
