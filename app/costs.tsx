import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../src/components/Text';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';

const { colors, font, radius, spacing, shadow } = theme;

type CostItem = {
  titleKey: string;
  priceKey: string;
  subKey: string;
  bg: string;
  priceColor: string;
};

const COST_ITEMS: CostItem[] = [
  {
    titleKey: 'costs.primaryCareTitle',
    priceKey: 'costs.primaryCarePrice',
    subKey:   'costs.primaryCareSub',
    bg:         colors.tintYellow,
    priceColor: colors.tintYellowIcon,
  },
  {
    titleKey: 'costs.labsTitle',
    priceKey: 'costs.labsPrice',
    subKey:   'costs.labsSub',
    bg:         colors.tintBlue,
    priceColor: colors.tintBlueIcon,
  },
  {
    titleKey: 'costs.fqhcTitle',
    priceKey: 'costs.fqhcPrice',
    subKey:   'costs.fqhcSub',
    bg:         colors.tintMint,
    priceColor: colors.tintMintIcon,
  },
];

export default function CostsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: t('costs.navTitle') }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Subtitle / honesty note */}
        <View style={styles.subtitleCard}>
          <Text style={styles.screenTitle}>{t('costs.title')}</Text>
          <Text style={styles.subtitle}>{t('costs.subtitle')}</Text>
        </View>

        {/* Estimator entry */}
        <TouchableOpacity style={styles.estimatorCard} onPress={() => router.push('/sliding-scale')}>
          <View style={styles.estimatorIconBox}>
            <Ionicons name="calculator-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.estimatorTitle}>{t('costs.estimatorEntry')}</Text>
            <Text style={styles.estimatorSub}>{t('costs.estimatorEntrySub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.tintBlueIcon} />
        </TouchableOpacity>

        {/* Cost cards */}
        {COST_ITEMS.map((item) => (
          <View key={item.titleKey} style={[styles.costCard, { backgroundColor: item.bg }]}>
            <Text style={styles.costTitle}>{t(item.titleKey)}</Text>
            <Text style={[styles.costPrice, { color: item.priceColor }]}>{t(item.priceKey)}</Text>
            <Text style={styles.costSub}>{t(item.subKey)}</Text>
          </View>
        ))}

        {/* Contrast block — Why this matters */}
        <View style={styles.contrastCard}>
          <Text style={styles.contrastTitle}>{t('costs.whyTitle')}</Text>
          <Text style={styles.contrastBody}>{t('costs.whyBody')}</Text>
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

  subtitleCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  screenTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },

  costCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  costTitle: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.text,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  costPrice: {
    fontFamily: font.bold,
    fontSize: 26,
    marginBottom: 8,
    lineHeight: 32,
  },
  costSub: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },

  contrastCard: {
    backgroundColor: colors.tintPeach,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.tintPeachIcon,
  },
  contrastTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.tintPeachIcon,
    marginBottom: 8,
  },
  contrastBody: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },

  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 17,
    textAlign: 'center',
    marginHorizontal: 8,
    marginTop: 4,
  },

  estimatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tintBlue,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 12,
    ...shadow,
  },
  estimatorIconBox: {
    width: 44, height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  estimatorTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.tintBlueIcon, marginBottom: 2 },
  estimatorSub: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted },
});
