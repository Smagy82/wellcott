import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../../src/components/Text';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Heart, ShareNetwork, CaretRight, Calculator, FileText, List, Bus } from 'phosphor-react-native';
import { getDb } from '../../src/lib/database';
import { getClinicById } from '../../src/lib/clinicSearch';
import type { Clinic } from '../../src/types/clinic';
import {
  init as initSaved,
  isSaved,
  toggleSaved,
  subscribe as subscribeSaved,
} from '../../src/store/savedClinics';
import { shareClinic } from '../../src/lib/shareClinic';
import { isOpenNow } from '../../src/lib/openingHours';
import { theme } from '../../src/theme';
import { PrescriptionSavingsCard } from '../../src/components/PrescriptionSavingsCard';

const { colors, radius, font, shadow, spacing } = theme;

export default function ClinicDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        await initSaved();
        const db = await getDb();
        const result = await getClinicById(db, decodeURIComponent(id ?? ''));
        setClinic(result);
      } finally {
        setLoading(false);
      }
    })();
    return subscribeSaved(() => forceUpdate((n) => n + 1));
  }, [id]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!clinic) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('clinicDetail.notFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hours: string[] = (() => {
    if (!clinic.hoursJson) return [];
    try { return JSON.parse(clinic.hoursJson) as string[]; }
    catch { return []; }
  })();

  const handleCall = () => { if (clinic.phone) Linking.openURL(`tel:${clinic.phone}`); };
  const handleDirections = () => {
    const q = encodeURIComponent(`${clinic.address}, ${clinic.city}, ${clinic.state} ${clinic.zip}`);
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  const handleTransit = () => {
    const url = Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${clinic.latitude},${clinic.longitude}&dirflg=r`
      : `https://www.google.com/maps/dir/?api=1&destination=${clinic.latitude},${clinic.longitude}&travelmode=transit`;
    Linking.openURL(url);
  };

  const handleShare = () => shareClinic(clinic, t);

  const fav = isSaved(clinic.id, 'clinic');
  const openStatus = isOpenNow(clinic.hoursJson ?? null);

  return (
    <>
      <Stack.Screen options={{ title: clinic.name }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerNameRow}>
          <Text style={styles.headerName}>{clinic.name}</Text>
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={() => {
              const address = `${clinic.address}, ${clinic.city}, ${clinic.state} ${clinic.zip}`;
              toggleSaved(clinic.id, 'clinic', { name: clinic.name, address }).catch(() => {});
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Heart
              weight={fav ? 'fill' : 'regular'}
              size={26}
              color={fav ? colors.danger : 'rgba(255,255,255,0.75)'}
            />
          </TouchableOpacity>
        </View>
        {clinic.siteType ? <Text style={styles.headerType}>{clinic.siteType}</Text> : null}
      </View>

      {/* Badges */}
      {(clinic.acceptsUninsured || clinic.slidingScale || openStatus !== null) && (
        <View style={styles.badgesSection}>
          <View style={styles.badges}>
            {clinic.acceptsUninsured && (
              <View style={[styles.badge, styles.badgeMint]}>
                <Text style={[styles.badgeText, { color: colors.tintMintIcon }]}>
                  {t('clinicList.acceptsUninsured')}
                </Text>
              </View>
            )}
            {clinic.slidingScale && (
              <View style={[styles.badge, styles.badgeBlue]}>
                <Text style={[styles.badgeText, { color: colors.tintBlueIcon }]}>
                  {t('clinicList.slidingScale')}
                </Text>
              </View>
            )}
            {openStatus !== null && (
              openStatus.open
                ? <View style={[styles.badge, styles.badgeMint]}>
                    <Text style={[styles.badgeText, { color: colors.tintMintIcon }]}>
                      {t('clinicList.openNow')}
                    </Text>
                  </View>
                : <View style={[styles.badge, { backgroundColor: 'rgba(100,116,139,0.12)' }]}>
                    <Text style={[styles.badgeText, { color: colors.muted }]}>
                      {openStatus.nextChange
                        ? t('clinicList.closedOpensAt', { time: openStatus.nextChange })
                        : t('clinicList.closed')}
                    </Text>
                  </View>
            )}
          </View>
          {clinic.slidingScale && (
            <Text style={styles.badgeNote}>{t('clinicDetail.slidingScaleInfo')}</Text>
          )}
        </View>
      )}

      {/* Sliding-scale CTA */}
      {clinic.slidingScale && (
        <TouchableOpacity
          style={styles.estimatorCard}
          activeOpacity={0.8}
          onPress={() => router.push(`/sliding-scale?state=${clinic.state}`)}
        >
          <Calculator size={22} color={colors.tintPeachIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>{t('clinicDetail.estimatorTitle')}</Text>
            <Text style={styles.ctaSub}>{t('clinicDetail.estimatorSubtitle')}</Text>
          </View>
          <CaretRight size={18} color={colors.tintPeachIcon} />
        </TouchableOpacity>
      )}

      {/* GFE CTA */}
      <TouchableOpacity
        style={styles.gfeCard}
        activeOpacity={0.8}
        onPress={() => router.push('/good-faith-estimate')}
      >
        <FileText size={22} color={colors.tintMintIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.gfeCtaTitle}>{t('gfe.cta.title')}</Text>
          <Text style={styles.gfeCtaSub}>{t('gfe.cta.subtitle')}</Text>
        </View>
        <CaretRight size={18} color={colors.tintMintIcon} />
      </TouchableOpacity>

      {/* First visit prep CTA */}
      <TouchableOpacity
        style={styles.prepCard}
        activeOpacity={0.8}
        onPress={() => router.push(`/first-visit?clinicId=${encodeURIComponent(id ?? '')}`)}
      >
        <List size={22} color={colors.tintBlueIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.prepCtaTitle}>{t('firstVisit.ctaTitle')}</Text>
          <Text style={styles.prepCtaSub}>{t('firstVisit.ctaSub')}</Text>
        </View>
        <CaretRight size={18} color={colors.tintBlueIcon} />
      </TouchableOpacity>

      {/* Info section */}
      <View style={styles.section}>
        <InfoRow label={t('clinicDetail.labelAddress')}>
          {clinic.address}, {clinic.city}, {clinic.state} {clinic.zip}
        </InfoRow>
        {clinic.phone ? <InfoRow label={t('clinicDetail.labelPhone')}>{clinic.phone}</InfoRow> : null}
        {clinic.website ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('clinicDetail.labelWebsite')}</Text>
            <Text style={[styles.rowValue, styles.link]} onPress={() => Linking.openURL(clinic.website!)}>
              {clinic.website}
            </Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('clinicDetail.labelHours')}</Text>
          {hours.length > 0
            ? hours.map((line) => <Text key={line} style={styles.rowValue}>{line}</Text>)
            : <Text style={styles.rowValue}>{t('clinicDetail.callToConfirmHours')}</Text>}
        </View>
      </View>

      {/* Can't afford care */}
      <View style={styles.helpBlock}>
        <Text style={styles.helpTitle}>{t('clinicDetail.cantAffordCare')}</Text>
        <Text style={styles.helpBody}>{t('clinicDetail.cantAffordCareSub')}</Text>
        <TouchableOpacity style={styles.helpBtn} onPress={() => router.push('/(tabs)/help')}>
          <Text style={styles.helpBtnText}>{t('common.financialHelp')}</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {clinic.phone ? (
          <TouchableOpacity style={[styles.btn, styles.btnFill]} onPress={handleCall}>
            <Text style={styles.btnFillText}>{t('common.call')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={handleDirections}>
          <Text style={styles.btnOutlineText}>{t('common.directions')}</Text>
        </TouchableOpacity>
        {clinic.latitude && clinic.longitude ? (
          <TouchableOpacity style={[styles.btn, styles.btnTransit]} onPress={handleTransit}>
            <View style={styles.btnTransitContent}>
              <Bus size={14} color={colors.tintSkyIcon} />
              <Text style={styles.btnTransitText}>{t('common.transit')}</Text>
            </View>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.btn, styles.btnShare]} onPress={handleShare}>
          <ShareNetwork size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Prescription savings */}
      <PrescriptionSavingsCard />

      <Text style={styles.disclaimer}>{t('clinicDetail.disclaimer')}</Text>
    </ScrollView>
    </>
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
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontFamily: font.regular, fontSize: 15, color: colors.textMuted, marginBottom: 16 },

  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.lg,
    paddingBottom: 20,
    paddingHorizontal: spacing.lg,
  },
  backRow: { marginBottom: 10 },
  backLabel: { fontFamily: font.regular, color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  headerNameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerName: { fontFamily: font.bold, color: '#fff', fontSize: 20, lineHeight: 26, flex: 1, marginRight: 10 },
  heartBtn: { paddingTop: 2 },
  headerType: { fontFamily: font.regular, color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },

  badgesSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  badgeMint: { backgroundColor: colors.tintMint },
  badgeBlue: { backgroundColor: colors.tintBlue },
  badgeText: { fontFamily: font.semibold, fontSize: 12 },
  badgeNote: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  estimatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tintPeach,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: 12,
    ...shadow,
  },
  ctaTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.tintPeachIcon, marginBottom: 2 },
  ctaSub: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted },

  gfeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tintMint,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: 12,
    ...shadow,
  },
  gfeCtaTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.tintMintIcon, marginBottom: 2 },
  gfeCtaSub: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted },

  prepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tintBlue,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: 12,
    ...shadow,
  },
  prepCtaTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.tintBlueIcon, marginBottom: 2 },
  prepCtaSub: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted },

  section: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
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
    fontFamily: font.semibold,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowValue: { fontFamily: font.regular, fontSize: 14, color: colors.text, lineHeight: 20 },
  link: { color: colors.primary, textDecorationLine: 'underline' },

  helpBlock: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 20,
    ...shadow,
  },
  helpTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.text, marginBottom: 4 },
  helpBody: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 10 },
  helpBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  helpBtnText: { fontFamily: font.semibold, color: colors.primary, fontSize: 13 },

  actions: { flexDirection: 'row', gap: 10, marginHorizontal: spacing.lg, marginBottom: 20 },
  btn: { flex: 1, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  btnFill: { backgroundColor: colors.primary },
  btnFillText: { fontFamily: font.bold, color: '#fff', fontSize: 15 },
  btnOutline: { borderWidth: 1.5, borderColor: colors.primary },
  btnOutlineText: { fontFamily: font.bold, color: colors.primary, fontSize: 15 },
  btnTransit: { flex: 1, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.tintSky },
  btnTransitContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btnTransitText: { fontFamily: font.bold, color: colors.tintSkyIcon, fontSize: 15 },
  btnShare: { borderWidth: 1.5, borderColor: colors.primary, flex: 0, width: 48, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },

  backBtn: { marginTop: 12 },
  backBtnText: { fontFamily: font.semibold, color: colors.primary, fontSize: 14 },

  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginHorizontal: 24,
    lineHeight: 16,
  },
});
