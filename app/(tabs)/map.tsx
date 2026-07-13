import { ActivityIndicator, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from '../../src/components/AppText';
import { ScreenTransition } from '../../src/components/ScreenTransition';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView from 'react-native-map-clustering';
import { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { NavigationArrow, Plus, Minus } from 'phosphor-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useNearbyClinics } from '../../src/lib/useNearbyClinics';
import { findAllClinicsForMap, type MapClinic } from '../../src/lib/clinicSearch';
import { getDb } from '../../src/lib/database';
import { theme } from '../../src/theme';

const { colors, radius, font } = theme;

const TAB_BAR_H = 58;
const TAB_BAR_BOTTOM_EXTRA = 10;

const US_REGION: Region = {
  latitude: 39.8,
  longitude: -98.6,
  latitudeDelta: 30,
  longitudeDelta: 40,
};

// Fixed city-level delta for "go to my location"
const CITY_DELTA = 0.05;
const DELTA_MIN  = 0.002;
const DELTA_MAX  = 60;

const SPRING_IN  = { mass: 0.6, damping: 10, stiffness: 200 } as const;
const SPRING_OUT = { mass: 1,   damping: 14, stiffness: 180 } as const;

// ── Map control button ───────────────────────────────────────────────────────
// Pressable is the outermost element so the map never steals the touch.
// Animated.View wraps only the icon for visual scale feedback.

function MapControlButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      style={styles.ctrlBtn}
      hitSlop={6}
      onPressIn={() => { scale.value = withSpring(0.9, SPRING_IN); }}
      onPressOut={() => { scale.value = withSpring(1, SPRING_OUT); }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Animated.View style={animStyle}>{children}</Animated.View>
    </Pressable>
  );
}

// ── MapScreen ────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const { t } = useTranslation();
  const { clinics: nearbyClinics, status, retry } = useNearbyClinics(25);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // Tracks the map's current region so zoom works from wherever the user is
  const regionRef = useRef<Region>(US_REGION);

  const [allClinics, setAllClinics] = useState<MapClinic[]>([]);

  // Sync regionRef to the first clinic location once data arrives
  useEffect(() => {
    if (nearbyClinics.length > 0) {
      const c = nearbyClinics[0];
      regionRef.current = {
        latitude: c.latitude,
        longitude: c.longitude,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      };
    }
  }, [nearbyClinics]);

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

  // Always flies to city-level zoom (0.05°). Requests permission first.
  const goToMyLocation = async () => {
    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    if (perm !== 'granted') return;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: CITY_DELTA,
          longitudeDelta: CITY_DELTA,
        },
        350,
      );
    } catch {
      // geolocation unavailable — silently ignore
    }
  };

  // Zoom in (factor < 1) / out (factor > 1) by scaling deltas
  const zoomBy = (factor: number) => {
    if (!mapRef.current) return;
    const r = regionRef.current;
    const clamp = (v: number) => Math.max(DELTA_MIN, Math.min(DELTA_MAX, v));
    mapRef.current.animateToRegion(
      {
        ...r,
        latitudeDelta:  clamp(r.latitudeDelta  * factor),
        longitudeDelta: clamp(r.longitudeDelta * factor),
      },
      250,
    );
  };

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText variant="body" style={styles.statusText}>{t('map.findingClinics')}</AppText>
      </View>
    );
  }

  if (status === 'no-permission') {
    return (
      <View style={styles.center}>
        <AppText style={styles.permTitle}>{t('common.locationOff')}</AppText>
        <AppText variant="body" style={styles.statusText}>{t('map.locationOffSub')}</AppText>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestLocation}>
          <AppText variant="button" style={styles.primaryBtnText}>{t('common.enableLocation')}</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <AppText style={styles.permTitle}>{t('common.somethingWentWrong')}</AppText>
        <TouchableOpacity style={styles.primaryBtn} onPress={retry}>
          <AppText variant="button" style={styles.primaryBtnText}>{t('common.retry')}</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  const first = nearbyClinics[0];
  const initialRegion: Region = first
    ? { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.3, longitudeDelta: 0.3 }
    : US_REGION;

  const stackBottom = Math.max(insets.bottom, 16) + TAB_BAR_BOTTOM_EXTRA + TAB_BAR_H + 12;

  return (
    <ScreenTransition>
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
        onRegionChangeComplete={(r) => { regionRef.current = r; }}
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

      {/* Control stack — zIndex above map, no overflow:hidden so touch isn't clipped */}
      <View style={[styles.ctrlStack, { bottom: stackBottom }]}>
        <MapControlButton onPress={() => zoomBy(0.5)}>
          <Plus size={18} color="#134E4A" />
        </MapControlButton>

        <View style={styles.ctrlDivider} />

        <MapControlButton onPress={() => zoomBy(2)}>
          <Minus size={18} color="#134E4A" />
        </MapControlButton>

        <View style={styles.ctrlDivider} />

        <MapControlButton onPress={goToMyLocation}>
          <NavigationArrow size={18} weight="fill" color={colors.primary} />
        </MapControlButton>
      </View>
    </View>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  // zIndex: 10 ensures the stack receives touches above the map layer.
  // No overflow:hidden — avoids iOS touch clipping on rounded containers.
  ctrlStack: {
    position: 'absolute',
    right: 14,
    width: 44,
    zIndex: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    shadowColor: 'rgba(19,78,74,1)',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  ctrlBtn: {
    width: 44,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlDivider: {
    width: 26,
    height: 1,
    backgroundColor: 'rgba(19,78,74,0.12)',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.bg,
  },
  permTitle: { fontFamily: font.bold, fontSize: 18, color: colors.text, marginBottom: 6 },
  statusText: { color: colors.textMuted, textAlign: 'center', marginBottom: 18 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff' },
});
