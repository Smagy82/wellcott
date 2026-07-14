import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../src/components/Text';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash, Receipt, Plus } from 'phosphor-react-native';
import { useBills, parseCategories } from '../src/lib/useBills';
import { getSignedUrl } from '../src/lib/uploadPhoto';
import type { Bill } from '../src/lib/useBills';
import { theme } from '../src/theme';

const { colors, radius, font, shadow } = theme;

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  visit:     { bg: colors.tintMint,  text: colors.tintMintIcon },
  labs:      { bg: colors.tintBlue,  text: colors.tintBlueIcon },
  meds:      { bg: colors.tintPeach, text: colors.tintPeachIcon },
  procedure: { bg: colors.tintLilac, text: colors.tintLilacIcon },
  other:     { bg: colors.surfaceAlt, text: colors.textMuted },
};

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
function formatAmount(n: number) { return '$' + n.toFixed(2); }

function PhotoThumb({ path }: { path: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => { getSignedUrl(path).then(setUri); }, [path]);
  if (!uri) return <View style={styles.photoPlaceholder} />;
  return <Image source={{ uri }} style={styles.photoThumb} />;
}

function BillCard({ item, onDelete, onPress }: { item: Bill; onDelete: () => void; onPress: () => void }) {
  const { t } = useTranslation();
  const cats = parseCategories(item.category);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {item.photo_path ? <PhotoThumb path={item.photo_path} /> : null}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.amount}>{formatAmount(Number(item.amount))}</Text>
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
        {item.merchant ? <Text style={styles.merchant}>{item.merchant}</Text> : null}
        <Text style={styles.date}>{formatDate(item.bill_date)}</Text>
        {item.note ? <Text style={styles.note} numberOfLines={2}>{item.note}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDelete(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.deleteBtn}>
        <Trash size={20} color={colors.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function BillsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { bills, loading, deleteBill, reload, totalSpent } = useBills();

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('bills.navTitle')} />
      <FlatList
        data={bills}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BillCard
            item={item}
            onDelete={() => deleteBill(item.id)}
            onPress={() => router.push(`/bill/${item.id}` as Parameters<typeof router.push>[0])}
          />
        )}
        contentContainerStyle={[styles.list, bills.length === 0 && styles.listEmpty]}
        ListHeaderComponent={
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('bills.totalSpent')}</Text>
            <Text style={styles.summaryAmount}>{formatAmount(totalSpent)}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Receipt size={52} color={colors.muted} />
            <Text style={styles.emptyTitle}>{t('bills.empty')}</Text>
            <Text style={styles.emptySub}>{t('bills.emptySub')}</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/bill-add'); }} activeOpacity={0.85}>
        <Plus size={28} color="#fff" weight="bold" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: 16, gap: 10, paddingBottom: 96 },
  listEmpty: { flexGrow: 1 },

  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  summaryLabel: { fontFamily: font.semibold, color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 },
  summaryAmount: { fontFamily: font.bold, color: '#fff', fontSize: 36 },

  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontFamily: font.bold, fontSize: 17, color: colors.text, marginTop: 14, marginBottom: 6 },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadow,
  },
  photoThumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  photoPlaceholder: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' },
  amount: { fontFamily: font.bold, fontSize: 18, color: colors.text },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: font.semibold, fontSize: 11 },
  merchant: { fontFamily: font.regular, fontSize: 13, color: colors.text, marginBottom: 2 },
  date: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted },
  note: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
  deleteBtn: { padding: 4 },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
