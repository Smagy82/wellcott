import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from '../../src/components/AppText';
import { ScreenTransition } from '../../src/components/ScreenTransition';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyDollar, CaretRight } from 'phosphor-react-native';
import helpData from '../../assets/financial-help.json';
import type { FinancialHelpOrg } from '../../src/types/financialHelp';
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
        <AppText variant="sectionHead" style={styles.orgName}>{t(`help.org.${org.id}.name`)}</AppText>
        <View style={styles.badge}>
          <AppText variant="chip" style={styles.badgeText}>{t(catKey)}</AppText>
        </View>
      </View>
      <AppText variant="secondary" style={styles.whatItDoes}>{t(`help.org.${org.id}.whatItDoes`)}</AppText>
      <AppText variant="caption" style={styles.whoQualifies}>
        <AppText variant="caption" style={styles.whoLabel}>{t('help.whoLabel')}</AppText>
        {t(`help.org.${org.id}.whoQualifies`)}
      </AppText>
      <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction(org)} activeOpacity={0.82}>
        <AppText variant="button" style={styles.actionBtnText}>{actionLabel()}</AppText>
      </TouchableOpacity>
    </View>
  );
}

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="cardTitle" style={styles.sectionTitle}>{title}</AppText>
      {note ? <AppText variant="caption" style={styles.sectionNote}>{note}</AppText> : null}
    </View>
  );
}

export default function HelpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScreenTransition>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Header — matches Clinics tab pattern: bg #F0FDFA, dark title */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <AppText variant="largeTitle" style={styles.headerTitle}>{t('help.title')}</AppText>
        <AppText variant="secondary" style={styles.headerSub}>{t('help.subtitle')}</AppText>
      </View>

      {/* Costs entry card */}
      <TouchableOpacity style={styles.costsEntry} onPress={() => router.push('/costs')} activeOpacity={0.75}>
        <View style={styles.costsIconBox}>
          <CurrencyDollar weight="fill" size={22} color={colors.tintBlueIcon} />
        </View>
        <View style={styles.costsText}>
          <AppText variant="cardTitle" style={styles.costsTitle}>{t('costs.helpEntryTitle')}</AppText>
          <AppText variant="caption" style={styles.costsSub}>{t('costs.helpEntrySub')}</AppText>
        </View>
        <CaretRight size={18} color={colors.muted} />
      </TouchableOpacity>

      <SectionHeader title={t('help.sectionForYou')} />
      {forUninsured.map((org) => <OrgCard key={org.id} org={org} />)}

      <SectionHeader
        title={t('help.sectionWithInsurance')}
        note={t('help.sectionWithInsuranceNote')}
      />
      {withInsurance.map((org) => <OrgCard key={org.id} org={org} />)}

      {/* 211 — transportation to appointment */}
      <SectionHeader title={t('help.section211Title')} />
      <View style={styles.card}>
        <AppText variant="secondary" style={styles.body211}>{t('help.section211Body')}</AppText>
        <View style={styles.actions211}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL('tel:211')}>
            <AppText variant="button" style={styles.actionBtnText}>{t('help.section211Call')}</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtnOutline211} onPress={() => Linking.openURL('https://www.211.org')}>
            <AppText variant="button" style={styles.actionBtnOutlineText211}>{t('help.section211Site')}</AppText>
          </TouchableOpacity>
        </View>
      </View>

      <AppText variant="caption" style={styles.disclaimer}>{t('help.disclaimer')}</AppText>
    </ScrollView>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 120 },

  // Matches Clinics tab: bg #F0FDFA, dark title, no teal banner
  header: {
    paddingBottom: 20,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {},
  headerSub: { marginTop: 4 },

  sectionHeader: { paddingHorizontal: spacing.lg, paddingTop: 20, paddingBottom: 6 },
  sectionTitle: {},
  sectionNote: { marginTop: 3, lineHeight: 16 },

  card: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: 10,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  orgName: { flex: 1, marginRight: 8 },
  badge: {
    backgroundColor: colors.tagGreenBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeText: { color: colors.tagGreenText },
  whatItDoes: { color: colors.text, lineHeight: 19, marginBottom: 6 },
  whoQualifies: { lineHeight: 17, marginBottom: 12 },
  whoLabel: { fontFamily: font.semibold },

  actionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  actionBtnText: { color: '#fff' },

  costsEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: 4,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 12,
    ...shadow,
  },
  costsIconBox: {
    width: 40, height: 40,
    borderRadius: 10,
    backgroundColor: colors.tintBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  costsText: { flex: 1 },
  costsTitle: { marginBottom: 2 },
  costsSub: {},

  disclaimer: {
    textAlign: 'center',
    marginHorizontal: 24,
    marginTop: 12,
    lineHeight: 16,
  },

  body211: { color: colors.text, lineHeight: 19, marginBottom: 12 },
  actions211: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtnOutline211: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  actionBtnOutlineText211: { color: colors.primary },
});
