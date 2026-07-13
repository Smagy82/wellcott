import {
  ActivityIndicator,
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
import { Ionicons } from '@expo/vector-icons';
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
type Radius = typeof RADII[number];

// ── Card ─────────────────────────────────────────────────────────────────────

function ClinicCard({
  item,
  onShare,
  isShareGuarded,
}: {
  item: ClinicWithDistance;
  onShare: (item: ClinicWithDistance) => void;
  isShareGuarded: () => boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const handleCall = () => {
    if (item.phone) Linking.openURL(`tel:${item.phone}`);
  };

  const handleDirections = () => {
    const q = encodeURIComponent(`${item.address}, ${item.city}, ${item.state} ${item.zip}`);
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  const showDistance = Number.isFinite(item.distanceMiles);

  return (
    <Pressable
      style={styles.card}
      onPress={() => { if (isShareGuarded()) return; router.push(`/clinic/${encodeURIComponent(item.id)}`); }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.clinicName} numberOfLines={2}>{item.name}</Text>
        {showDistance && (
          <Text style={styles.distance}>{item.distanceMiles.toFixed(1)} mi</Text>
        )}
      </View>

      <Text style={styles.address}>
        {item.address}, {item.city}, {item.state} {item.zip}
      </Text>

      <View style={styles.badges}>
        {item.acceptsUninsured && (
          <View style={[styles.badge, styles.badgeMint]}>
            <Text style={[styles.badgeText, { color: colors.tintMintIcon }]}>{t('clinicList.acceptsUninsured')}</Text>
          </View>
        )}
        {item.slidingScale && (
          <View style={[styles.badge, styles.badgeBlue]}>
            <Text style={[styles.badgeText, { color: colors.tintBlueIcon }]}>{t('clinicList.slidingScale')}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {item.phone ? (
          <TouchableOpacity
            style={styles.btnFill}
            onPress={(e) => { e.stopPropagation?.(); handleCall(); }}
          >
            <Text style={styles.btnFillText}>{t('common.call')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={(e) => { e.stopPropagation?.(); handleDirections(); }}
        >
          <Text style={styles.btnOutlineText}>{t('common.directions')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnShare}
          onPress={(e) => { e.stopPropagation?.(); onShare(item); }}
          accessibilityLabel={t('share.buttonA11y')}
        >
          <Ionicons name="share-outline" size={17} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

// ── Search + chips ────────────────────────────────────────────────────────────

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  return (
    <TextInput
      style={styles.searchInput}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder ?? t('clinicList.searchPlaceholder')}
      placeholderTextColor={colors.textMuted}
      clearButtonMode="while-editing"
      returnKeyType="search"
      autoCorrect={false}
    />
  );
}

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
          <Ionicons name="location-outline" size={14} color={colors.primary} style={styles.suggestionIcon} />
          <Text style={styles.suggestionText}>{s.city}, {s.state}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RadiusChips({ selected, onSelect }: { selected: Radius; onSelect: (r: Radius) => void }) {
  return (
    <View style={styles.chips}>
      {RADII.map((r) => {
        const active = r === selected;
        return (
          <TouchableOpacity
            key={r}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(r)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{r} mi</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ClinicsScreen() {
  const { t } = useTranslation();
  const [radius, setRadius] = useState<Radius>(25);
  const [query, setQuery] = useState('');
  const [textResults, setTextResults] = useState<ClinicWithDistance[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { clinics, status, retry } = useNearbyClinics(radius);

  const runTextSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setTextResults([]); return; }
    try {
      const db = await getDb();
      const results = await searchClinicsByText(db, q, 100);
      setTextResults(results);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    runTextSearch(query);
  }, [query, runTextSearch]);

  useEffect(() => {
    if (!showSuggestions || query.trim().length < 2) {
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
  }, [query, showSuggestions]);

  const shareJustClosedAt = useRef(0);

  const handleClinicShare = (clinic: ClinicWithDistance) => {
    shareClinic(
      clinic,
      t,
      () => { shareJustClosedAt.current = Date.now(); }, // метка ДО открытия sheet
    ).then(() => { shareJustClosedAt.current = Date.now(); }); // метка после закрытия
  };

  const isShareGuarded = () => Date.now() - shareJustClosedAt.current < SHARE_GHOST_GUARD_MS;

  const handleQueryChange = (v: string) => {
    setQuery(v);
    setShowSuggestions(true);
  };

  const handleSuggestionSelect = (s: CitySuggestion) => {
    setQuery(s.city);
    setShowSuggestions(false);
    setCitySuggestions([]);
    Keyboard.dismiss();
  };

  // Если есть поисковый запрос — показываем результаты по всей базе (без радиуса).
  // Если пусто — показываем клиники в радиусе от геолокации.
  const filtered = useMemo(() => {
    if (query.trim()) return textResults;
    return clinics;
  }, [clinics, query, textResults]);

  const requestLocation = async () => {
    await Location.requestForegroundPermissionsAsync();
    retry();
  };

  if (status === 'no-permission') {
    const hasQuery = query.trim().length > 0;
    return (
      <View style={styles.flex}>
        <View style={styles.listTop}>
          <SearchBar
            value={query}
            onChange={handleQueryChange}
            placeholder={t('clinicList.searchPlaceholderCity')}
          />
          <SuggestionList suggestions={citySuggestions} onSelect={handleSuggestionSelect} />
        </View>
        {hasQuery ? (
          <FlatList
            data={textResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ClinicCard item={item} onShare={handleClinicShare} isShareGuarded={isShareGuarded} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.statusText}>{t('clinicList.noLocationResults', { query })}</Text>
            }
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

  const ListTop = (
    <View style={styles.listTop}>
      <SearchBar value={query} onChange={handleQueryChange} />
      <SuggestionList suggestions={citySuggestions} onSelect={handleSuggestionSelect} />
      <RadiusChips selected={radius} onSelect={(r) => { setRadius(r); setQuery(''); setShowSuggestions(false); }} />
      {!isSearching && (
        <Text style={styles.listHeader}>
          {t('clinicList.clinicsNearby', { count: filtered.length, radius })}
        </Text>
      )}
      <PrescriptionSavingsBanner isShareGuarded={isShareGuarded} />
    </View>
  );

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ClinicCard item={item} onShare={handleClinicShare} isShareGuarded={isShareGuarded} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={ListTop}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <Text style={styles.statusText}>
          {isSearching
            ? t('clinicList.noResultsForQuery', { query })
            : t('clinicList.noClinicsInRadius', { radius })}
        </Text>
      }
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
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

  listTop: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  searchInput: {
    fontFamily: font.regular,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E4EAF0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
    ...shadow,
  },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },
  chipTextActive: { color: '#fff' },
  listHeader: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, marginBottom: 6, marginLeft: 2 },

  list: { paddingHorizontal: spacing.lg, paddingBottom: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    ...shadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  clinicName: { fontFamily: font.semibold, flex: 1, fontSize: 15, color: colors.text, marginRight: 8 },
  distance: { fontFamily: font.semibold, fontSize: 13, color: colors.primary, flexShrink: 0 },
  address: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeMint: { backgroundColor: colors.tintMint },
  badgeBlue: { backgroundColor: colors.tintBlue },
  badgeText: { fontFamily: font.semibold, fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8 },
  btnFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  btnFillText: { fontFamily: font.semibold, color: '#fff', fontSize: 13 },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  btnOutlineText: { fontFamily: font.semibold, color: colors.primary, fontSize: 13 },
  btnShare: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 7,
    width: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  suggestions: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: 8,
    overflow: 'hidden',
    ...shadow,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4EAF0',
  },
  suggestionIcon: { marginRight: 8 },
  suggestionText: { fontFamily: font.regular, fontSize: 14, color: colors.text },
});
