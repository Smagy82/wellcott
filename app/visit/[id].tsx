import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Text } from '../../src/components/Text';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { PencilSimple, Trash } from 'phosphor-react-native';
import { useVisits } from '../../src/lib/useVisits';
import { useBills, parseCategories } from '../../src/lib/useBills';
import { theme } from '../../src/theme';

const { colors, radius, font, shadow } = theme;

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  visit:     { bg: colors.tintMint,   text: colors.tintMintIcon },
  labs:      { bg: colors.tintBlue,   text: colors.tintBlueIcon },
  meds:      { bg: colors.tintPeach,  text: colors.tintPeachIcon },
  procedure: { bg: colors.tintLilac,  text: colors.tintLilacIcon },
  other:     { bg: colors.surfaceAlt, text: colors.textMuted },
};

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}
function formatAmount(n: number) { return '$' + n.toFixed(2); }

export default function VisitDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { visits, loading: visitsLoading, deleteVisit, reload: reloadVisits } = useVisits();
  const { bills, loading: billsLoading, reload: reloadBills } = useBills();

  useFocusEffect(useCallback(() => {
    reloadVisits();
    reloadBills();
  }, [reloadVisits, reloadBills]));

  const visit = visits.find(v => v.id === id);
  const linkedBills = bills.filter(b => b.visit_id === id);

  if (visitsLoading || billsLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!visit) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t('visitDetail.notFound')}</Text>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      t('visitDetail.deleteConfirmTitle'),
      t('visitDetail.deleteConfirmMessage'),
      [
        { text: t('visitDetail.deleteConfirmCancel'), style: 'cancel' },
        {
          text: t('visitDetail.deleteConfirmOk'),
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteVisit(visit.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('visitDetail.navTitle')} />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.heroCard}>
          <Text style={styles.heroDate}>{formatDate(visit.visit_date)}</Text>
          {visit.clinic_name ? (
            <Text style={styles.heroClinic}>{visit.clinic_name}</Text>
          ) : null}
        </View>

        {visit.reason ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('visitDetail.labelReason')}</Text>
            <Text style={styles.sectionValue}>{visit.reason}</Text>
          </View>
        ) : null}

        {visit.note ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('visitDetail.labelNote')}</Text>
            <Text style={styles.sectionValue}>{visit.note}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('visitDetail.linkedBills')}</Text>
          {linkedBills.length === 0 ? (
            <Text style={styles.noBills}>{t('visitDetail.noLinkedBills')}</Text>
          ) : (
            linkedBills.map((bill) => {
              const cats = parseCategories(bill.category);
              return (
                <TouchableOpacity
                  key={bill.id}
                  style={styles.billRow}
                  onPress={() => router.push(`/bill/${bill.id}` as Parameters<typeof router.push>[0])}
                  activeOpacity={0.75}
                >
                  <View style={styles.billLeft}>
                    <Text style={styles.billAmount}>{formatAmount(Number(bill.amount))}</Text>
                    <View style={styles.badgeRow}>
                      {cats.map((c) => {
                        const col = CATEGORY_COLORS[c] ?? CATEGORY_COLORS.other;
                        return (
                          <View key={c} style={[styles.badge, { backgroundColor: col.bg }]}>
                            <Text style={[styles.badgeText, { color: col.text }]}>
                              {t(`billAdd.cat_${c}`, { defaultValue: c })}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <Text style={styles.billDate}>{formatDate(bill.bill_date)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push(`/visit-add?id=${visit.id}` as Parameters<typeof router.push>[0])}
          >
            <PencilSimple size={18} color={colors.primary} />
            <Text style={styles.editBtnText}>{t('common.edit')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Trash size={18} color={colors.dangerText} />
            <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  notFound: { fontFamily: font.regular, color: colors.textMuted, fontSize: 15 },

  content: { padding: 16, paddingBottom: 48 },

  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    ...shadow,
  },
  heroDate:   { fontFamily: font.bold, color: '#fff', fontSize: 22 },
  heroClinic: { fontFamily: font.regular, color: 'rgba(255,255,255,0.8)', fontSize: 15, marginTop: 6 },

  section: { marginBottom: 20 },
  sectionLabel: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionValue: { fontFamily: font.regular, fontSize: 15, color: colors.text, lineHeight: 22 },

  noBills: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },

  billRow: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    ...shadow,
  },
  billLeft:   { flex: 1, marginRight: 8 },
  billAmount: { fontFamily: font.bold, fontSize: 18, color: colors.text, marginBottom: 4 },
  billDate:   { fontFamily: font.regular, fontSize: 13, color: colors.textMuted },
  badgeRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:  { fontFamily: font.semibold, fontSize: 11 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  editBtnText: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },

  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  deleteBtnText: { fontFamily: font.semibold, fontSize: 15, color: colors.dangerText },
});
