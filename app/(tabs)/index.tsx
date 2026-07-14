import {
  ActivityIndicator,
  Animated as RNAnimated,
  FlatList,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText } from '../../src/components/AppText';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { useNearbyMh } from '../../src/lib/useNearbyMh';
import { searchClinicsByText, suggestCities, type CitySuggestion } from '../../src/lib/clinicSearch';
import { searchMhByText, formatMhAddress } from '../../src/lib/mentalHealthSearch';
import { getDb } from '../../src/lib/database';
import type { ClinicWithDistance } from '../../src/types/clinic';
import type { MhWithDistance } from '../../src/types/mentalHealth';
import { theme } from '../../src/theme';
import { PrescriptionSavingsBanner } from '../../src/components/PrescriptionSavingsBanner';
import { Crisis988Card } from '../../src/components/Crisis988Card';
import {
  init as initSaved,
  isSaved,
  toggleSavedSync,
  subscribeAny as subscribeSavedAny,
} from '../../src/store/savedClinics';
import { ScreenTransition } from '../../src/components/ScreenTransition';

const { colors, radius, font, shadow, spacing } = theme;

type Mode = 'clinics' | 'mh';

const SHARE_GHOST_GUARD_MS = 1000;
const RADII = [10, 25, 50] as const;
type RadiusValue = typeof RADII[number];

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
      <AppText variant="button" style={styles.toastText}>{state.text}</AppText>
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
      withSpring(1.3, { damping: 9, stiffness: 260 }),
      withSpring(1),
    );
    ringScale.value = withSequence(
      withTiming(0.4, { duration: 0 }),
      withTiming(2, { duration: 500 }),
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

const ClinicCard = memo(function ClinicCard({
  item,
  onShare,
  isShareGuarded,
  onToast,
}: {
  item: ClinicWithDistance;
  onShare: (item: ClinicWithDistance) => void;
  isShareGuarded: () => boolean;
  onToast: (text: string, icon: 'phone' | 'directions') => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const cardScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  const saved = useSyncExternalStore(subscribeSavedAny, () => isSaved(item.id, 'clinic'));

  const handleToggleSave = () => {
    const address = `${item.address}, ${item.city}, ${item.state} ${item.zip}`;
    toggleSavedSync(item.id, 'clinic', { name: item.name, address });
  };

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
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => { if (isShareGuarded()) return; router.push(`/clinic/${encodeURIComponent(item.id)}`); }}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.cardRow}>
            <View style={styles.cardContent}>
              <AppText variant="cardTitle" style={styles.clinicName} numberOfLines={2}>{item.name}</AppText>

              <View style={styles.addressRow}>
                <MapPin size={13} weight="fill" color={colors.primary} />
                <AppText variant="secondary" style={styles.address} numberOfLines={1} ellipsizeMode="tail">
                  {item.address}, {item.city}, {item.state} {item.zip}
                </AppText>
              </View>

              <View style={styles.badges}>
                {item.acceptsUninsured && (
                  <View style={[styles.badge, { backgroundColor: colors.tagGreenBg }]}>
                    <AppText variant="chip" style={[styles.badgeText, { color: colors.tagGreenText }]}>{t('clinicList.acceptsUninsured')}</AppText>
                  </View>
                )}
                {item.slidingScale && (
                  <View style={[styles.badge, { backgroundColor: colors.tagTealBg }]}>
                    <AppText variant="chip" style={[styles.badgeText, { color: colors.tagTealText }]}>{t('clinicList.slidingScale')}</AppText>
                  </View>
                )}
                {(item.dentalSignal === 'strong' || item.dentalSignal === 'medium') && (
                  <View style={[styles.badge, { backgroundColor: colors.tintSky }]}>
                    <AppText variant="chip" style={[styles.badgeText, { color: colors.tintSkyIcon }]}>{t('clinics.dentalBadgeShort')}</AppText>
                  </View>
                )}
              </View>

              <View style={styles.actions}>
                {item.phone ? (
                  <TouchableOpacity style={styles.btnCall} onPress={(e) => { e.stopPropagation?.(); handleCall(); }} activeOpacity={0.82}>
                    <Phone weight="fill" size={14} color="#fff" />
                    <AppText variant="button" style={styles.btnCallText}>{t('common.call')}</AppText>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.btnDir} onPress={(e) => { e.stopPropagation?.(); handleDirections(); }} activeOpacity={0.82}>
                  <NavigationArrow size={14} color={colors.primaryDark} />
                  <AppText variant="button" style={styles.btnDirText}>{t('common.directions')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnShare} onPress={(e) => { e.stopPropagation?.(); onShare(item); }} accessibilityLabel={t('share.buttonA11y')} activeOpacity={0.82}>
                  <ShareNetwork size={17} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cardRight}>
              <View style={styles.heartSpacer} />
              {showDistance && (
                <AppText variant="caption" style={styles.distanceCol}>{item.distanceMiles.toFixed(1)} mi</AppText>
              )}
            </View>
          </View>
        </Animated.View>
      </Pressable>

      <View style={styles.heartAnchor} pointerEvents="box-none">
        <HeartButton saved={saved} onToggle={handleToggleSave} />
      </View>
    </View>
  );
});

// ── MH Card ───────────────────────────────────────────────────────────────────

const MhCard = memo(function MhCard({
  item,
  isShareGuarded,
}: {
  item: MhWithDistance;
  isShareGuarded: () => boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const cardScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  const saved = useSyncExternalStore(subscribeSavedAny, () => isSaved(item.id, 'mh'));

  const handleToggleSave = () => {
    toggleSavedSync(item.id, 'mh', { name: item.name1, address: formatMhAddress(item) });
  };

  const handlePressIn = () => { cardScale.value = withSpring(0.98, { mass: 0.6, damping: 12, stiffness: 200 }); };
  const handlePressOut = () => { cardScale.value = withSpring(1, { mass: 0.6, damping: 12, stiffness: 200 }); };

  const handleCall = () => {
    if (item.phone) Linking.openURL(`tel:${item.phone}`);
  };

  const handleDirections = () => {
    const q = encodeURIComponent(formatMhAddress(item));
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  const handleShare = async () => {
    const parts: string[] = [item.name1];
    if (item.name2) parts.push(item.name2);
    parts.push(formatMhAddress(item));
    if (item.phone) parts.push(item.phone);
    try { await Share.share({ message: parts.join('\n') }); } catch { /* cancelled */ }
  };

  const showDistance = Number.isFinite(item.distanceMiles);
  const showDirections = !!(item.street1 || item.latitude !== null);

  return (
    <View style={styles.cardWrap}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => { if (isShareGuarded()) return; router.push(`/mh/${encodeURIComponent(item.id)}`); }}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.cardRow}>
            <View style={styles.cardContent}>
              <AppText variant="cardTitle" style={styles.clinicName} numberOfLines={2}>{item.name1}</AppText>
              {item.name2 ? (
                <AppText variant="caption" style={styles.mhName2} numberOfLines={1}>{item.name2}</AppText>
              ) : null}

              <View style={styles.addressRow}>
                <MapPin size={13} weight="fill" color={colors.primary} />
                <AppText variant="secondary" style={styles.address} numberOfLines={1}>
                  {formatMhAddress(item)}
                </AppText>
              </View>

              <View style={styles.badges}>
                {item.hasSlidingFee ? (
                  <View style={[styles.badge, { backgroundColor: colors.tagGreenBg }]}>
                    <AppText variant="chip" style={[styles.badgeText, { color: colors.tagGreenText }]}>
                      {t('mh.badgeSlidingFee')}
                    </AppText>
                  </View>
                ) : null}
                {item.hasPayAssist && !item.hasSlidingFee ? (
                  <View style={[styles.badge, { backgroundColor: colors.tagTealBg }]}>
                    <AppText variant="chip" style={[styles.badgeText, { color: colors.tagTealText }]}>
                      {t('mh.badgePayAssist')}
                    </AppText>
                  </View>
                ) : null}
              </View>

              <View style={styles.actions}>
                {item.phone ? (
                  <TouchableOpacity
                    style={styles.btnCall}
                    onPress={(e) => { e.stopPropagation?.(); handleCall(); }}
                    activeOpacity={0.82}
                  >
                    <Phone weight="fill" size={14} color="#fff" />
                    <AppText variant="button" style={styles.btnCallText}>{t('common.call')}</AppText>
                  </TouchableOpacity>
                ) : null}
                {showDirections ? (
                  <TouchableOpacity
                    style={styles.btnDir}
                    onPress={(e) => { e.stopPropagation?.(); handleDirections(); }}
                    activeOpacity={0.82}
                  >
                    <NavigationArrow size={14} color={colors.primaryDark} />
                    <AppText variant="button" style={styles.btnDirText}>{t('common.directions')}</AppText>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.btnShare}
                  onPress={(e) => { e.stopPropagation?.(); handleShare(); }}
                  activeOpacity={0.82}
                >
                  <ShareNetwork size={17} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cardRight}>
              <View style={styles.heartSpacer} />
              {showDistance && (
                <AppText variant="caption" style={styles.distanceCol}>{item.distanceMiles.toFixed(1)} mi</AppText>
              )}
            </View>
          </View>
        </Animated.View>
      </Pressable>

      <View style={styles.heartAnchor} pointerEvents="box-none">
        <HeartButton saved={saved} onToggle={handleToggleSave} />
      </View>
    </View>
  );
});

// ── Mode switcher ─────────────────────────────────────────────────────────────

function ModeSwitcher({ mode, onSelect }: { mode: Mode; onSelect: (m: Mode) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.modeSwitcher}>
      {(['clinics', 'mh'] as Mode[]).map((m) => (
        <Pressable
          key={m}
          onPress={() => onSelect(m)}
          style={[styles.modeChip, mode === m && styles.modeChipActive]}
        >
          <AppText
            variant="button"
            style={[styles.modeChipText, mode === m && styles.modeChipTextActive]}
          >
            {t(m === 'clinics' ? 'mh.tabClinics' : 'mh.tabMh')}
          </AppText>
        </Pressable>
      ))}
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
        <AppText variant="button" style={[styles.chipText, active && styles.chipTextActive]}>{r} mi</AppText>
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
          <AppText variant="body" style={styles.suggestionText}>{s.city}, {s.state}</AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ClinicsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('clinics');
  const [radiusMi, setRadiusMi] = useState<RadiusValue>(25);
  const [slidingFeeOnly, setSlidingFeeOnly] = useState(false);
  const [dentalOnly, setDentalOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [textResults, setTextResults] = useState<ClinicWithDistance[]>([]);
  const [mhTextResults, setMhTextResults] = useState<MhWithDistance[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, text: '', icon: 'phone' });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { initSaved().catch(() => {}); }, []);

  // Both hooks run from mount — data is ready when user switches mode
  const { clinics, status: clinicStatus, retry: clinicRetry } = useNearbyClinics(radiusMi, dentalOnly);
  const { facilities: mhFacilities, status: mhStatus, retry: mhRetry } = useNearbyMh(radiusMi, slidingFeeOnly);

  const status = mode === 'clinics' ? clinicStatus : mhStatus;
  const retry  = mode === 'clinics' ? clinicRetry  : mhRetry;

  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const glassOpacity = scrollY.interpolate({
    inputRange: [GLASS_START, GLASS_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [0, GLASS_START],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Clinic text search
  const runClinicSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setTextResults([]); return; }
    try {
      const db = await getDb();
      const results = await searchClinicsByText(db, q, 100, dentalOnly);
      setTextResults(results);
    } catch (e) { console.error(e); }
  }, [dentalOnly]);

  useEffect(() => { runClinicSearch(query); }, [query, runClinicSearch]);

  // MH text search
  useEffect(() => {
    if (!query.trim()) { setMhTextResults([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const db = await getDb();
        const results = await searchMhByText(db, query.trim(), 100, slidingFeeOnly);
        if (!cancelled) setMhTextResults(results);
      } catch { if (!cancelled) setMhTextResults([]); }
    })();
    return () => { cancelled = true; };
  }, [query, slidingFeeOnly]);

  // City suggestions — clinics mode only
  useEffect(() => {
    if (!showSuggestions || query.trim().length < 2 || mode !== 'clinics') {
      setCitySuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const db = await getDb();
        const results = await suggestCities(db, query.trim());
        if (!cancelled) setCitySuggestions(results);
      } catch { if (!cancelled) setCitySuggestions([]); }
    })();
    return () => { cancelled = true; };
  }, [query, showSuggestions, mode]);

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

  const showToast = useCallback((text: string, icon: 'phone' | 'directions') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, text, icon });
    toastTimer.current = setTimeout(() => setToast((s) => ({ ...s, visible: false })), 1900);
  }, []);

  const filtered = useMemo(() => {
    if (mode === 'clinics') {
      return query.trim() ? textResults : clinics;
    }
    return query.trim() ? mhTextResults : mhFacilities;
  }, [mode, clinics, mhFacilities, query, textResults, mhTextResults]);

  // Inject prescription savings banner after 3rd clinic card (or at end if <3 clinics)
  const listData = useMemo(() => {
    if (mode !== 'clinics') return filtered as any[];
    const data = filtered as ClinicWithDistance[];
    if (data.length === 0) return [] as any[];
    if (data.length <= 3) return [...data, { __banner: true }] as any[];
    return [...data.slice(0, 3), { __banner: true }, ...data.slice(3)] as any[];
  }, [filtered, mode]);

  const handleModeSelect = (m: Mode) => {
    setMode(m);
    setQuery('');
    setCitySuggestions([]);
    setShowSuggestions(false);
    if (m === 'clinics') setSlidingFeeOnly(false);
    if (m === 'mh') setDentalOnly(false);
  };

  const requestLocation = async () => {
    await Location.requestForegroundPermissionsAsync();
    retry();
  };

  const BOTTOM_INSET = Math.max(insets.bottom, 16) + 10 + 58 + 12;
  const GLASS_H = insets.top + 44;

  if (status === 'no-permission') {
    const hasQuery = query.trim().length > 0;
    return (
      <View style={styles.flex}>
        <View style={[styles.listTop, { paddingTop: insets.top + 12 }]}>
          <ModeSwitcher mode={mode} onSelect={handleModeSelect} />
          <TextInput
            style={styles.searchInputStandalone}
            value={query}
            onChangeText={handleQueryChange}
            placeholder={t('clinicList.searchPlaceholderCity')}
            placeholderTextColor={colors.muted}
          />
          {mode === 'clinics' && (
            <SuggestionList suggestions={citySuggestions} onSelect={handleSuggestionSelect} />
          )}
        </View>
        {hasQuery ? (
          <FlatList
            data={mode === 'clinics' ? (textResults as any[]) : (mhTextResults as any[])}
            keyExtractor={(item: any) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: { item: any }) =>
              mode === 'clinics'
                ? <ClinicCard item={item} onShare={handleClinicShare} isShareGuarded={isShareGuarded} onToast={showToast} />
                : <MhCard item={item} isShareGuarded={isShareGuarded} />
            }
            contentContainerStyle={[styles.list, { paddingBottom: BOTTOM_INSET }]}
            ListEmptyComponent={<AppText variant="body" style={styles.statusText}>{t('clinicList.noLocationResults', { query })}</AppText>}
          />
        ) : (
          <View style={styles.center}>
            <AppText style={styles.permTitle}>{t('common.locationOff')}</AppText>
            <AppText variant="body" style={styles.statusText}>{t('clinicList.locationOffSub')}</AppText>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestLocation}>
              <AppText variant="button" style={styles.primaryBtnText}>{t('common.enableLocation')}</AppText>
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
        <AppText variant="body" style={styles.statusText}>{t('map.findingClinics')}</AppText>
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

  const isSearching = query.trim().length > 0;

  const ListHeader = (
    <View style={{ paddingTop: insets.top + 12 }}>
      <RNAnimated.View style={[styles.largeTitleWrap, { opacity: largeTitleOpacity }]} pointerEvents="none">
        <AppText variant="largeTitle" style={styles.largeTitle}>
          {mode === 'clinics' ? t('tabs.clinics') : t('mh.tabMh')}
        </AppText>
        {filtered.length > 0 && mode === 'clinics' && (
          <AppText style={styles.largeSub}>{filtered.length} clinics near you</AppText>
        )}
      </RNAnimated.View>

      <View style={styles.listTop}>
        <ModeSwitcher mode={mode} onSelect={handleModeSelect} />

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

        {mode === 'clinics' && (
          <SuggestionList suggestions={citySuggestions} onSelect={handleSuggestionSelect} />
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          {RADII.map((r) => (
            <RadiusChip
              key={r}
              r={r}
              active={r === radiusMi}
              onPress={() => { setRadiusMi(r); setQuery(''); setShowSuggestions(false); }}
            />
          ))}
          <View style={styles.chipDivider} />
          {mode === 'mh' && (
            <Pressable
              onPress={() => setSlidingFeeOnly((v) => !v)}
              style={[styles.chip, slidingFeeOnly && styles.chipActive]}
            >
              <AppText variant="button" style={[styles.chipText, slidingFeeOnly && styles.chipTextActive]}>
                {t('mh.slidingFeeOnly')}
              </AppText>
            </Pressable>
          )}
          {mode === 'clinics' && (
            <Pressable
              onPress={() => setDentalOnly((v) => !v)}
              style={[styles.chip, dentalOnly && styles.chipActive]}
            >
              <AppText variant="button" style={[styles.chipText, dentalOnly && styles.chipTextActive]}>
                {t('clinics.filterDental')}
              </AppText>
            </Pressable>
          )}
        </ScrollView>

        {mode === 'clinics' && dentalOnly && (
          <View style={styles.dentalNote}>
            <AppText variant="caption" style={styles.dentalNoteText}>{t('clinics.dentalFilterNote')}</AppText>
          </View>
        )}

        {!isSearching && (
          <AppText variant="caption" style={styles.listHeader}>
            {mode === 'clinics'
              ? t('clinicList.clinicsNearby', { count: filtered.length, radius: radiusMi })
              : t('mh.nearbyCount', { count: filtered.length, radius: radiusMi })}
          </AppText>
        )}

        {mode === 'mh' && (
          <View style={styles.crisis988Wrap}>
            <Crisis988Card />
          </View>
        )}
      </View>
    </View>
  );

  return (
    <ScreenTransition>
    <View style={styles.flex}>
      <RNAnimated.FlatList
        data={listData}
        keyExtractor={(item: any) => item.__banner ? 'prescription-banner' : item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }: { item: any }) => {
          if (item.__banner) return <PrescriptionSavingsBanner isShareGuarded={isShareGuarded} />;
          return mode === 'clinics'
            ? <ClinicCard item={item} onShare={handleClinicShare} isShareGuarded={isShareGuarded} onToast={showToast} />
            : <MhCard item={item} isShareGuarded={isShareGuarded} />;
        }}
        contentContainerStyle={[styles.list, { paddingBottom: BOTTOM_INSET }]}
        ListHeaderComponent={ListHeader}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <AppText variant="body" style={styles.statusText}>
            {isSearching
              ? t(mode === 'clinics' ? 'clinicList.noResultsForQuery' : 'mh.noResults', { query })
              : t(mode === 'clinics' ? 'clinicList.noClinicsInRadius' : 'mh.noNearby', { radius: radiusMi })}
          </AppText>
        }
        onScroll={RNAnimated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      />

      <RNAnimated.View
        style={[styles.glassBar, { height: GLASS_H, opacity: glassOpacity }]}
        pointerEvents="none"
      >
        <BlurView intensity={56} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(240,253,250,0.86)' }]} />
        <View style={styles.glassHairline} />
        <AppText variant="screenTitle" style={[styles.glassTitle, { marginTop: insets.top + 10 }]}>
          {mode === 'clinics' ? t('tabs.clinics') : t('mh.tabMh')}
        </AppText>
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
  primaryBtnText: { color: '#fff' },

  largeTitleWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
  },
  largeTitle: {},
  largeSub: { fontFamily: font.regular, fontSize: 14, color: colors.muted, marginTop: 3 },

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
  glassTitle: {},

  listTop: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },

  modeSwitcher: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeChip: {
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 18,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: 'rgba(19,78,74,0.12)',
    ...shadow,
  },
  modeChipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  modeChipText: { color: colors.primaryDark },
  modeChipTextActive: { color: '#fff' },

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

  chipsScroll: { marginBottom: 10, marginHorizontal: -spacing.lg },
  chipsContent: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, alignItems: 'center' },
  chipDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: colors.primaryDark,
    opacity: 0.2,
    marginHorizontal: 4,
  },
  dentalNote: {
    backgroundColor: colors.tintSky,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  dentalNoteText: { color: colors.tintSkyIcon, lineHeight: 18 },
  chip: {
    borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 18,
    backgroundColor: colors.card, borderWidth: 1.5,
    borderColor: 'rgba(19,78,74,0.12)', ...shadow,
  },
  chipActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
    shadowColor: 'rgba(8,145,178,0.28)', shadowOpacity: 1, shadowRadius: 8, elevation: 4,
  },
  chipText: { color: colors.primaryDark },
  chipTextActive: { color: '#fff' },

  listHeader: { marginBottom: 6, marginLeft: 2 },
  list: { paddingHorizontal: spacing.lg },

  crisis988Wrap: { marginTop: 4, marginBottom: 6 },

  cardWrap: { marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, ...shadow },

  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardContent: { flex: 1, paddingRight: 8 },

  clinicName: { marginBottom: 6 },
  mhName2: { color: colors.muted, marginBottom: 4, marginTop: -2 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  address: { flex: 1 },

  cardRight: { width: 44, alignItems: 'center', gap: 4 },
  heartSpacer: { width: 38, height: 38 },
  distanceCol: { fontFamily: font.bold, color: colors.primary, textAlign: 'center' },

  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: {},
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnCall: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingVertical: 7, paddingHorizontal: 16,
    shadowColor: 'rgba(8,145,178,0.28)', shadowOpacity: 1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  btnCallText: { color: '#fff' },
  btnDir: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.bg, borderRadius: radius.sm,
    paddingVertical: 7, paddingHorizontal: 14,
  },
  btnDirText: { color: colors.primaryDark },
  btnShare: {
    backgroundColor: colors.bg, borderRadius: radius.sm,
    paddingVertical: 7, width: 38, alignItems: 'center', justifyContent: 'center',
  },

  heartAnchor: {
    position: 'absolute',
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
  suggestionText: { color: colors.text },

  toastAnchor: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(19,78,74,0.94)', borderRadius: radius.pill,
    paddingVertical: 9, paddingHorizontal: 18, alignSelf: 'center',
  },
  toastText: { color: '#fff' },
});
