import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Copy, Check, CaretRight } from 'phosphor-react-native';
import * as Clipboard from 'expo-clipboard';
import { Text } from '../src/components/Text';
import { theme } from '../src/theme';

const { colors, font, radius, spacing, shadow } = theme;

export default function GoodFaithEstimateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(t('gfe.script.body'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('gfe.navTitle') }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >

        {/* 1. Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('gfe.hero.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('gfe.hero.subtitle')}</Text>
        </View>

        {/* 2. What is a GFE */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('gfe.what.title')}</Text>
          {(['b1', 'b2', 'b3', 'b4', 'b5'] as const).map(k => (
            <View key={k} style={styles.bulletRow}>
              <Text style={styles.bullet}>·</Text>
              <Text style={styles.bulletText}>{t(`gfe.what.${k}`)}</Text>
            </View>
          ))}
        </View>

        {/* 3. How to get one */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('gfe.how.title')}</Text>
          {([1, 2, 3] as const).map(n => (
            <View key={n} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{n}</Text>
              </View>
              <Text style={styles.stepText}>{t(`gfe.how.step${n}`)}</Text>
            </View>
          ))}
        </View>

        {/* 4. Timing table */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('gfe.timing.title')}</Text>
          {([1, 2, 3] as const).map((n, i) => (
            <View key={n} style={[styles.tableRow, i > 0 && styles.tableRowBorder]}>
              <Text style={styles.tableLabel}>{t(`gfe.timing.row${n}.label`)}</Text>
              <Text style={styles.tableValue}>{t(`gfe.timing.row${n}.value`)}</Text>
            </View>
          ))}
          <Text style={styles.tableNote}>{t('gfe.timing.note')}</Text>
        </View>

        {/* 5. Script card */}
        <View style={styles.scriptCard}>
          <Text style={styles.scriptTitle}>{t('gfe.script.title')}</Text>
          <View style={styles.quoteBlock}>
            <Text style={styles.quoteText}>{t('gfe.script.body')}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={handleCopy}
              activeOpacity={0.7}
            >
              {copied
                ? <Check size={15} color={colors.tintBlueIcon} />
                : <Copy size={15} color={colors.tintBlueIcon} />}
              <Text style={styles.copyBtnText}>
                {copied ? t('gfe.script.copied') : t('gfe.script.copy')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.ifAskedLabel}>{t('gfe.script.ifAsked')}</Text>
          <Text style={styles.ifAskedBody}>{t('gfe.script.ifAskedBody')}</Text>
          <Text style={styles.scriptNote}>{t('gfe.script.ask2')}</Text>
        </View>

        {/* 6. FQHC note */}
        <View style={styles.fqhcCard}>
          <Text style={styles.fqhcTitle}>{t('gfe.fqhc.title')}</Text>
          <Text style={styles.fqhcBody}>{t('gfe.fqhc.body1')}</Text>
          <Text style={styles.fqhcBody}>{t('gfe.fqhc.body2')}</Text>
          <TouchableOpacity
            style={styles.fqhcCtaBtn}
            onPress={() => router.push('/sliding-scale')}
            activeOpacity={0.8}
          >
            <Text style={styles.fqhcCtaText}>{t('gfe.fqhc.cta')}</Text>
            <CaretRight size={14} color={colors.tintPeachIcon} />
          </TouchableOpacity>
        </View>

        {/* 7. Dispute rights */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('gfe.dispute.title')}</Text>
          {(['b1', 'b2', 'b3', 'b4'] as const).map(k => (
            <View key={k} style={styles.bulletRow}>
              <Text style={styles.bullet}>·</Text>
              <Text style={styles.bulletText}>{t(`gfe.dispute.${k}`)}</Text>
            </View>
          ))}

          {/* b5 — phone + URL */}
          <View style={styles.bulletRow}>
            <Text style={styles.bullet}>·</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bulletText}>{t('gfe.dispute.b5')}</Text>
              <View style={styles.disputeLinks}>
                <TouchableOpacity onPress={() => Linking.openURL('tel:18009853059')}>
                  <Text style={styles.linkText}>{t('gfe.dispute.b5Phone')}</Text>
                </TouchableOpacity>
                <Text style={styles.disputeLinkSep}> · </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://www.cms.gov/medical-bill-rights')}
                >
                  <Text style={styles.linkText}>{t('gfe.dispute.b5Site')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.bulletRow}>
            <Text style={styles.bullet}>·</Text>
            <Text style={styles.bulletText}>{t('gfe.dispute.b6')}</Text>
          </View>
        </View>

        {/* 8. Disclaimer */}
        <Text style={styles.disclaimer}>{t('gfe.disclaimer')}</Text>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: 12, paddingBottom: 48 },

  // Hero
  hero: {
    backgroundColor: colors.tintYellow,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  heroTitle: {
    fontFamily: font.bold,
    fontSize: 20,
    color: colors.tintYellowIcon,
    marginBottom: 6,
    lineHeight: 26,
  },
  heroSubtitle: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },

  // Generic white card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 10,
    ...shadow,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 2,
  },

  // Bullets
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: {
    fontFamily: font.bold,
    fontSize: 20,
    color: colors.primary,
    lineHeight: 22,
    marginTop: -1,
  },
  bulletText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
    flex: 1,
  },

  // Numbered steps (matches sliding-scale pattern)
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { fontFamily: font.bold, fontSize: 13, color: '#fff' },
  stepText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
    flex: 1,
  },

  // Timing table
  tableRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 9,
  },
  tableRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.tintBlue,
  },
  tableLabel: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    flex: 2,
  },
  tableValue: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.primary,
    lineHeight: 18,
    flex: 1,
    textAlign: 'right',
  },
  tableNote: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: 4,
  },

  // Script card (tintBlue)
  scriptCard: {
    backgroundColor: colors.tintBlue,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 12,
    ...shadow,
  },
  scriptTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.tintBlueIcon,
  },
  quoteBlock: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 10,
  },
  quoteText: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: colors.tintBlue,
    borderRadius: radius.sm,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  copyBtnText: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.tintBlueIcon,
  },
  ifAskedLabel: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.tintBlueIcon,
  },
  ifAskedBody: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  scriptNote: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.tintBlueIcon,
    lineHeight: 18,
  },

  // FQHC card (tintPeach)
  fqhcCard: {
    backgroundColor: colors.tintPeach,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.tintPeachIcon,
    ...shadow,
  },
  fqhcTitle: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.tintPeachIcon,
  },
  fqhcBody: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  fqhcCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginTop: 2,
  },
  fqhcCtaText: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.tintPeachIcon,
  },

  // Dispute links
  disputeLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 3,
  },
  disputeLinkSep: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  linkText: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.primary,
  },

  // Disclaimer
  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 17,
    textAlign: 'center',
    marginHorizontal: 8,
    marginTop: 4,
  },
});
