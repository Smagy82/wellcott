import {
  ActivityIndicator,
  Animated as RNAnimated,
  FlatList,
  Keyboard,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../../src/components/Text';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  MagnifyingGlass,
  MapPin,
  Phone,
  NavigationArrow,
  ShareNetwork,
  Heart,
} from 'phosphor-react-native';
import { shareClinic } from '../../src/lib/shareClinic';
import * as Location from 'expo-location';
import { useNearbyClinics } from '../../src/lib/useNearbyClinics';
import { searchClinicsByText, suggestCities, type CitySuggestion } from '../../src/lib/clinicSearch';
import { getDb } from '../../src/lib/database';
import type { ClinicWithDistance } from '../../src/types/clinic';
import { theme } from '../../src/theme';
import { PrescriptionSavingsBanner } from '../../src/components/PrescriptionSavingsBanner';

const { colors, radius, font, shadow, spacing } = theme;

const SHARE_GHOST_GUARD_MS = 1000;
const RADII = [10, 25, 50] as const;
type RadiusValue = typeof RADII[number];

const HEADER_LARGE_H = 92;
const COLLAPSE_AT = 44;

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastState = { visible: boolean; text: string; icon: 'phone' | 'directions' };

function Toast({ state }: { state: ToastState }) {
  const translateY = useSharedValue(14);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (state.visible) {
      translateY.value = 14;
      opacity.value = 0;
      translateY.value = withSpring(0, { mass: 0.8, damping: 12, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 180 });
    } else {
      translateY.value = withTiming(14, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [state.visible, state.text]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.toast, style]} pointerEvents="none">
      {state.icon === 'phone'
        ? <Phone weight="fill" size={14} color={colors.bannerAccent} />
        : <NavigationArrow weight="fill" size={14} color={colors.bannerAccent} />}
      <Text style={styles.toastText}>{state.text}</Text>
    </Animated.View>
  );
}

// ── Heart button ──────────────────────────────────────────────────────────────

function HeartButton({
  saved,
  onToggle,
}: {
  saved: boolean;
  onToggle: () => void;
}) {
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(0.4);
  const ringOpacity = useSharedValue(0);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const handlePress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSequence(
      withSpring(0.3, { mass: 0.4, damping: 8, stiffness: 300 }),
      withSpring(1.35, { mass: 0.4, damping: 8, stiffness: 300 }),
      withSpring(0.9, { mass: 0.4, damping: 10, stiffness: 200 }),
      withSpring(1, { mass: 0.6, damping: 12, stiffness: 180 }),
    );
    ringScale.value = withSequence(
      withTiming(0.4, { duration: 0 }),
      withSpring(2, { mass: 0.6, damping: 10, stiffness: 150 }),
    );
    ringOpacity.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0, { duration: 500 }),
    );
    onToggle();
  };

  return (
    <View style={styles.heartWrap}>
      <Animated.View style={[styles.heartRing, ringStyle]} />
      <Pressable onPress={handlePress} style={styles.heartBtn} hitSlop={8}>
        <Animated.View style={heartStyle}>
          <Heart
            weight={saved ? 'fill' : 'regular'}
            size={20}
            color={saved ? colors.primary : colors.heartIdle}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ── Clinic Card ───────────────────────────────────────────────────────────────

function ClinicCard({
  item,
  saved,
  onToggleSave,
  onShare,
  isShareGuarded,
  onToast,
}: {
  item: ClinicWithDistance;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onShare: (item: ClinicWithDistance) => void;
  isShareGuarded: () => boolean;
  onToast: (text: string, icon: 'phone' | 'directions') => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const cardScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  const handlePressIn = () => {
    cardScale.value = withSpring(0.98, { mass: 0.6, damping: 12, stiffness: 200 });
  };
  const handlePressOut = () => {
    cardScale.value = withSpring(1, { mass: 0.6, damping: 12, stiffness: 200 });
  };

  const handleCall = () => {
    if (item.phone) {
      Linking.openURL(`tel:${item.phone}`);
      onToast(`Calling ${item.name}…`, 'phone');
    }
  };

  const handleDirections = () => {
    const q = encodeURIComponent(`${item.address}, ${item.city}, ${item.state} ${item.zip}`);
    Linking.openURL(`https://maps.google.com/?q=${q}`);
    onToast('Opening directions…', 'directions');
  };

  const showDistance = Number.isFinite(item.distanceMiles);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => { if (isShareGuarded()) return; router.push(`/clinic/${encodeURIComponent(item.id)}`); }}
    >
      <Animated.View style={[styles.card, cardStyle]}>
        <HeartButton saved={saved} onToggle={() => onToggleSave(item.id)} />

        <Text style={styles.clinicName} numberOfLines={2}>{item.name}</Text>

        <View style={styles.addressRow}>
          <MapPin size={13} weight="fill" color={colors.primary} />
          <Text style={styles.address} numberOfLines={1}>
            {item.address}, {item.city}, {item.state} {item.zip}
          </Text>
          {showDistance && (
            <Text style={styles.distance}>{item.distanceMiles.toFixed(1)} mi</Text>
          )}
        </View>

        <View style={styles.badges}>
          {item.acceptsUninsured && (
            <View style={[styles.badge, { backgroundColor: colors.tagGreenBg }]}>
              <Text style={[styles.badgeText, { color: colors.tagGreenText }]}>{t('clinicList.acceptsUninsured')}</Text>
            </View>
          )}
          {item.slidingScale && (
            <View style={[styles.badge, { backgroundColor: colors.tagTealBg }]}>
              <Text style={[styles.badgeText, { color: colors.tagTealText }]}>{t('clinicList.slidingScale')}</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {item.phone ? (
            <TouchableOpacity
              style={styles.btnCall}
              onPress={(e) => { e.stopPropagation?.(); handleCall(); }}
              activeOpacity={0.82}
            >
              <Phone weight="fill" size={14} color="#fff" />
              <Text style={styles.btnCallText}>{t('common.call')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.btnDir}
            onPress={(e) => { e.stopPropagation?.(); handleDirections(); }}
            activeOpacity={0.82}
          >
            <NavigationArrow size={14} color={colors.primaryDark} />
            <Text style={styles.btnDirText}>{t('common.directions')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnShare}
            onPress={(e) => { e.stopPropagation?.(); onShare(item); }}
            accessibilityLabel={t('share.buttonA11y')}
            activeOpacity={0.82}
          >
            <ShareNetwork size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ── Radius chips ──────────────────────────────────────────────────────────────

function RadiusChip({ r, active, onPress }: { r: RadiusValue; active: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  const chipStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(active ? 1 : 1.05, { mass: 0.5, damping: 10, stiffness: 250 }, () => {
      if (!active) scale.value = withSpring(1, { mass: 0.5, damping: 12, stiffness: 200 });
    });
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.chip, active && styles.chipActive, chipStyle]}>
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{r} mi</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Suggestion list ───────────────────────────────────────────────────────────

function SuggestionList({
  suggestions,
  onSelect,
}: {
  suggestions: CitySuggestion[];
  onSelect: (s: CitySuggestion) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <View style={styles.suggestions}>
      {suggestions.map((s, i) => (
        <TouchableOpacity
          key={`${s.city}-${s.state}`}
          style={[styles.suggestion, i < suggestions.length - 1 && styles.suggestionBorder]}
          onPress={() => onSelect(s)}
          activeOpacity={0.7}
        >
          <MapPin size={14} color={colors.primary} />
          <Text style={styles.suggestionText}>{s.city}, {s.state}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ClinicsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [radiusMi, setRadiusMi] = useState<RadiusValue>(25);
  const [query, setQuery] = useState('');
  const [textResults, setTextResults] = useState<ClinicWithDistance[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState>({ visible: false, text: '', icon: 'phone' });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { clinics, status, retry } = useNearbyClinics(radiusMi);

  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const glassOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_AT, COLLAPSE_AT + 20],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const runTextSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setTextResults([]); return; }
    try {
      const db = await getDb();
      const results = await searchClinicsByText(db, q, 100);
      setTextResults(results);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { runTextSearch(query); }, [query, runTextSearch]);

  useEffect(() => {
    if (!showSuggestions || query.trim().length < 2) { setCitySuggestions([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const db = await getDb();
        const results = await suggestCities(db, query.trim());
        if (!cancelled) setCitySuggestions(results);
      } catch { if (!cancelled) setCitySuggestions([]); }
    })();
    return () => { cancelled = true; };
  }, [query, showSuggestions]);

  const shareJustClosedAt = useRef(0);
  const handleClinicShare = (clinic: ClinicWithDistance) => {
    shareClinic(clinic, t, () => { shareJustClosedAt.current = Date.now(); })
      .then(() => { shareJustClosedAt.current = Date.now(); });
  };
  const isShareGuarded = () => Date.now() - shareJustClosedAt.current < SHARE_GHOST_GUARD_MS;

  const handleQueryChange = (v: string) => { setQuery(v); setShowSuggestions(true); };
  const handleSuggestionSelect = (s: CitySuggestion) => {
    setQuery(s.city); setShowSuggestions(false); setCitySuggestions([]); Keyboard.dismiss();
  };

  const handleToggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const showToast = (text: string, icon: 'phone' | 'directions') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, text, icon });
    toastTimer.current = setTimeout(() => setToast((s) => ({ ...s, visible: false })), 1900);
  };

  const filtered = useMemo(() => {
    if (query.trim()) return textResults;
    return clinics;
  }, [clinics, query, textResults]);

  const requestLocation = async () => {
    await Location.requestForegroundPermissionsAsync();
    retry();
  };

  const BOTTOM_INSET = Math.max(insets.bottom, 16) + 10 + 58 + 12;

  if (status === 'no-permission') {
    const hasQuery = query.trim().length > 0;
    return (
      <View style={styles.flex}>
        <View style={[styles.listTop, { paddingTop: insets.top + 12 }]}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleQueryChange}
            placeholder={t('clinicList.searchPlaceholderCity')}
            placeholderTextColor={colors.muted}
          />
          <SuggestionList suggestions={citySuggestions} onSelect={handleSuggestionSelect} />
        </View>
        {hasQuery ? (
          <FlatList
            data={textResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ClinicCard
                item={item}
                saved={savedIds.has(item.id)}
                onToggleSave={handleToggleSave}
                onShare={handleClinicShare}
                isShareGuarded={isShareGuarded}
                onToast={showToast}
              />
            )}
            contentContainerStyle={[styles.list, { paddingBottom: BOTTOM_INSET }]}
            ListEmptyComponent={<Text style={styles.statusText}>{t('clinicList.noLocationResults', { query })}</Text>}
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.permTitle}>{t('common.locationOff')}</Text>
            <Text style={styles.statusText}>{t('clinicList.locationOffSub')}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestLocation}>
              <Text style={styles.primaryBtnText}>{t('common.enableLocation')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.statusText}>{t('map.findingClinics')}</Text>
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

  const isSearching = query.trim().length > 0;

  const ListHeader = (
    <View style={{ paddingTop: insets.top + HEADER_LARGE_H + 8 }}>
      <View style={styles.listTop}>
        {/* Search bar */}
        <View style={styles.searchWrap}>
          <MagnifyingGlass size={16} color={colors.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleQueryChange}
            placeholder={t('clinicList.searchPlaceholder')}
            placeholderTextColor={colors.muted}
            clearButtonMode="while-editing"
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        <SuggestionList suggestions={citySuggestions} onSelect={handleSuggestionSelect} />

        {/* Radius chips */}
        <View style={styles.chips}>
          {RADII.map((r) => (
            <RadiusChip
              key={r}
              r={r}
              active={r === radiusMi}
              onPress={() => { setRadiusMi(r); setQuery(''); setShowSuggestions(false); }}
            />
          ))}
        </View>

        {!isSearching && (
          <Text style={styles.listHeader}>
            {t('clinicList.clinicsNearby', { count: filtered.length, radius: radiusMi })}
          </Text>
        )}
        <PrescriptionSavingsBanner isShareGuarded={isShareGuarded} />
      </View>
    </View>
  );

  return (
    <View style={styles.flex}>
      {/* Scrollable list */}
      <RNAnimated.FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ClinicCard
            item={item}
            saved={savedIds.has(item.id)}
            onToggleSave={handleToggleSave}
            onShare={handleClinicShare}
            isShareGuarded={isShareGuarded}
            onToast={showToast}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: BOTTOM_INSET }]}
        ListHeaderComponent={ListHeader}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.statusText}>
            {isSearching
              ? t('clinicList.noResultsForQuery', { query })
              : t('clinicList.noClinicsInRadius', { radius: radiusMi })}
          </Text>
        }
        onScroll={RNAnimated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      />

      {/* Collapsing large header (behind list, above status bar) */}
      <RNAnimated.View
        style={[styles.largeHeader, { paddingTop: insets.top + 12, opacity: largeTitleOpacity }]}
        pointerEvents="none"
      >
        <Text style={styles.largeTitle}>{t('tabs.clinics')}</Text>
        {clinics.length > 0 && (
          <Text style={styles.largeSub}>{filtered.length} clinics near you</Text>
        )}
      </RNAnimated.View>

      {/* Glass bar (fades in on scroll) */}
      <RNAnimated.View
        style={[styles.glassBar, { paddingTop: insets.top, opacity: glassOpacity }]}
        pointerEvents="none"
      >
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.glassHairline} />
        <Text style={styles.glassTitle}>{t('tabs.clinics')}</Text>
      </RNAnimated.View>

      {/* Toast */}
      <View style={[styles.toastAnchor, { bottom: BOTTOM_INSET + 8 }]} pointerEvents="none">
        <Toast state={toast} />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  permTitle: { fontFamily: font.bold, fontSize: 18, color: colors.text, marginBottom: 6 },
  statusText: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 18 },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 11, paddingHorizontal: 28, marginTop: 4,
  },
  primaryBtnText: { fontFamily: font.semibold, color: '#fff', fontSize: 14 },

  // Large collapsing header
  largeHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: HEADER_LARGE_H + 80,
    paddingHorizontal: spacing.lg,
    justifyContent: 'flex-start',
    backgroundColor: colors.bg,
    zIndex: 1,
  },
  largeTitle: {
    fontFamily: font.bold,
    fontSize: 32,
    color: colors.text,
    letterSpacing: -0.6,
  },
  largeSub: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 3,
  },

  // Glass collapsed header
  glassBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 92,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    zIndex: 2,
    overflow: 'hidden',
  },
  glassHairline: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(19,78,74,0.08)',
  },
  glassTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.text,
  },

  listTop: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 10,
    ...shadow,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 10,
  },

  chips: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 18,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: 'rgba(19,78,74,0.12)',
    ...shadow,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: 'rgba(8,145,178,0.28)',
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  chipText: { fontFamily: font.bold, fontSize: 13, color: colors.primaryDark },
  chipTextActive: { color: '#fff' },

  listHeader: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginBottom: 6, marginLeft: 2 },
  list: { paddingHorizontal: spacing.lg },

  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    ...shadow,
  },
  clinicName: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.text,
    paddingRight: 44,
    marginBottom: 6,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  address: { fontFamily: font.regular, fontSize: 13, color: colors.muted, flex: 1 },
  distance: { fontFamily: font.bold, fontSize: 13, color: colors.primary, flexShrink: 0 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: font.bold, fontSize: 11 },

  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnCall: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 7, paddingHorizontal: 16,
    shadowColor: 'rgba(8,145,178,0.28)',
    shadowOpacity: 1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  btnCallText: { fontFamily: font.bold, color: '#fff', fontSize: 13 },
  btnDir: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingVertical: 7, paddingHorizontal: 14,
  },
  btnDirText: { fontFamily: font.bold, color: colors.primaryDark, fontSize: 13 },
  btnShare: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingVertical: 7,
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Heart
  heartWrap: {
    position: 'absolute',
    top: 12, right: 12,
    width: 38, height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartRing: {
    position: 'absolute',
    width: 38, height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.primary,
  },

  // Suggestions
  suggestions: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: 8,
    overflow: 'hidden',
    ...shadow,
  },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionText: { fontFamily: font.regular, fontSize: 14, color: colors.text },

  // Toast
  toastAnchor: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(19,78,74,0.94)',
    borderRadius: radius.pill,
    paddingVertical: 9, paddingHorizontal: 18,
    alignSelf: 'center',
  },
  toastText: { fontFamily: font.semibold, fontSize: 13, color: '#fff' },
});
