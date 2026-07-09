import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDb } from '../../src/lib/database';
import { getClinicById } from '../../src/lib/clinicSearch';
import type { Clinic } from '../../src/types/clinic';

const TINT = '#0F6E56';
const TRUST_BG = '#E1F5EE';
const TRUST_TEXT = '#085041';

export default function ClinicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        const result = await getClinicById(db, decodeURIComponent(id ?? ''));
        setClinic(result);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={TINT} />
      </View>
    );
  }

  if (!clinic) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Clinic not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hours: string[] = (() => {
    if (!clinic.hoursJson) return [];
    try { return JSON.parse(clinic.hoursJson) as string[]; }
    catch { return []; }
  })();

  const handleCall = () => {
    if (clinic.phone) Linking.openURL(`tel:${clinic.phone}`);
  };

  const handleDirections = () => {
    const q = encodeURIComponent(`${clinic.address}, ${clinic.city}, ${clinic.state} ${clinic.zip}`);
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLabel}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerName}>{clinic.name}</Text>
        {clinic.siteType ? (
          <Text style={styles.headerType}>{clinic.siteType}</Text>
        ) : null}
      </View>

      {/* Trust badge */}
      <View style={styles.trustBadge}>
        <Text style={styles.trustTitle}>Accepts patients without insurance</Text>
        <Text style={styles.trustSub}>
          You pay on a sliding scale based on your income. You can't be turned away for inability to pay.
        </Text>
      </View>

      {/* Info section */}
      <View style={styles.section}>
        <InfoRow label="Address">
          {clinic.address}, {clinic.city}, {clinic.state} {clinic.zip}
        </InfoRow>

        {clinic.phone ? (
          <InfoRow label="Phone">{clinic.phone}</InfoRow>
        ) : null}

        {clinic.website ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Website</Text>
            <Text
              style={[styles.rowValue, styles.link]}
              onPress={() => Linking.openURL(clinic.website!)}
            >
              {clinic.website}
            </Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Hours</Text>
          {hours.length > 0 ? (
            hours.map((line) => (
              <Text key={line} style={styles.rowValue}>{line}</Text>
            ))
          ) : (
            <Text style={styles.rowValue}>Call to confirm hours.</Text>
          )}
        </View>
      </View>

      {/* Can't afford care */}
      <View style={styles.helpBlock}>
        <Text style={styles.helpTitle}>Can't afford care?</Text>
        <Text style={styles.helpBody}>
          Ask their patient financial services, or get help finding assistance.
        </Text>
        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => router.push('/(tabs)/help')}
        >
          <Text style={styles.helpBtnText}>Financial help</Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {clinic.phone ? (
          <TouchableOpacity style={[styles.btn, styles.btnFill]} onPress={handleCall}>
            <Text style={styles.btnFillText}>Call</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={handleDirections}>
          <Text style={styles.btnOutlineText}>Directions</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        Prices and services vary — always call ahead. Information is for reference only.
      </Text>
    </ScrollView>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F7F9F8' },
  content: { paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 15, color: '#555', marginBottom: 16 },

  header: {
    backgroundColor: TINT,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backRow: { marginBottom: 10 },
  backLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  headerName: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 26 },
  headerType: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },

  trustBadge: {
    backgroundColor: TRUST_BG,
    margin: 16,
    borderRadius: 10,
    padding: 14,
  },
  trustTitle: { color: TRUST_TEXT, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  trustSub: { color: TRUST_TEXT, fontSize: 13, lineHeight: 18 },

  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  rowLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowValue: { fontSize: 14, color: '#111', lineHeight: 20 },
  link: { color: TINT, textDecorationLine: 'underline' },

  helpBlock: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  helpTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 4 },
  helpBody: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 10 },
  helpBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: TINT,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  helpBtnText: { color: TINT, fontSize: 13, fontWeight: '600' },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnFill: { backgroundColor: TINT },
  btnFillText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnOutline: { borderWidth: 1.5, borderColor: TINT },
  btnOutlineText: { color: TINT, fontSize: 15, fontWeight: '700' },

  backBtn: { marginTop: 12 },
  backBtnText: { color: TINT, fontSize: 14 },

  disclaimer: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginHorizontal: 24,
    lineHeight: 16,
  },
});
