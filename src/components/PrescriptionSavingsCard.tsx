import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { openPrescriptionSavings } from '../config/partners';
import { theme } from '../theme';

const { colors, font, shadow, radius, spacing } = theme;

export function PrescriptionSavingsCard() {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="medkit" size={22} color={colors.primary} style={{ marginRight: 8 }} />
        <Text style={styles.cardTitle}>{t('prescriptions.cardTitle')}</Text>
      </View>

      <Text style={styles.body}>{t('prescriptions.cardBody')}</Text>

      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={openPrescriptionSavings}
      >
        <Ionicons name="open-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.btnText}>{t('prescriptions.cardButton')}</Text>
      </Pressable>

      <Text style={styles.disclaimer}>{t('prescriptions.cardDisclaimer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: '#D8E4EE',
    padding: 18,
    marginHorizontal: spacing.lg,
    marginBottom: 20,
    ...shadow,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { fontFamily: font.medium, fontSize: 16, color: colors.text },

  body: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: 14,
  },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 13,
  },
  btnPressed: { opacity: 0.82 },
  btnText: { fontFamily: font.semibold, color: '#fff', fontSize: 15 },

  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
  },
});
