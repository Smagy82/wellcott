import { ActivityIndicator, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../src/components/Text';
import { ScreenTransition } from '../../src/components/ScreenTransition';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView from 'react-native-map-clustering';
import { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
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

// Mirror tab-bar positioning constants from _layout.tsx
const TAB_BAR_H = 58;
const TAB_BAR_BOTTOM_EXTRA = 10; // space below the bar itself

const US_REGION = {
  latitude: 39.8,
  longitude: -98.6,
  latitudeDelta: 30,
  longitudeDelta: 40,
};

const SPRING_IN  = { mass: 0.6, damping: 10, stiffness: 200 } as const;
const SPRING_OUT = { mass: 1,   damping: 14, stiffness: 180 } as const;

// ── Map control button ───────────────────────────────────────────────────────

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
    <Animated.View style={animStyle}>
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
        {children}
      </Pressable>
    </Animated.View>
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
      // geolocation unavailable — silently ignore
    }
  };

  const zoomBy = async (delta: number) => {
    if (!mapRef.current) return;
    try {
      const camera = await mapRef.current.getCamera();
      mapRef.current.animateCamera(
        { zoom: (camera.zoom ?? 10) + delta },
        { duration: 300 },
      );
    } catch {
      // camera API unavailable — silently ignore
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

  // Position stack just above the floating tab bar
  // Tab bar: bottom = Math.max(insets.bottom, 16) + TAB_BAR_BOTTOM_EXTRA
  // Stack bottom = tab bar bottom + TAB_BAR_H + 12
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

      {/* Vertical map control stack */}
      <View style={[styles.ctrlStack, { bottom: stackBottom }]}>
        <MapControlButton onPress={() => zoomBy(1)}>
          <Plus size={18} color="#134E4A" />
        </MapControlButton>

        <View style={styles.ctrlDivider} />

        <MapControlButton onPress={() => zoomBy(-1)}>
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

  // Vertical capsule control
  ctrlStack: {
    position: 'absolute',
    right: 14,
    width: 44,
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
    overflow: 'hidden',
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
