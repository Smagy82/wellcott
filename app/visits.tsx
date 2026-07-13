import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Text } from '../src/components/Text';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash, Clock, Plus } from 'phosphor-react-native';
import { useVisits } from '../src/lib/useVisits';
import type { Visit } from '../src/lib/useVisits';
import { theme } from '../src/theme';

const { colors, radius, font, shadow } = theme;

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function VisitsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { visits, loading, deleteVisit, reload } = useVisits();

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const renderItem = ({ item }: { item: Visit }) => {
    const title = item.clinic_name || item.reason || 'Visit';
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardName}>{title}</Text>
          <Text style={styles.cardDate}>{formatDate(item.visit_date)}</Text>
          {item.reason && item.clinic_name ? (
            <Text style={styles.cardReason}>{item.reason}</Text>
          ) : null}
          {item.note ? (
            <Text style={styles.cardNote} numberOfLines={2}>{item.note}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => deleteVisit(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={visits}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, visits.length === 0 && styles.listEmpty]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Clock size={52} color={colors.muted} />
            <Text style={styles.emptyTitle}>{t('visits.empty')}</Text>
            <Text style={styles.emptySub}>{t('visits.emptySub')}</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/visit-add')} activeOpacity={0.85}>
        <Plus size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: 16, gap: 10, paddingBottom: 96 },
  listEmpty: { flexGrow: 1 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontFamily: font.bold, fontSize: 17, color: colors.text, marginTop: 14, marginBottom: 6 },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow,
  },
  cardLeft: { flex: 1, marginRight: 12 },
  cardName: { fontFamily: font.semibold, fontSize: 15, color: colors.text, marginBottom: 3 },
  cardDate: { fontFamily: font.semibold, fontSize: 13, color: colors.primary, marginBottom: 3 },
  cardReason: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginBottom: 2 },
  cardNote: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
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
