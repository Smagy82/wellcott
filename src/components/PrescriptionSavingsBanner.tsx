import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { openPrescriptionSavings } from '../config/partners';
import { theme } from '../theme';

const { colors, font, radius } = theme;

export function PrescriptionSavingsBanner({ isShareGuarded }: { isShareGuarded?: () => boolean }) {
  const { t } = useTranslation();

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={() => { if (isShareGuarded?.()) return; openPrescriptionSavings(); }}
    >
      <View style={styles.iconBox}>
        <Ionicons name="medkit" size={26} color="#fff" />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>{t('prescriptions.bannerTitle')}</Text>
        <Text style={styles.body}>{t('prescriptions.bannerSub')}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.tintBlue,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 10,
  },
  pressed: { opacity: 0.8 },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textBlock: { flex: 1 },
  title: { fontFamily: font.medium, fontSize: 15, color: colors.tintBlueIcon, marginBottom: 3 },
  body:  { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
