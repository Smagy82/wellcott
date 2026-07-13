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
import {
  init as initSaved,
  getSavedIds,
  toggleSaved,
  subscribe as subscribeSaved,
} from '../../src/store/savedClinics';
import { ScreenTransition } from '../../src/components/ScreenTransition';

const { colors, radius, font, shadow, spacing } = theme;

const SHARE_GHOST_GUARD_MS = 1000;
const RADII = [10, 25, 50] as const;
type RadiusValue = typeof RADII[number];

// Glass header fades in after this many px of scroll
const GLASS_START = 54;
const GLASS_END   = 74;

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
    <Pressable style={styles.heartBtn} onPress={handlePress} hitSlop={8}>
      <Animated.View style={[styles.heartRing, ringStyle]} />
      <Animated.View style={heartStyle}>
        <Heart
          weight={saved ? 'fill' : 'regular'}
          size={20}
          color={saved ? colors.primary : colors.heartIdle}
        />
      </Animated.View>
    </Pressable>
  );
}

// ── Clinic Card ───────────────────────────────────────────────────────────────
// Layout: left flex content + right fixed 44px column (heart spacer + distance).
// Heart button is rendered as an ABSOLUTE SIBLING of the card Pressable so
// touches on it never reach the card's navigation handler.

function ClinicCard({
  item,
  saved,
  onShare,
  isShareGuarded,
  onToast,
  onToggleSave,
}: {
  item: ClinicWithDistance;
  saved: boolean;
  onShare: (item: ClinicWithDistance) => void;
  isShareGuarded: () => boolean;
  onToast: (text: string, icon: 'phone' | 'directions') => void;
  onToggleSave: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const cardScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  const handlePressIn = () => { cardScale.value = withSpring(0.98, { mass: 0.6, damping: 12, stiffness: 200 }); };
  const handlePressOut = () => { cardScale.value = withSpring(1, { mass: 0.6, damping: 12, stiffness: 200 }); };

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
    <View style={styles.cardWrap}>
      {/* ── Tappable card ── */}
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => { if (isShareGuarded()) return; router.push(`/clinic/${encodeURIComponent(item.id)}`); }}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.cardRow}>
            {/* Left: name, address, badges, actions */}
            <View style={styles.cardContent}>
              <Text style={styles.clinicName} numberOfLines={2}>{item.name}</Text>

              <View style={styles.addressRow}>
                <MapPin size={13} weight="fill" color={colors.primary} />
                <Text style={styles.address} numberOfLines={1} ellipsizeMode="tail">
                  {item.address}, {item.city}, {item.state} {item.zip}
                </Text>
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
                  <TouchableOpacity style={styles.btnCall} onPress={(e) => { e.stopPropagation?.(); handleCall(); }} activeOpacity={0.82}>
                    <Phone weight="fill" size={14} color="#fff" />
                    <Text style={styles.btnCallText}>{t('common.call')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.btnDir} onPress={(e) => { e.stopPropagation?.(); handleDirections(); }} activeOpacity={0.82}>
                  <NavigationArrow size={14} color={colors.primaryDark} />
                  <Text style={styles.btnDirText}>{t('common.directions')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnShare} onPress={(e) => { e.stopPropagation?.(); onShare(item); }} accessibilityLabel={t('share.buttonA11y')} activeOpacity={0.82}>
                  <ShareNetwork size={17} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Right column: 44px — spacer for heart + distance below */}
            <View style={styles.cardRight}>
              {/* 38×38 spacer — the actual heart Pressable is a sibling */}
              <View style={styles.heartSpacer} />
              {showDistance && (
                <Text style={styles.distanceCol}>{item.distanceMiles.toFixed(1)} mi</Text>
              )}
            </View>
          </View>
        </Animated.View>
      </Pressable>

      {/* ── Heart — absolute sibling, aligned to cardRight column top ── */}
      <View style={styles.heartAnchor} pointerEvents="box-none">
        <HeartButton saved={saved} onToggle={onToggleSave} />
      </View>
    </View>
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

function SuggestionList({ suggestions, onSelect }: { suggestions: CitySuggestion[]; onSelect: (s: CitySuggestion) => void }) {
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
  const [savedIds, setSavedIds] = useState<Set<string>>(() => getSavedIds());
  const [toast, setToast] = useState<ToastState>({ visible: false, text: '', icon: 'phone' });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initSaved().catch(() => {});
    return subscribeSaved(setSavedIds);
  }, []);

  const { clinics, status, retry } = useNearbyClinics(radiusMi);
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // Glass bar: fully transparent at top, solid blur after GLASS_START px scroll
  const glassOpacity = scrollY.interpolate({
    inputRange: [GLASS_START, GLASS_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // Large title inside scroll fades out as glass fades in
  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [0, GLASS_START],
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

  const handleToggleSave = (item: ClinicWithDistance) => {
    const address = `${item.address}, ${item.city}, ${item.state} ${item.zip}`;
    toggleSaved(item.id, { name: item.name, address }).catch(() => {});
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

  // Collapsed glass header height = safe area + 44pt content
  const GLASS_H = insets.top + 44;

  if (status === 'no-permission') {
    const hasQuery = query.trim().length > 0;
    return (
      <View style={styles.flex}>
        <View style={[styles.listTop, { paddingTop: insets.top + 12 }]}>
          <TextInput
            style={styles.searchInputStandalone}
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
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ClinicCard
                item={item}
                saved={savedIds.has(item.id)}
                onToggleSave={() => handleToggleSave(item)}
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

  // Large title + search field live INSIDE the scroll — no floating header overlap
  const ListHeader = (
    <View style={{ paddingTop: insets.top + 12 }}>
      {/* Large title (fades out as glass bar fades in) */}
      <RNAnimated.View style={[styles.largeTitleWrap, { opacity: largeTitleOpacity }]} pointerEvents="none">
        <Text style={styles.largeTitle}>{t('tabs.clinics')}</Text>
        {clinics.length > 0 && (
          <Text style={styles.largeSub}>{filtered.length} clinics near you</Text>
        )}
      </RNAnimated.View>

      <View style={styles.listTop}>
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
    <ScreenTransition>
    <View style={styles.flex}>
      <RNAnimated.FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ClinicCard
            item={item}
            saved={savedIds.has(item.id)}
            onToggleSave={() => handleToggleSave(item)}
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

      {/* Glass collapsed header — transparent at top, blurs in on scroll.
          pointerEvents="none" always so search field remains tappable. */}
      <RNAnimated.View
        style={[styles.glassBar, { height: GLASS_H, opacity: glassOpacity }]}
        pointerEvents="none"
      >
        {/* Only BlurView + semi-transparent tint — no gradients or shadows */}
        <BlurView intensity={56} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(240,253,250,0.86)' }]} />
        <View style={styles.glassHairline} />
        <Text style={[styles.glassTitle, { marginTop: insets.top + 10 }]}>{t('tabs.clinics')}</Text>
      </RNAnimated.View>

      <View style={[styles.toastAnchor, { bottom: BOTTOM_INSET + 8 }]} pointerEvents="none">
        <Toast state={toast} />
      </View>
    </View>
    </ScreenTransition>
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

  // Large title — lives inside the scroll, fades out on scroll
  largeTitleWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
  },
  largeTitle: { fontFamily: font.bold, fontSize: 32, color: colors.text, letterSpacing: -0.6 },
  largeSub: { fontFamily: font.regular, fontSize: 14, color: colors.muted, marginTop: 3 },

  // Glass bar — absolutely positioned, transparent → blurred on scroll
  glassBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    zIndex: 10,
  },
  glassHairline: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(19,78,74,0.08)',
  },
  glassTitle: { fontFamily: font.bold, fontSize: 17, color: colors.text },

  listTop: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, marginBottom: 10, ...shadow,
  },
  searchInput: {
    flex: 1, fontFamily: font.regular, fontSize: 14,
    color: colors.text, paddingVertical: 10,
  },
  searchInputStandalone: {
    fontFamily: font.regular, backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: colors.text, marginBottom: 10, ...shadow,
  },

  chips: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 18,
    backgroundColor: colors.card, borderWidth: 1.5,
    borderColor: 'rgba(19,78,74,0.12)', ...shadow,
  },
  chipActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
    shadowColor: 'rgba(8,145,178,0.28)', shadowOpacity: 1, shadowRadius: 8, elevation: 4,
  },
  chipText: { fontFamily: font.bold, fontSize: 13, color: colors.primaryDark },
  chipTextActive: { color: '#fff' },

  listHeader: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginBottom: 6, marginLeft: 2 },
  list: { paddingHorizontal: spacing.lg },

  // ── Card ──────────────────────────────────────────────────────────────────
  cardWrap: { marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, ...shadow },

  // Horizontal row: content + 44px right column
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardContent: { flex: 1, paddingRight: 8 },

  clinicName: { fontFamily: font.bold, fontSize: 16, color: colors.text, marginBottom: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  address: { fontFamily: font.regular, fontSize: 13, color: colors.muted, flex: 1 },

  // Right column: 44px wide, heart spacer + distance
  cardRight: { width: 44, alignItems: 'center', gap: 4 },
  heartSpacer: { width: 38, height: 38 },
  distanceCol: { fontFamily: font.bold, fontSize: 12, color: colors.primary, textAlign: 'center' },

  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: font.bold, fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnCall: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingVertical: 7, paddingHorizontal: 16,
    shadowColor: 'rgba(8,145,178,0.28)', shadowOpacity: 1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  btnCallText: { fontFamily: font.bold, color: '#fff', fontSize: 13 },
  btnDir: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.bg, borderRadius: radius.sm,
    paddingVertical: 7, paddingHorizontal: 14,
  },
  btnDirText: { fontFamily: font.bold, color: colors.primaryDark, fontSize: 13 },
  btnShare: {
    backgroundColor: colors.bg, borderRadius: radius.sm,
    paddingVertical: 7, width: 38, alignItems: 'center', justifyContent: 'center',
  },

  // Heart — absolute sibling aligned to top-right of card, over cardRight column
  heartAnchor: {
    position: 'absolute',
    // card padding is 14, right column is 44px wide, so anchor sits at card's right edge
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  heartBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  heartRing: {
    position: 'absolute',
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2, borderColor: colors.primary,
  },

  suggestions: {
    backgroundColor: colors.card, borderRadius: radius.md, marginBottom: 8,
    overflow: 'hidden', ...shadow,
  },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  suggestionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggestionText: { fontFamily: font.regular, fontSize: 14, color: colors.text },

  toastAnchor: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(19,78,74,0.94)', borderRadius: radius.pill,
    paddingVertical: 9, paddingHorizontal: 18, alignSelf: 'center',
  },
  toastText: { fontFamily: font.semibold, fontSize: 13, color: '#fff' },
});
