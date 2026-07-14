import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText } from '../../src/components/AppText';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getDb } from '../../src/lib/database';
import { getMhById } from '../../src/lib/mentalHealthSearch';
import type { MhFacility } from '../../src/types/mentalHealth';
import { theme } from '../../src/theme';
import { Crisis988Card } from '../../src/components/Crisis988Card';

const { colors, radius, font, shadow, spacing } = theme;

export default function MhDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [facility, setFacility] = useState<MhFacility | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        const result = await getMhById(db, decodeURIComponent(id ?? ''));
        setFacility(result);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!facility) {
    return (
      <View style={styles.center}>
        <AppText variant="body" style={styles.errorText}>{t('mh.notFound')}</AppText>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <AppText variant="button" style={styles.backBtnText}>{t('common.back')}</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  const speaksSpanish = facility.languages?.toLowerCase().includes('spanish') ?? false;

  const handleCall = () => {
    if (facility.phone) Linking.openURL(`tel:${facility.phone}`);
  };

  const handleDirections = () => {
    const parts = [facility.street1, facility.city, facility.state, facility.zip].filter(Boolean);
    const q = encodeURIComponent(parts.join(', '));
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: facility.name1 }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <AppText variant="secondary" style={styles.backLabel}>{t('common.back')}</AppText>
          </TouchableOpacity>
          <AppText variant="heading" style={styles.headerName}>{facility.name1}</AppText>
          {facility.name2 ? (
            <AppText variant="secondary" style={styles.headerName2}>{facility.name2}</AppText>
          ) : null}
        </View>

        {/* Se habla español badge */}
        {speaksSpanish ? (
          <View style={styles.spanishWrap}>
            <View style={styles.spanishBadge}>
              <AppText variant="chip" style={styles.spanishText}>{t('mh.spanish')}</AppText>
            </View>
          </View>
        ) : null}

        {/* Payment badges */}
        {(facility.hasSlidingFee || facility.hasPayAssist) ? (
          <View style={styles.badgesWrap}>
            {facility.hasSlidingFee ? (
              <View style={[styles.badge, { backgroundColor: colors.tagGreenBg }]}>
                <AppText variant="chip" style={[styles.badgeText, { color: colors.tagGreenText }]}>
                  {t('mh.badgeSlidingFee')}
                </AppText>
              </View>
            ) : null}
            {facility.hasPayAssist && !facility.hasSlidingFee ? (
              <View style={[styles.badge, { backgroundColor: colors.tagTealBg }]}>
                <AppText variant="chip" style={[styles.badgeText, { color: colors.tagTealText }]}>
                  {t('mh.badgePayAssist')}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Info section */}
        <View style={styles.section}>
          {(facility.street1 || facility.city) ? (
            <InfoRow label={t('mh.labelAddress')}>
              {[facility.street1, facility.city, facility.state, facility.zip].filter(Boolean).join(', ')}
            </InfoRow>
          ) : null}
          {facility.phone ? (
            <InfoRow label={t('mh.labelPhone')}>{facility.phone}</InfoRow>
          ) : null}
          {facility.website ? (
            <View style={styles.row}>
              <AppText variant="caption" style={styles.rowLabel}>{t('mh.labelWebsite')}</AppText>
              <AppText
                variant="body"
                style={[styles.rowValue, styles.link]}
                onPress={() => Linking.openURL(facility.website!)}
              >
                {facility.website}
              </AppText>
            </View>
          ) : null}
          {facility.serviceSetting ? (
            <InfoRow label={t('mh.labelSetting')}>{facility.serviceSetting}</InfoRow>
          ) : null}
          {facility.ageGroups ? (
            <InfoRow label={t('mh.labelAgeGroups')}>{facility.ageGroups}</InfoRow>
          ) : null}
          {facility.languages ? (
            <InfoRow label={t('mh.labelLanguages')}>{facility.languages}</InfoRow>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {facility.phone ? (
            <TouchableOpacity style={[styles.btn, styles.btnFill]} onPress={handleCall}>
              <AppText variant="button" style={styles.btnFillText}>{t('common.call')}</AppText>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={handleDirections}>
            <AppText variant="button" style={styles.btnOutlineText}>{t('common.directions')}</AppText>
          </TouchableOpacity>
        </View>

        {/* 988 crisis card */}
        <View style={styles.crisisWrap}>
          <Crisis988Card />
        </View>

        <AppText variant="caption" style={styles.disclaimer}>{t('mh.disclaimer')}</AppText>
        <AppText variant="caption" style={styles.attribution}>{t('mh.attribution')}</AppText>

      </ScrollView>
    </>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" style={styles.rowLabel}>{label}</AppText>
      <AppText variant="body" style={styles.rowValue}>{String(children)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.muted, marginBottom: 16 },
  backBtn: { marginTop: 12 },
  backBtnText: { color: colors.primary },

  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.lg,
    paddingBottom: 20,
    paddingHorizontal: spacing.lg,
  },
  backRow: { marginBottom: 10 },
  backLabel: { color: 'rgba(255,255,255,0.85)', fontFamily: font.regular },
  headerName: { color: '#fff', lineHeight: 28 },
  headerName2: { color: 'rgba(255,255,255,0.75)', marginTop: 4, fontFamily: font.regular },

  spanishWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  spanishBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tintLilac,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  spanishText: { color: colors.tintLilacIcon },

  badgesWrap: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: {},

  section: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadow,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
    fontFamily: font.semibold,
    fontSize: 11,
  },
  rowValue: { color: colors.text, lineHeight: 20 },
  link: { color: colors.primary, textDecorationLine: 'underline' },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  btn: { flex: 1, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  btnFill: { backgroundColor: colors.primary },
  btnFillText: { color: '#fff' },
  btnOutline: { borderWidth: 1.5, borderColor: colors.primary },
  btnOutlineText: { color: colors.primary },

  crisisWrap: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },

  disclaimer: {
    textAlign: 'center',
    marginHorizontal: 24,
    lineHeight: 16,
    marginBottom: 4,
  },
  attribution: {
    textAlign: 'center',
    marginHorizontal: 24,
    lineHeight: 16,
    marginBottom: spacing.lg,
    color: colors.muted,
  },
});
