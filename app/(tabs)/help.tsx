import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import helpData from '../../assets/financial-help.json';
import type { FinancialHelpOrg, FinancialHelpCategory } from '../../src/types/financialHelp';
import { theme } from '../../src/theme';

const { colors, radius, font, shadow, spacing } = theme;

const orgs = helpData.organizations as FinancialHelpOrg[];
const forUninsured  = orgs.filter((o) => o.bestForUninsured);
const withInsurance = orgs.filter((o) => !o.bestForUninsured);

function handleAction(org: FinancialHelpOrg) {
  if (org.actionType === 'call' && org.phone) {
    Linking.openURL(`tel:${org.phone}`);
  } else if (org.url) {
    Linking.openURL(org.url);
  }
}

function OrgCard({ org }: { org: FinancialHelpOrg }) {
  const { t } = useTranslation();

  const catKey = `help.cat_${org.category}` as const;
  const actionLabel = (): string => {
    if (org.actionType === 'call' && org.phone) return t('help.actionCall', { phone: org.phone });
    return org.actionType === 'apply' ? t('help.actionApply') : t('help.actionOpen');
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.orgName}>{org.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t(catKey)}</Text>
        </View>
      </View>
      <Text style={styles.whatItDoes}>{org.whatItDoes}</Text>
      <Text style={styles.whoQualifies}>
        <Text style={styles.whoLabel}>{t('help.whoLabel')}</Text>
        {org.whoQualifies}
      </Text>
      <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction(org)}>
        <Text style={styles.actionBtnText}>{actionLabel()}</Text>
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
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('help.title')}</Text>
        <Text style={styles.headerSub}>{t('help.subtitle')}</Text>
      </View>

      {/* Costs entry */}
      <TouchableOpacity style={styles.costsEntry} onPress={() => router.push('/costs')} activeOpacity={0.75}>
        <View style={styles.costsIconBox}>
          <Ionicons name="cash-outline" size={22} color={colors.tintYellowIcon} />
        </View>
        <View style={styles.costsText}>
          <Text style={styles.costsTitle}>{t('costs.helpEntryTitle')}</Text>
          <Text style={styles.costsSub}>{t('costs.helpEntrySub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <SectionHeader title={t('help.sectionForYou')} />
      {forUninsured.map((org) => <OrgCard key={org.id} org={org} />)}

      <SectionHeader
        title={t('help.sectionWithInsurance')}
        note={t('help.sectionWithInsuranceNote')}
      />
      {withInsurance.map((org) => <OrgCard key={org.id} org={org} />)}

      <Text style={styles.disclaimer}>{t('help.disclaimer')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },

  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.lg,
    paddingBottom: 20,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: { fontFamily: font.bold, color: '#fff', fontSize: 22 },
  headerSub: { fontFamily: font.regular, color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },

  sectionHeader: { paddingHorizontal: spacing.lg, paddingTop: 20, paddingBottom: 6 },
  sectionTitle: { fontFamily: font.bold, fontSize: 16, color: colors.text },
  sectionNote: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 16 },

  card: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: 10,
    borderRadius: radius.md,
    padding: 14,
    ...shadow,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  orgName: { fontFamily: font.semibold, flex: 1, fontSize: 15, color: colors.text, marginRight: 8 },
  badge: {
    backgroundColor: colors.tintMint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeText: { fontFamily: font.semibold, fontSize: 11, color: colors.tintMintIcon },
  whatItDoes: { fontFamily: font.regular, fontSize: 13, color: colors.text, lineHeight: 19, marginBottom: 6 },
  whoQualifies: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: 12 },
  whoLabel: { fontFamily: font.semibold, color: colors.textMuted },

  actionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  actionBtnText: { fontFamily: font.semibold, color: '#fff', fontSize: 13 },

  costsEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: 4,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 12,
    ...shadow,
  },
  costsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.tintYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  costsText: { flex: 1 },
  costsTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.text, marginBottom: 2 },
  costsSub:   { fontFamily: font.regular,  fontSize: 12, color: colors.textMuted },

  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginHorizontal: 24,
    marginTop: 12,
    lineHeight: 16,
  },
});
