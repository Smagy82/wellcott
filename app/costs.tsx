import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../src/components/Text';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Calculator, CaretRight, Lightbulb } from 'phosphor-react-native';
import { theme } from '../src/theme';

const { colors, font, radius, spacing, shadow } = theme;

type CostItem = {
  categoryKey: string;
  priceKey: string;
  priceExtraKey?: string;
  descKey: string;
};

const COST_ITEMS: CostItem[] = [
  {
    categoryKey: 'costs.primaryCareTitle',
    priceKey:    'costs.primaryCarePrice',
    descKey:     'costs.primaryCareSub',
  },
  {
    categoryKey:   'costs.labsTitle',
    priceKey:      'costs.labsPrice',
    priceExtraKey: 'costs.labsPriceExtra',
    descKey:       'costs.labsSub',
  },
  {
    categoryKey: 'costs.fqhcTitle',
    priceKey:    'costs.fqhcPrice',
    descKey:     'costs.fqhcSub',
  },
];

export default function CostsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <>
      <ScreenHeader title={t('costs.navTitle')} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Intro — plain text, no card */}
        <Text style={styles.intro}>{t('costs.subtitle')}</Text>

        {/* Dark banner — Estimator entry */}
        <TouchableOpacity
          style={styles.darkBanner}
          onPress={() => router.push('/sliding-scale')}
          activeOpacity={0.88}
        >
          <Calculator size={26} weight="fill" color="#5EEAD4" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{t('costs.estimatorEntry')}</Text>
            <Text style={styles.bannerSub}>{t('costs.estimatorEntrySub')}</Text>
          </View>
          <CaretRight size={18} color="#5EEAD4" />
        </TouchableOpacity>

        {/* Cost cards */}
        {COST_ITEMS.map((item) => (
          <View key={item.categoryKey} style={styles.costCard}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{t(item.categoryKey)}</Text>
            </View>
            <Text style={styles.costPrice}>{t(item.priceKey)}</Text>
            {item.priceExtraKey ? (
              <Text style={styles.priceExtra}>{t(item.priceExtraKey)}</Text>
            ) : null}
            <Text style={styles.costDesc}>{t(item.descKey)}</Text>
          </View>
        ))}

        {/* Why this matters */}
        <View style={styles.whyCard}>
          <Lightbulb size={20} weight="fill" color={colors.warningIcon} style={{ marginBottom: 8 }} />
          <Text style={styles.whyTitle}>{t('costs.whyTitle')}</Text>
          <Text style={styles.whyBody}>{t('costs.whyBody')}</Text>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>{t('costs.disclaimer')}</Text>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: 12, paddingBottom: 48 },

  intro: {
    fontFamily: font.regular,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 2,
  },

  darkBanner: {
    backgroundColor: '#134E4A',
    borderRadius: 16,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...shadow,
  },
  bannerTitle: {
    fontFamily: font.bold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  bannerSub: {
    fontFamily: font.regular,
    fontSize: 12,
    color: '#99F6E4',
    lineHeight: 17,
  },

  costCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    ...shadow,
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: '#CCFBF1',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 10,
  },
  chipText: {
    fontFamily: font.bold,
    fontSize: 10,
    color: '#0F766E',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  costPrice: {
    fontFamily: font.bold,
    fontSize: 27,
    color: colors.primary,
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  priceExtra: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: '#64748B',
    lineHeight: 20,
    marginTop: 2,
    marginBottom: 6,
  },
  costDesc: {
    fontFamily: font.regular,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginTop: 6,
  },

  whyCard: {
    backgroundColor: colors.warningBg,
    borderRadius: 16,
    padding: spacing.lg,
  },
  whyTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.warningText,
    marginBottom: 6,
  },
  whyBody: {
    fontFamily: font.regular,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 22,
  },

  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11.5,
    color: '#8CA3A0',
    lineHeight: 17,
    textAlign: 'center',
    marginHorizontal: 8,
    marginTop: 4,
  },
});
