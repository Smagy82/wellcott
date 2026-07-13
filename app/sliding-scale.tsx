import { useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../src/components/Text';
import { getFpgPercent, getPayClass, FPG_YEAR } from '../src/lib/fpg';
import { theme } from '../src/theme';

const { colors, font, radius, spacing, shadow } = theme;

const TRACK_H = 10;

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

type IncomeMode = 'year' | 'month';

const PAY_CLASS_LABEL: Record<string, string> = {
  full:  'slidingScale.resultBadgeFull',
  tier1: 'slidingScale.resultBadgeTier1',
  tier2: 'slidingScale.resultBadgeTier2',
  tier3: 'slidingScale.resultBadgeTier3',
  tier4: 'slidingScale.resultBadgeTier4',
  none:  'slidingScale.resultBadgeNone',
};

const PAY_CLASS_STYLE: Record<string, { bg: string; color: string }> = {
  full:  { bg: colors.tintMint,   color: colors.tintMintIcon },
  tier1: { bg: colors.tintYellow, color: colors.tintYellowIcon },
  tier2: { bg: colors.tintYellow, color: colors.tintYellowIcon },
  tier3: { bg: colors.tintPeach,  color: colors.tintPeachIcon },
  tier4: { bg: colors.tintPeach,  color: colors.tintPeachIcon },
  none:  { bg: colors.tintPeach,  color: colors.tintPeachIcon },
};

function verdictKey(id: string): string {
  if (id === 'full') return 'slidingScale.verdict.full';
  if (id === 'none') return 'slidingScale.verdict.none';
  return 'slidingScale.verdict.partial';
}

function formatIncome(raw: string): string {
  if (!raw) return '';
  const n = parseInt(raw, 10);
  if (isNaN(n)) return '';
  return n.toLocaleString('en-US');
}

export default function SlidingScaleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state: stateParam } = useLocalSearchParams<{ state?: string }>();

  const [howOpen, setHowOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [householdSize, setHouseholdSize] = useState(1);
  const [incomeStr, setIncomeStr] = useState('');
  const [incomeMode, setIncomeMode] = useState<IncomeMode>('year');
  const [selectedState, setSelectedState] = useState(stateParam ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [stateFilter, setStateFilter] = useState('');
  const [trackW, setTrackW] = useState(0);

  const incomeNum = incomeStr ? parseInt(incomeStr, 10) : 0;
  const annualIncome = incomeMode === 'month' ? incomeNum * 12 : incomeNum;
  const hasResult = annualIncome > 0 && selectedState !== '';

  const pct = hasResult ? getFpgPercent(annualIncome, selectedState, householdSize) : 0;
  const payClass = hasResult ? getPayClass(pct) : null;
  const pcs = payClass ? (PAY_CLASS_STYLE[payClass.id] ?? PAY_CLASS_STYLE.none) : null;
  const fillRatio = Math.min(pct / 200, 1);

  const filteredStates = US_STATES.filter(s =>
    stateFilter === '' ||
    s.name.toLowerCase().includes(stateFilter.toLowerCase()) ||
    s.code.toLowerCase() === stateFilter.toLowerCase(),
  );

  const selectedStateName = US_STATES.find(s => s.code === selectedState)?.name;

  const closeModal = () => { setModalOpen(false); setStateFilter(''); };

  const labelKey = payClass ? (PAY_CLASS_LABEL[payClass.id] ?? 'slidingScale.resultBadgeNone') : '';

  return (
    <>
      <Stack.Screen options={{ title: t('slidingScale.navTitle') }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── How this works accordion ── */}
        <View style={styles.accordion}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setHowOpen(o => !o)}
            activeOpacity={0.8}
          >
            <Text style={styles.accordionTitle}>{t('slidingScale.how.title')}</Text>
            <Ionicons
              name={howOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.tintBlueIcon}
            />
          </TouchableOpacity>
          {howOpen && (
            <View style={styles.accordionBody}>
              {(['body1', 'body2', 'body3', 'body4', 'body5'] as const).map(k => (
                <Text key={k} style={styles.howBody}>
                  {t(`slidingScale.how.${k}`)}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* ── Inputs ── */}
        <View style={styles.card}>

          {/* Household size */}
          <Text style={styles.label}>{t('slidingScale.householdSize')}</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepBtn, householdSize <= 1 && styles.stepBtnDisabled]}
              onPress={() => setHouseholdSize(h => Math.max(1, h - 1))}
              disabled={householdSize <= 1}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{householdSize}</Text>
            <TouchableOpacity
              style={[styles.stepBtn, householdSize >= 12 && styles.stepBtnDisabled]}
              onPress={() => setHouseholdSize(h => Math.min(12, h + 1))}
              disabled={householdSize >= 12}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rowDivider} />

          {/* Income */}
          <Text style={styles.label}>{t('slidingScale.annualIncome')}</Text>
          <View style={styles.incomeRow}>
            <View style={[styles.incomeInputWrap, isFocused && styles.incomeInputWrapFocused]}>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                style={styles.incomeInput}
                value={formatIncome(incomeStr)}
                onChangeText={v => setIncomeStr(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder={t('slidingScale.incomePlaceholder')}
                placeholderTextColor={colors.textMuted}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoFocus
              />
            </View>
            <View style={styles.modePill}>
              {(['year', 'month'] as IncomeMode[]).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, incomeMode === m && styles.modeBtnActive]}
                  onPress={() => setIncomeMode(m)}
                >
                  <Text style={[styles.modeBtnText, incomeMode === m && styles.modeBtnTextActive]}>
                    {m === 'year' ? t('slidingScale.incomeYear') : t('slidingScale.incomeMonth')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.rowDivider} />

          {/* State */}
          <Text style={styles.label}>{t('slidingScale.statePicker')}</Text>
          <TouchableOpacity style={styles.stateTrigger} onPress={() => setModalOpen(true)}>
            <Text style={[styles.stateTriggerText, !selectedState && styles.statePlaceholder]}>
              {selectedStateName ?? t('slidingScale.statePickerPlaceholder')}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>

        </View>

        {/* ── Results ── */}
        {hasResult && payClass && pcs && (
          <>
            {/* FPG percent */}
            <View style={[styles.pctCard, { backgroundColor: pcs.bg }]}>
              <Text style={[styles.pctText, { color: pcs.color }]}>
                {t('slidingScale.resultPct', { pct })}
              </Text>
            </View>

            {/* Progress bar */}
            <View style={styles.barWrap}>
              <View style={styles.barTrackOuter} onLayout={e => setTrackW(e.nativeEvent.layout.width)}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: trackW * fillRatio, backgroundColor: pcs.color }]} />
                  <View style={[styles.barMidLine, { left: trackW * 0.5 }]} />
                </View>
                {trackW > 0 && (
                  <View style={[styles.barMarker, {
                    left: Math.max(0, trackW * fillRatio - 7),
                    top: -(14 - TRACK_H) / 2,
                    backgroundColor: pcs.color,
                  }]} />
                )}
              </View>
              <View style={styles.barLabels}>
                <Text style={styles.barLabel}>{t('slidingScale.scaleMin')}</Text>
                <Text style={styles.barLabel}>{t('slidingScale.scaleMid')}</Text>
                <Text style={styles.barLabel}>{t('slidingScale.scaleMax')}</Text>
              </View>
            </View>

            {/* Pay class badge (only for non-none tiers) */}
            {payClass.id !== 'none' && (
              <View style={[styles.classBadge, { backgroundColor: pcs.bg }]}>
                <Text style={[styles.classBadgeText, { color: pcs.color }]}>
                  {t(labelKey)}
                </Text>
              </View>
            )}

            {/* Verdict */}
            <View style={[styles.verdictCard, { borderLeftColor: pcs.color }]}>
              <Text style={styles.verdictText}>{t(verdictKey(payClass.id))}</Text>
              {payClass.id === 'none' && (
                <TouchableOpacity onPress={() => router.push('/costs')}>
                  <Text style={styles.linkText}>{t('slidingScale.verdict.noneLink')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Disclaimer inline with results */}
            <Text style={styles.resultDisclaimer}>{t('slidingScale.disclaimerEstimate')}</Text>
          </>
        )}

        {/* ── How to get the discount (always visible) ── */}
        <View style={styles.howToGetCard}>
          <Text style={styles.howToGetTitle}>{t('slidingScale.howToGet.title')}</Text>
          {([1, 2, 3, 4] as const).map(n => (
            <View key={n} style={styles.howStepRow}>
              <View style={styles.howStepNum}>
                <Text style={styles.howStepNumText}>{n}</Text>
              </View>
              <Text style={styles.howStepText}>{t(`slidingScale.howToGet.step${n}`)}</Text>
            </View>
          ))}
          <View style={styles.warningRow}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.tintYellowIcon}
              style={{ marginRight: 8, marginTop: 1 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningText}>{t('slidingScale.howToGet.warning')}</Text>
              <TouchableOpacity onPress={() => router.push('/about')}>
                <Text style={styles.linkText}>{t('slidingScale.howToGet.warningLink')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>{t('slidingScale.footer', { year: FPG_YEAR })}</Text>

      </ScrollView>

      {/* ── State Picker Modal ── */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('slidingScale.statePicker')}</Text>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.modalDone}>{t('slidingScale.statePickerDone')}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.stateSearch}
            value={stateFilter}
            onChangeText={setStateFilter}
            placeholder={t('slidingScale.statePickerSearch')}
            placeholderTextColor={colors.textMuted}
            autoFocus
            clearButtonMode="while-editing"
          />
          <FlatList
            data={filteredStates}
            keyExtractor={item => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.stateRow, selectedState === item.code && styles.stateRowActive]}
                onPress={() => { setSelectedState(item.code); closeModal(); }}
              >
                <Text style={[styles.stateRowName, selectedState === item.code && styles.stateRowNameActive]}>
                  {item.name}
                </Text>
                <Text style={styles.stateRowCode}>{item.code}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.stateSep} />}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: 12, paddingBottom: 48 },

  // How accordion
  accordion: {
    backgroundColor: colors.tintBlue,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  accordionTitle: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.tintBlueIcon,
    flex: 1,
    lineHeight: 20,
    marginRight: 8,
  },
  accordionBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  howBody: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },

  // Input card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow,
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },

  // Household stepper
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 40, height: 40, borderRadius: radius.sm,
    backgroundColor: colors.tintBlue,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: { fontFamily: font.bold, fontSize: 22, color: colors.tintBlueIcon, lineHeight: 26 },
  stepValue: { fontFamily: font.bold, fontSize: 28, color: colors.text, minWidth: 36, textAlign: 'center' },

  // Income row
  incomeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incomeInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tintBlue,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.tintBlueIcon,
    paddingHorizontal: 10,
    paddingVertical: 2,
    gap: 6,
  },
  incomeInputWrapFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  dollar: { fontFamily: font.semibold, fontSize: 18, color: colors.textMuted },
  incomeInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 8,
  },
  modePill: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 2,
  },
  modeBtn: { borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 12 },
  modeBtnActive: { backgroundColor: colors.card, ...shadow },
  modeBtnText: { fontFamily: font.medium, fontSize: 12, color: colors.textMuted },
  modeBtnTextActive: { color: colors.primary },

  // State picker trigger
  stateTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  stateTriggerText: { fontFamily: font.regular, fontSize: 15, color: colors.text },
  statePlaceholder: { color: colors.textMuted },

  // FPG result
  pctCard: { borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  pctText: { fontFamily: font.bold, fontSize: 17, lineHeight: 24 },

  // Progress bar
  barWrap: { gap: 8 },
  barTrackOuter: { position: 'relative' },
  barTrack: {
    height: TRACK_H,
    backgroundColor: colors.surfaceAlt,
    borderRadius: TRACK_H / 2,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  barMidLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: colors.textLight },
  barMarker: {
    position: 'absolute',
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: colors.card,
  },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontFamily: font.regular, fontSize: 11, color: colors.textMuted },

  // Pay class badge
  classBadge: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  classBadgeText: { fontFamily: font.semibold, fontSize: 13 },

  // Verdict card
  verdictCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderLeftWidth: 3,
    gap: spacing.xs,
    ...shadow,
  },
  verdictText: { fontFamily: font.semibold, fontSize: 15, color: colors.text, lineHeight: 22 },

  resultDisclaimer: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
    marginHorizontal: 8,
  },

  linkText: { fontFamily: font.semibold, fontSize: 13, color: colors.primary, marginTop: 4 },

  // How to get card
  howToGetCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 14,
    ...shadow,
  },
  howToGetTitle: { fontFamily: font.bold, fontSize: 15, color: colors.text },
  howStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  howStepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  howStepNumText: { fontFamily: font.bold, fontSize: 13, color: '#fff' },
  howStepText: { fontFamily: font.regular, fontSize: 13, color: colors.text, lineHeight: 20, flex: 1 },

  warningRow: {
    flexDirection: 'row',
    backgroundColor: colors.tintYellow,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 2,
  },
  warningText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
    marginBottom: 4,
  },

  footer: {
    fontFamily: font.regular, fontSize: 11,
    color: colors.textMuted, textAlign: 'center', marginTop: 4,
  },

  // State picker modal
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  modalTitle: { fontFamily: font.bold, fontSize: 17, color: colors.text },
  modalDone: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },
  stateSearch: {
    fontFamily: font.regular,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: colors.text,
    margin: spacing.lg, marginTop: spacing.md,
  },
  stateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
  },
  stateRowActive: { backgroundColor: colors.tintBlue },
  stateRowName: { fontFamily: font.regular, fontSize: 15, color: colors.text },
  stateRowNameActive: { fontFamily: font.semibold, color: colors.primary },
  stateRowCode: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted },
  stateSep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
});
