import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useNearbyClinics } from '../../src/lib/useNearbyClinics';
import { searchClinicsByText } from '../../src/lib/clinicSearch';
import { getDb } from '../../src/lib/database';
import type { ClinicWithDistance } from '../../src/types/clinic';

const TINT = '#0F6E56';
const RADII = [10, 25, 50] as const;
type Radius = typeof RADII[number];

// ── Card ─────────────────────────────────────────────────────────────────────

function ClinicCard({ item }: { item: ClinicWithDistance }) {
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
      onPress={() => router.push(`/clinic/${encodeURIComponent(item.id)}`)}
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
          <View style={[styles.badge, styles.badgeGreen]}>
            <Text style={styles.badgeText}>Accepts uninsured</Text>
          </View>
        )}
        {item.slidingScale && (
          <View style={[styles.badge, styles.badgeBlue]}>
            <Text style={styles.badgeText}>Sliding scale</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {item.phone ? (
          <TouchableOpacity
            style={styles.btn}
            onPress={(e) => { e.stopPropagation?.(); handleCall(); }}
          >
            <Text style={styles.btnText}>Call</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.btn, styles.btnOutline]}
          onPress={(e) => { e.stopPropagation?.(); handleDirections(); }}
        >
          <Text style={[styles.btnText, styles.btnOutlineText]}>Directions</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

// ── Search + filter bar ───────────────────────────────────────────────────────

function SearchBar({
  value,
  onChange,
  placeholder = 'Search by name or city…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      style={styles.searchInput}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#aaa"
      clearButtonMode="while-editing"
      returnKeyType="search"
      autoCorrect={false}
    />
  );
}

function RadiusChips({
  selected,
  onSelect,
}: {
  selected: Radius;
  onSelect: (r: Radius) => void;
}) {
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
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {r} mi
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ClinicsScreen() {
  const [radius, setRadius] = useState<Radius>(25);
  const [query, setQuery] = useState('');
  const [textResults, setTextResults] = useState<ClinicWithDistance[]>([]);

  const { clinics, status, retry } = useNearbyClinics(radius);

  // Text search against DB (used when no-permission or explicit query)
  const runTextSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setTextResults([]); return; }
    try {
      const db = await getDb();
      const results = await searchClinicsByText(db, q, 50);
      setTextResults(results);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // When no-permission: search DB by city/name on query change
  useEffect(() => {
    if (status === 'no-permission') runTextSearch(query);
  }, [query, status, runTextSearch]);

  // Client-side filter when geo is ready
  const filtered = useMemo(() => {
    if (status !== 'ready' || !query.trim()) return clinics;
    const q = query.toLowerCase();
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q),
    );
  }, [clinics, query, status]);

  const requestLocation = async () => {
    await Location.requestForegroundPermissionsAsync();
    retry();
  };

  // ── No-permission screen ──────────────────────────────────────────────────
  if (status === 'no-permission') {
    const hasQuery = query.trim().length > 0;
    return (
      <View style={styles.flex}>
        <View style={styles.listTop}>
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Enter city or ZIP…"
          />
        </View>

        {hasQuery ? (
          <FlatList
            data={textResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ClinicCard item={item} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.statusText}>No clinics found for "{query}".</Text>
            }
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.permTitle}>Location is off</Text>
            <Text style={styles.statusText}>
              Turn on location, or search by city above.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestLocation}>
              <Text style={styles.primaryBtnText}>Enable location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={TINT} />
        <Text style={styles.statusText}>Finding clinics near you…</Text>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Something went wrong</Text>
        <Text style={styles.statusText}>Pull to retry.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={retry}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  const isSearching = query.trim().length > 0;
  const displayList = filtered;

  const ListTop = (
    <View style={styles.listTop}>
      <SearchBar value={query} onChange={setQuery} />
      <RadiusChips selected={radius} onSelect={(r) => { setRadius(r); setQuery(''); }} />
      {!isSearching && (
        <Text style={styles.listHeader}>
          {displayList.length} clinics within {radius} miles
        </Text>
      )}
    </View>
  );

  return (
    <FlatList
      data={displayList}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ClinicCard item={item} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={ListTop}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <Text style={styles.statusText}>
          {isSearching
            ? `No results for "${query}".`
            : `No clinics within ${radius} miles. Try a larger radius or search by city.`}
        </Text>
      }
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F7F9F8' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F9F8',
  },
  permTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 6 },
  statusText: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 18 },
  primaryBtn: {
    backgroundColor: TINT,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  listTop: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111',
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: TINT,
  },
  chipActive: { backgroundColor: TINT },
  chipText: { fontSize: 13, color: TINT, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  listHeader: { fontSize: 12, color: '#888', marginBottom: 6, marginLeft: 2 },

  list: { paddingHorizontal: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  clinicName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginRight: 8,
  },
  distance: { fontSize: 13, color: TINT, fontWeight: '600', flexShrink: 0 },
  address: { fontSize: 13, color: '#555', marginBottom: 8 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGreen: { backgroundColor: '#E6F4EF' },
  badgeBlue: { backgroundColor: '#E6EFF8' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#333' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    backgroundColor: TINT,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: TINT,
  },
  btnOutlineText: { color: TINT },
});
