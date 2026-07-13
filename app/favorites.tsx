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
import { Heart } from 'phosphor-react-native';
import { useFavorites } from '../src/lib/useFavorites';
import type { Favorite } from '../src/lib/useFavorites';
import { theme } from '../src/theme';

const { colors, radius, font, shadow } = theme;

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { favorites, loading, toggleFavorite, reload } = useFavorites();

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (favorites.length === 0) {
    return (
      <View style={styles.center}>
        <Heart size={52} color={colors.muted} />
        <Text style={styles.emptyTitle}>{t('favorites.empty')}</Text>
        <Text style={styles.emptySub}>{t('favorites.emptySub')}</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Favorite }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/clinic/${encodeURIComponent(item.clinic_id)}`)}
      activeOpacity={0.75}
    >
      <View style={styles.cardText}>
        <Text style={styles.cardName}>{item.clinic_name}</Text>
        {item.clinic_address ? (
          <Text style={styles.cardAddress}>{item.clinic_address}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={async () => {
          await toggleFavorite({
            clinic_id: item.clinic_id,
            clinic_name: item.clinic_name,
            clinic_address: item.clinic_address,
          });
          reload();
        }}
      >
        <Heart weight="fill" size={22} color={colors.danger} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={favorites}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: colors.bg }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.bg,
  },
  emptyTitle: { fontFamily: font.bold, fontSize: 17, color: colors.text, marginTop: 14, marginBottom: 6 },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },

  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow,
  },
  cardText: { flex: 1, marginRight: 12 },
  cardName: { fontFamily: font.semibold, fontSize: 15, color: colors.text, marginBottom: 3 },
  cardAddress: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
