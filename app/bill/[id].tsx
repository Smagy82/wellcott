import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Text } from '../../src/components/Text';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { PencilSimple, Trash } from 'phosphor-react-native';
import { useBills, parseCategories } from '../../src/lib/useBills';
import { getSignedUrl } from '../../src/lib/uploadPhoto';
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

export default function BillDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bills, loading, deleteBill, reload } = useBills();
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const bill = bills.find(b => b.id === id);

  useEffect(() => {
    if (bill?.photo_path) {
      getSignedUrl(bill.photo_path).then(setPhotoUri);
    } else {
      setPhotoUri(null);
    }
  }, [bill?.photo_path]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!bill) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t('billDetail.notFound')}</Text>
      </View>
    );
  }

  const cats = parseCategories(bill.category);

  const handleDelete = () => {
    Alert.alert(
      t('billDetail.deleteConfirmTitle'),
      t('billDetail.deleteConfirmMessage'),
      [
        { text: t('billDetail.deleteConfirmCancel'), style: 'cancel' },
        {
          text: t('billDetail.deleteConfirmOk'),
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteBill(bill.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('billDetail.navTitle')} />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.amountCard}>
          <Text style={styles.amountValue}>{formatAmount(Number(bill.amount))}</Text>
          <Text style={styles.amountDate}>{formatDate(bill.bill_date)}</Text>
        </View>

        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('billDetail.labelCategory')}</Text>
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

        {bill.merchant ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('billDetail.labelWhere')}</Text>
            <Text style={styles.sectionValue}>{bill.merchant}</Text>
          </View>
        ) : null}

        {bill.note ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('billDetail.labelNote')}</Text>
            <Text style={styles.sectionValue}>{bill.note}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push(`/bill-add?id=${bill.id}` as Parameters<typeof router.push>[0])}
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

  amountCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    ...shadow,
  },
  amountValue: { fontFamily: font.bold, color: '#fff', fontSize: 40 },
  amountDate:  { fontFamily: font.regular, color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 },

  photo: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    marginBottom: 16,
    backgroundColor: colors.surfaceAlt,
  },

  section: { marginBottom: 18 },
  sectionLabel: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionValue: { fontFamily: font.regular, fontSize: 15, color: colors.text, lineHeight: 22 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: font.semibold, fontSize: 13 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
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
