import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../src/components/Text';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'phosphor-react-native';
import {
  init as initSaved,
  getSaved,
  toggleSaved,
  subscribe as subscribeSaved,
  type SavedClinic,
} from '../src/store/savedClinics';
import { theme } from '../src/theme';

const { colors, radius, font, shadow } = theme;

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [clinics, setClinics] = useState<SavedClinic[]>([]);

  useEffect(() => {
    initSaved().then(() => getSaved().then(setClinics)).catch(() => {});
    return subscribeSaved(() => { getSaved().then(setClinics).catch(() => {}); });
  }, []);

  if (clinics.length === 0) {
    return (
      <View style={styles.center}>
        <Heart size={52} color={colors.muted} />
        <Text style={styles.emptyTitle}>{t('favorites.empty')}</Text>
        <Text style={styles.emptySub}>{t('favorites.emptySub')}</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: SavedClinic }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/clinic/${encodeURIComponent(item.id)}`)}
      activeOpacity={0.75}
    >
      <View style={styles.cardText}>
        <Text style={styles.cardName}>{item.name}</Text>
        {item.address ? (
          <Text style={styles.cardAddress}>{item.address}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => toggleSaved(item.id).catch(() => {})}
      >
        <Heart weight="fill" size={22} color={colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={clinics}
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
  emptySub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },

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
  cardAddress: { fontFamily: font.regular, fontSize: 13, color: colors.muted, lineHeight: 18 },
});
