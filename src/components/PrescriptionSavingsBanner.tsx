import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { openPrescriptionSavings } from '../config/partners';
import { theme } from '../theme';

const { font } = theme;

const GREEN = '#1D9E75';
const BG    = '#E4F5EE';
const TITLE = '#0F5C43';
const BODY  = '#1A7A5C';

export function PrescriptionSavingsBanner() {
  const { t } = useTranslation();

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={openPrescriptionSavings}
    >
      <View style={styles.iconBox}>
        <Ionicons name="medkit" size={26} color="#fff" />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>{t('prescriptions.bannerTitle')}</Text>
        <Text style={styles.body}>{t('prescriptions.bannerSub')}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={GREEN} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  pressed: { opacity: 0.8 },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textBlock: { flex: 1 },
  title: { fontFamily: font.medium, fontSize: 15, color: TITLE, marginBottom: 3 },
  body:  { fontFamily: font.regular, fontSize: 13, color: BODY, lineHeight: 18 },
});
