import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';

const { colors, font, radius, spacing, shadow } = theme;

const CHECKLIST_KEYS = ['bringId', 'bringIncome', 'bringAddress', 'bringMeds'] as const;
const DISCLAIMER_KEYS = ['disclaimer1', 'disclaimer2', 'disclaimer3', 'disclaimer4'] as const;

export default function AboutScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('about.appTitle') }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Emergency block */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <Ionicons name="warning" size={22} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.emergencyTitle}>{t('about.emergencyTitle')}</Text>
          </View>
          <Text style={styles.emergencyBody}>{t('about.emergencyBody')}</Text>
        </View>

        {/* About the app */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('about.appTitle')}</Text>
          <Text style={styles.body}>{t('about.appDescription')}</Text>
        </View>

        {/* Checklist */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('about.bringTitle')}</Text>
          {CHECKLIST_KEYS.map((key) => (
            <View key={key} style={styles.checkRow}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.primary}
                style={styles.checkIcon}
              />
              <Text style={styles.checkText}>{t(`about.${key}`)}</Text>
            </View>
          ))}
          <Text style={styles.checkNote}>{t('about.bringNote')}</Text>
        </View>

        {/* Disclaimers */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('about.disclaimersTitle')}</Text>
          {DISCLAIMER_KEYS.map((key) => (
            <View key={key} style={styles.disclaimerRow}>
              <Text style={styles.disclaimerBullet}>·</Text>
              <Text style={styles.disclaimerText}>{t(`about.${key}`)}</Text>
            </View>
          ))}
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('about.contactTitle')}</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:hello@wellcott.app')}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.link}>hello@wellcott.app</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://wellcott.app/privacy')}
            style={{ marginTop: 10 }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.link}>{t('about.privacyPolicy')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: 12, paddingBottom: 48 },

  emergencyCard: {
    backgroundColor: '#FFF3F3',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.danger,
    padding: spacing.lg,
  },
  emergencyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  emergencyTitle: { fontFamily: font.bold, fontSize: 15, color: colors.danger },
  emergencyBody: { fontFamily: font.regular, fontSize: 14, color: '#B03030', lineHeight: 21 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  body: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
  },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  checkIcon: { marginRight: 10, marginTop: 1 },
  checkText: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  checkNote: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 4,
    fontStyle: 'italic',
  },

  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  disclaimerBullet: {
    fontFamily: font.bold,
    fontSize: 18,
    color: colors.textMuted,
    lineHeight: 22,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },

  link: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
