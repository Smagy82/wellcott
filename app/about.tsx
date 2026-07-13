import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../src/components/Text';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Warning, List, CaretRight } from 'phosphor-react-native';
import { theme } from '../src/theme';

const { colors, font, radius, spacing, shadow } = theme;

const DISCLAIMER_KEYS = ['disclaimer1', 'disclaimer2', 'disclaimer3', 'disclaimer4'] as const;

export default function AboutScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: t('about.appTitle') }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Emergency block */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <Warning size={22} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.emergencyTitle}>{t('about.emergencyTitle')}</Text>
          </View>
          <Text style={styles.emergencyBody}>{t('about.emergencyBody')}</Text>
        </View>

        {/* About the app */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('about.appTitle')}</Text>
          <Text style={styles.body}>{t('about.appDescription')}</Text>
        </View>

        {/* First visit prep entry */}
        <TouchableOpacity
          style={styles.prepCard}
          activeOpacity={0.8}
          onPress={() => router.push('/first-visit')}
        >
          <List size={22} color={colors.tintBlueIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.prepTitle}>{t('firstVisit.aboutEntry_title')}</Text>
            <Text style={styles.prepSub}>{t('firstVisit.aboutEntry_sub')}</Text>
          </View>
          <CaretRight size={18} color={colors.tintBlueIcon} />
        </TouchableOpacity>

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
    backgroundColor: colors.dangerBg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.danger,
    padding: spacing.lg,
  },
  emergencyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  emergencyTitle: { fontFamily: font.bold, fontSize: 15, color: colors.danger },
  emergencyBody: { fontFamily: font.regular, fontSize: 14, color: colors.danger, lineHeight: 21 },

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

  prepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tintBlue,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 12,
    ...shadow,
  },
  prepTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.tintBlueIcon, marginBottom: 2 },
  prepSub: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted },

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
