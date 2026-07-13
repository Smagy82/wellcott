import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../src/components/Text';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../src/theme';
import { useVisitPrep, PREP_ITEM_IDS } from '../src/lib/useVisitPrep';
import { useAuth } from '../src/lib/useAuth';
import { getDb } from '../src/lib/database';
import { getClinicById } from '../src/lib/clinicSearch';
import type { Clinic } from '../src/types/clinic';

const { colors, font, radius, spacing, shadow } = theme;

export default function FirstVisitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { clinicId } = useLocalSearchParams<{ clinicId?: string }>();
  const { session } = useAuth();
  const clinicIdStr = Array.isArray(clinicId) ? clinicId[0] : clinicId;
  const { items, toggle, reset, progress } = useVisitPrep(clinicIdStr);

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [copied, setCopied] = useState(false);

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

  const total = PREP_ITEM_IDS.length;

  return (
    <>
      <Stack.Screen options={{ title: t('firstVisit.title') }} />
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

        <View style={styles.card}>
          {PREP_ITEM_IDS.map((id, i) => {
            const checked = !!items[id];
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.checkRow,
                  i < PREP_ITEM_IDS.length - 1 && styles.checkRowBorder,
                ]}
                activeOpacity={0.7}
                onPress={() => toggle(id)}
              >
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={checked ? colors.primary : colors.textLight}
                  style={styles.checkIcon}
                />
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

        <View style={styles.warningCard}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={colors.tintPeachIcon}
            style={styles.warningIcon}
          />
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
          <Ionicons name="calculator-outline" size={22} color={colors.tintBlueIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scaleTitle}>{t('firstVisit.scaleCta_title')}</Text>
            <Text style={styles.scaleSub}>{t('firstVisit.scaleCta_sub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.tintBlueIcon} />
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
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={16}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.scriptBtnOutlineText}>
                {copied ? t('firstVisit.script_copied') : t('firstVisit.script_copy')}
              </Text>
            </TouchableOpacity>
            {clinic?.phone ? (
              <TouchableOpacity
                style={[styles.scriptBtn, styles.scriptBtnFill]}
                onPress={() => Linking.openURL(`tel:${clinic.phone}`)}
              >
                <Ionicons
                  name="call-outline"
                  size={16}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
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
            <Ionicons name="calendar-outline" size={22} color={colors.tintMintIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>{t('firstVisit.historyEntry_title')}</Text>
              <Text style={styles.historySub}>{t('firstVisit.historyEntry_sub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.tintMintIcon} />
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

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  cardTitle: { fontFamily: font.bold, fontSize: 15, color: colors.text, marginBottom: 10 },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
  checkRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checkIcon: { marginRight: 12, marginTop: 2 },
  checkTitle: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  checkTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  checkSub: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, lineHeight: 17 },

  warningCard: {
    backgroundColor: colors.tintPeach,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningIcon: { marginRight: 10, marginTop: 1 },
  warningTitle: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.tintPeachIcon,
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
