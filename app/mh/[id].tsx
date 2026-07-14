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
import { Heart, FileText, CaretRight } from 'phosphor-react-native';
import { getDb } from '../../src/lib/database';
import { getMhById, formatMhAddress } from '../../src/lib/mentalHealthSearch';
import type { MhFacility } from '../../src/types/mentalHealth';
import { theme } from '../../src/theme';
import { Crisis988Card } from '../../src/components/Crisis988Card';
import {
  init as initSaved,
  isSaved,
  toggleSaved,
  subscribe as subscribeSaved,
} from '../../src/store/savedClinics';

const { colors, radius, font, shadow, spacing } = theme;

export default function MhDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [facility, setFacility] = useState<MhFacility | null>(null);
  const [loading, setLoading] = useState(true);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initSaved();
        const db = await getDb();
        const result = await getMhById(db, decodeURIComponent(id ?? ''));
        if (!cancelled) setFacility(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const unsub = subscribeSaved(() => forceUpdate((n) => n + 1));
    return () => { cancelled = true; unsub(); };
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

  // "Call intake" shows only when intake_phone exists, differs from phone, AND phone is also set
  const showIntakeBtn = !!facility.phone &&
                        !!facility.intakePhone &&
                        facility.intakePhone !== facility.phone;

  // Primary call number: phone, or intakePhone as fallback when phone is absent
  const callNumber = facility.phone ?? facility.intakePhone;

  const handleCall = () => {
    if (callNumber) Linking.openURL(`tel:${callNumber}`);
  };

  const handleCallIntake = () => {
    if (facility.intakePhone) Linking.openURL(`tel:${facility.intakePhone}`);
  };

  const handleDirections = () => {
    const parts = [facility.street1, facility.city, facility.state, facility.zip].filter(Boolean);
    const q = encodeURIComponent(parts.join(', '));
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  const fav = isSaved(facility.id, 'mh');

  const handleToggleFav = () => {
    toggleSaved(facility.id, 'mh', {
      name: facility.name1,
      address: formatMhAddress(facility),
    }).catch(() => {});
  };

  const hasBadge = facility.hasSlidingFee || facility.hasPayAssist || speaksSpanish;

  return (
    <>
      <Stack.Screen options={{ title: facility.name1 }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <AppText variant="secondary" style={styles.backLabel}>{t('common.back')}</AppText>
          </TouchableOpacity>
          <View style={styles.headerNameRow}>
            <AppText variant="heading" style={styles.headerName}>{facility.name1}</AppText>
            <TouchableOpacity
              style={styles.heartBtn}
              onPress={handleToggleFav}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Heart
                weight={fav ? 'fill' : 'regular'}
                size={26}
                color={fav ? colors.danger : colors.onPrimaryDim}
              />
            </TouchableOpacity>
          </View>
          {facility.name2 ? (
            <AppText variant="secondary" style={styles.headerName2}>{facility.name2}</AppText>
          ) : null}
        </View>

        {/* 988 crisis card — first for safety */}
        <View style={styles.crisisWrap}>
          <Crisis988Card />
        </View>

        {/* Badges: sliding scale + pay assist + español in one row */}
        {hasBadge ? (
          <View style={styles.badgesWrap}>
            {facility.hasSlidingFee ? (
              <View style={[styles.badge, { backgroundColor: colors.tagGreenBg }]}>
                <AppText variant="chip" style={{ color: colors.tagGreenText }}>
                  {t('mh.badgeSlidingFee')}
                </AppText>
              </View>
            ) : null}
            {facility.hasPayAssist && !facility.hasSlidingFee ? (
              <View style={[styles.badge, { backgroundColor: colors.tagTealBg }]}>
                <AppText variant="chip" style={{ color: colors.tagTealText }}>
                  {t('mh.badgePayAssist')}
                </AppText>
              </View>
            ) : null}
            {speaksSpanish ? (
              <View style={[styles.badge, { backgroundColor: colors.tintLilac }]}>
                <AppText variant="chip" style={{ color: colors.tintLilacIcon }}>
                  {t('mh.spanish')}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Sliding scale info — SAMHSA-specific text, intentionally different from FQHC text */}
        {facility.hasSlidingFee ? (
          <AppText variant="caption" style={styles.slidingScaleNote}>
            {t('mh.slidingScaleInfo')}
          </AppText>
        ) : null}

        {/* Info section */}
        <View style={styles.section}>
          {(facility.street1 || facility.city) ? (
            <InfoRow label={t('mh.labelAddress')}>
              {[facility.street1, facility.city, facility.state, facility.zip].filter(Boolean).join(', ')}
            </InfoRow>
          ) : null}
          {facility.phone ? (
            <PhoneRow label={t('mh.labelPhone')} number={facility.phone} />
          ) : null}
          {facility.intakePhone && facility.intakePhone !== facility.phone ? (
            <PhoneRow label={t('mh.labelIntakePhone')} number={facility.intakePhone} />
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
          {callNumber ? (
            <TouchableOpacity style={[styles.btn, styles.btnFill]} onPress={handleCall}>
              <AppText variant="button" style={styles.btnFillText}>{t('common.call')}</AppText>
            </TouchableOpacity>
          ) : null}
          {showIntakeBtn ? (
            <TouchableOpacity style={[styles.btn, styles.btnIntake]} onPress={handleCallIntake}>
              <AppText variant="button" style={styles.btnIntakeText}>{t('mh.intakeCallBtn')}</AppText>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={handleDirections}>
            <AppText variant="button" style={styles.btnOutlineText}>{t('common.directions')}</AppText>
          </TouchableOpacity>
        </View>
        {showIntakeBtn ? (
          <AppText variant="caption" style={styles.intakeHint}>
            {t('mh.intakeHint')}
          </AppText>
        ) : null}

        {/* GFE entry card */}
        <TouchableOpacity
          style={styles.gfeCard}
          activeOpacity={0.8}
          onPress={() => router.push('/good-faith-estimate')}
        >
          <FileText size={22} color={colors.tintMintIcon} />
          <View style={{ flex: 1 }}>
            <AppText variant="cardTitle" style={styles.gfeTitle}>{t('gfe.cta.title')}</AppText>
            <AppText variant="secondary" style={styles.gfeSub}>{t('gfe.cta.subtitle')}</AppText>
          </View>
          <CaretRight size={18} color={colors.tintMintIcon} />
        </TouchableOpacity>

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

function PhoneRow({ label, number }: { label: string; number: string }) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(`tel:${number}`)} activeOpacity={0.7}>
      <AppText variant="caption" style={styles.rowLabel}>{label}</AppText>
      <AppText variant="body" style={[styles.rowValue, styles.link]}>{number}</AppText>
    </TouchableOpacity>
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
  backLabel: { color: colors.onPrimaryMuted, fontFamily: font.regular },
  headerNameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerName: { color: colors.onPrimary, lineHeight: 28, flex: 1, marginRight: 10 },
  heartBtn: { paddingTop: 2 },
  headerName2: { color: colors.onPrimaryDim, marginTop: 4, fontFamily: font.regular },

  crisisWrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  badgesWrap: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },

  slidingScaleNote: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    color: colors.muted,
    lineHeight: 18,
  },

  section: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
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
    marginBottom: spacing.sm,
  },
  btn: { flex: 1, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  btnFill: { backgroundColor: colors.primary },
  btnFillText: { color: colors.onPrimary },
  btnIntake: { backgroundColor: colors.tintBlue },
  btnIntakeText: { color: colors.tintBlueIcon },
  btnOutline: { borderWidth: 1.5, borderColor: colors.primary },
  btnOutlineText: { color: colors.primary },

  intakeHint: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    color: colors.muted,
    lineHeight: 16,
  },

  gfeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.tintMint,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    padding: 16,
    ...shadow,
  },
  gfeTitle: { color: colors.tintMintIcon, marginBottom: 2 },
  gfeSub: { color: colors.tintMintIcon, lineHeight: 16, opacity: 0.85 },

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
