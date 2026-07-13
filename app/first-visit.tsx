import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../src/components/Text';
import { ScreenHeader } from '../src/components/ScreenHeader';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { WarningCircle, Calculator, CalendarBlank, Copy, Check, CheckFat, Phone, CaretRight } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../src/theme';
import { useVisitPrep } from '../src/lib/useVisitPrep';
import { useAuth } from '../src/lib/useAuth';
import { getDb } from '../src/lib/database';
import { getClinicById } from '../src/lib/clinicSearch';
import type { Clinic } from '../src/types/clinic';

const { colors, font, radius, spacing, shadow } = theme;

const GROUP_DISCOUNT = ['id', 'proofOfIncome', 'proofOfAddress'] as const;
const GROUP_VISIT    = ['medications', 'allergies', 'payment'] as const;
const TOTAL_ITEMS    = GROUP_DISCOUNT.length + GROUP_VISIT.length;

export default function FirstVisitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { clinicId } = useLocalSearchParams<{ clinicId?: string }>();
  const { session } = useAuth();
  const clinicIdStr = Array.isArray(clinicId) ? clinicId[0] : clinicId;
  const { items, toggle, reset, progress } = useVisitPrep(clinicIdStr);

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [copied, setCopied] = useState(false);
  const total = TOTAL_ITEMS;

  useEffect(() => {
    if (!clinicIdStr) return;
    (async () => {
      const db = await getDb();
      const result = await getClinicById(db, decodeURIComponent(clinicIdStr));
      setClinic(result);
    })();
  }, [clinicIdStr]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(t('firstVisit.script_body'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const discountChecked = GROUP_DISCOUNT.filter(id => !!items[id]).length;
  const visitChecked    = GROUP_VISIT.filter(id => !!items[id]).length;

  return (
    <>
      <ScreenHeader title={t('firstVisit.title')} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {clinic ? (
          <View style={styles.clinicHeader}>
            <Text style={styles.clinicLabel}>{t('firstVisit.clinicLabel')}</Text>
            <Text style={styles.clinicName}>{clinic.name}</Text>
            <Text style={styles.clinicAddress}>
              {clinic.address}, {clinic.city}, {clinic.state} {clinic.zip}
            </Text>
          </View>
        ) : null}

        <View style={styles.progressCard}>
          <Text style={styles.progressText}>
            {t('firstVisit.progressLabel', { n: progress })}
          </Text>
          <View style={styles.progressBarTrack}>
            <View style={{ flex: progress, backgroundColor: colors.primary }} />
            <View style={{ flex: total - progress }} />
          </View>
        </View>

        {/* Section 1: documents needed for the sliding-scale discount */}
        <View>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>{t('firstVisit.group_discount')}</Text>
            <Text style={styles.sectionCounter}>{discountChecked} / {GROUP_DISCOUNT.length}</Text>
          </View>
          <View style={styles.sectionCard}>
            {GROUP_DISCOUNT.map((id, i) => {
              const checked = !!items[id];
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.checkRow, i < GROUP_DISCOUNT.length - 1 && styles.checkRowDivider]}
                  activeOpacity={0.7}
                  hitSlop={10}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggle(id); }}
                >
                  <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
                    {checked && <CheckFat size={13} weight="fill" color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.checkTitle, checked && styles.checkTitleDone]}>
                      {t(`firstVisit.item_${id}_title`)}
                    </Text>
                    <Text style={styles.checkSub}>{t(`firstVisit.item_${id}_sub`)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 2: appointment essentials — marginTop: 2 yields 14px total gap from section 1 */}
        <View style={{ marginTop: 2 }}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>{t('firstVisit.group_visit')}</Text>
            <Text style={styles.sectionCounter}>{visitChecked} / {GROUP_VISIT.length}</Text>
          </View>
          <View style={styles.sectionCard}>
            {GROUP_VISIT.map((id, i) => {
              const checked = !!items[id];
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.checkRow, i < GROUP_VISIT.length - 1 && styles.checkRowDivider]}
                  activeOpacity={0.7}
                  hitSlop={10}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggle(id); }}
                >
                  <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
                    {checked && <CheckFat size={13} weight="fill" color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.checkTitle, checked && styles.checkTitleDone]}>
                      {t(`firstVisit.item_${id}_title`)}
                    </Text>
                    <Text style={styles.checkSub}>{t(`firstVisit.item_${id}_sub`)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.warningCard}>
          <WarningCircle size={20} color={colors.warningIcon} style={styles.warningIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>{t('firstVisit.incomeWarning_title')}</Text>
            <Text style={styles.warningBody}>{t('firstVisit.incomeWarning_body')}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.scaleCard}
          activeOpacity={0.8}
          onPress={() => router.push('/sliding-scale')}
        >
          <Calculator size={22} color={colors.tintBlueIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scaleTitle}>{t('firstVisit.scaleCta_title')}</Text>
            <Text style={styles.scaleSub}>{t('firstVisit.scaleCta_sub')}</Text>
          </View>
          <CaretRight size={18} color={colors.tintBlueIcon} />
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('firstVisit.script_title')}</Text>
          <View style={styles.scriptBox}>
            <Text style={styles.scriptText}>{t('firstVisit.script_body')}</Text>
          </View>
          <View style={styles.scriptActions}>
            <TouchableOpacity
              style={[styles.scriptBtn, styles.scriptBtnOutline]}
              onPress={handleCopy}
            >
              {copied
                ? <Check size={16} color={colors.primary} style={{ marginRight: 6 }} />
                : <Copy size={16} color={colors.primary} style={{ marginRight: 6 }} />}
              <Text style={styles.scriptBtnOutlineText}>
                {copied ? t('firstVisit.script_copied') : t('firstVisit.script_copy')}
              </Text>
            </TouchableOpacity>
            {clinic?.phone ? (
              <TouchableOpacity
                style={[styles.scriptBtn, styles.scriptBtnFill]}
                onPress={() => Linking.openURL(`tel:${clinic.phone}`)}
              >
                <Phone size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.scriptBtnFillText}>{t('firstVisit.script_call')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {session ? (
          <TouchableOpacity
            style={styles.historyCard}
            activeOpacity={0.8}
            onPress={() => router.push('/visit-add')}
          >
            <CalendarBlank size={22} color={colors.tintMintIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>{t('firstVisit.historyEntry_title')}</Text>
              <Text style={styles.historySub}>{t('firstVisit.historyEntry_sub')}</Text>
            </View>
            <CaretRight size={18} color={colors.tintMintIcon} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetText}>{t('firstVisit.reset')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: spacing.lg, gap: 12, paddingBottom: 48 },

  clinicHeader: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  clinicLabel: {
    fontFamily: font.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  clinicName: {
    fontFamily: font.bold,
    fontSize: 17,
    color: '#fff',
    lineHeight: 23,
    marginBottom: 4,
  },
  clinicAddress: {
    fontFamily: font.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },

  progressCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 10,
    ...shadow,
  },
  progressText: { fontFamily: font.semibold, fontSize: 15, color: colors.text },
  progressBarTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },

  // Section header sits on the background, above the card
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: font.bold,
    fontSize: 12,
    color: colors.tintBlueIcon,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCounter: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.iconIdle,
  },

  // Per-section card
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 14,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  checkRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkBox: {
    width: 24, height: 24, borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.checkboxBorder,
    backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, marginTop: 2, flexShrink: 0,
  },
  checkBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
    marginBottom: 2,
  },
  checkTitleDone: { color: colors.iconIdle, textDecorationLine: 'line-through' },
  checkSub: {
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.muted,
    lineHeight: 18,
  },

  // Generic card (script section)
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  cardTitle: { fontFamily: font.bold, fontSize: 15, color: colors.text, marginBottom: 10 },

  warningCard: {
    backgroundColor: colors.warningBg,
    borderRadius: 16,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningIcon: { marginRight: 10, marginTop: 1 },
  warningTitle: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.warningText,
    marginBottom: 4,
  },
  warningBody: { fontFamily: font.regular, fontSize: 13, color: colors.text, lineHeight: 20 },

  scaleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tintBlue,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 12,
    ...shadow,
  },
  scaleTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.tintBlueIcon, marginBottom: 2 },
  scaleSub: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted },

  scriptBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  scriptText: { fontFamily: font.regular, fontSize: 14, color: colors.text, lineHeight: 22 },
  scriptActions: { flexDirection: 'row', gap: 10 },
  scriptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingVertical: 10,
  },
  scriptBtnOutline: { borderWidth: 1.5, borderColor: colors.primary },
  scriptBtnOutlineText: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },
  scriptBtnFill: { backgroundColor: colors.primary },
  scriptBtnFillText: { fontFamily: font.bold, fontSize: 13, color: '#fff' },

  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tintMint,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 12,
    ...shadow,
  },
  historyTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.tintMintIcon, marginBottom: 2 },
  historySub: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted },

  resetBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 24 },
  resetText: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, textDecorationLine: 'underline' },
});
