import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import helpData from '../../assets/financial-help.json';
import type { FinancialHelpOrg, FinancialHelpCategory } from '../../src/types/financialHelp';

const TINT = '#0F6E56';

const orgs = helpData.organizations as FinancialHelpOrg[];
const forUninsured = orgs.filter((o) => o.bestForUninsured);
const withInsurance = orgs.filter((o) => !o.bestForUninsured);

const CATEGORY_LABELS: Record<FinancialHelpCategory, string> = {
  hospital_bills:       'Hospital bills',
  prescriptions:        'Prescriptions',
  local_referral:       'Local help',
  find_care:            'Find care',
  free_clinics:         'Free clinics',
  government:           'Government',
  copay_disease_specific: 'Copay grants',
  medical_debt:         'Medical debt',
};

function actionLabel(org: FinancialHelpOrg): string {
  if (org.actionType === 'call' && org.phone) return `Call ${org.phone}`;
  return org.actionType === 'apply' ? 'Apply' : 'Open';
}

function handleAction(org: FinancialHelpOrg) {
  if (org.actionType === 'call' && org.phone) {
    Linking.openURL(`tel:${org.phone}`);
  } else if (org.url) {
    Linking.openURL(org.url);
  }
}

function OrgCard({ org }: { org: FinancialHelpOrg }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.orgName}>{org.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{CATEGORY_LABELS[org.category]}</Text>
        </View>
      </View>
      <Text style={styles.whatItDoes}>{org.whatItDoes}</Text>
      <Text style={styles.whoQualifies}>
        <Text style={styles.whoLabel}>Who: </Text>
        {org.whoQualifies}
      </Text>
      <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction(org)}>
        <Text style={styles.actionBtnText}>{actionLabel(org)}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

export default function HelpScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial help</Text>
        <Text style={styles.headerSub}>Help paying for care, medications, and bills.</Text>
      </View>

      <SectionHeader title="For you" />
      {forUninsured.map((org) => (
        <OrgCard key={org.id} org={org} />
      ))}

      <SectionHeader
        title="If you have insurance"
        note="These usually require insurance and a specific diagnosis."
      />
      {withInsurance.map((org) => (
        <OrgCard key={org.id} org={org} />
      ))}

      <Text style={styles.disclaimer}>
        Verify contact details before calling — programs change. Not a medical or legal referral.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F7F9F8' },
  content: { paddingBottom: 48 },

  header: {
    backgroundColor: TINT,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },

  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  sectionNote: { fontSize: 12, color: '#888', marginTop: 3, lineHeight: 16 },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  orgName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111', marginRight: 8 },
  badge: {
    backgroundColor: '#E6F4EF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#085041' },
  whatItDoes: { fontSize: 13, color: '#333', lineHeight: 19, marginBottom: 6 },
  whoQualifies: { fontSize: 12, color: '#777', lineHeight: 17, marginBottom: 12 },
  whoLabel: { fontWeight: '600', color: '#555' },

  actionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: TINT,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  disclaimer: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginHorizontal: 24,
    marginTop: 12,
    lineHeight: 16,
  },
});
