import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from '../../src/components/Text';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { setLanguage, type AppLanguage } from '../../src/i18n/index';
import { theme } from '../../src/theme';

const { colors, radius, spacing, font, shadow } = theme;

function getInitials(name: string): string {
  return (
    name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'U'
  );
}

function getGreeting(t: (key: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return t('profile.greetingMorning');
  if (h < 18) return t('profile.greetingAfternoon');
  return t('profile.greetingEvening');
}

function getDateLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

type CardProps = {
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function MenuCard({ iconName, iconBg, iconColor, title, subtitle, onPress }: CardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={24} color={iconColor} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setFullName(data.user?.user_metadata?.full_name ?? t('profile.defaultName'));
      setLoadingUser(false);
    });
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
  };

  const handleShareApp = async () => {
    try { await Share.share({ message: t('profile.shareAppText') }); } catch { /* cancelled */ }
  };

  if (loadingUser) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.greeting}>{getGreeting(t)}</Text>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.dateLabel}>{getDateLabel()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <MenuCard
          iconName="heart-outline"
          iconBg={colors.tintYellow}
          iconColor={colors.tintYellowIcon}
          title={t('profile.savedClinics')}
          subtitle={t('profile.savedClinicsSub')}
          onPress={() => router.push('/favorites')}
        />
        <MenuCard
          iconName="time-outline"
          iconBg={colors.tintBlue}
          iconColor={colors.tintBlueIcon}
          title={t('profile.visitHistory')}
          subtitle={t('profile.visitHistorySub')}
          onPress={() => router.push('/visits')}
        />
        <MenuCard
          iconName="receipt-outline"
          iconBg={colors.tintPeach}
          iconColor={colors.tintPeachIcon}
          title={t('profile.expenses')}
          subtitle={t('profile.expensesSub')}
          onPress={() => router.push('/bills')}
        />
      </View>

      <View style={[styles.section, { marginTop: spacing.md }]}>
        <View style={styles.card}>
          <View style={[styles.iconBox, { backgroundColor: colors.tintLilac }]}>
            <Ionicons name="language-outline" size={24} color={colors.tintLilacIcon} />
          </View>
          <Text style={[styles.cardTitle, { flex: 1 }]}>{t('profile.language')}</Text>
          <View style={styles.langChips}>
            {(['en', 'es'] as AppLanguage[]).map((lang) => {
              const active = i18n.language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langChip, active && styles.langChipActive]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                    {lang.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <MenuCard
          iconName="share-social-outline"
          iconBg={colors.tintBlue}
          iconColor={colors.tintBlueIcon}
          title={t('profile.shareApp')}
          subtitle={t('profile.shareAppSub')}
          onPress={handleShareApp}
        />
        <MenuCard
          iconName="information-circle-outline"
          iconBg={colors.tintMint}
          iconColor={colors.tintMintIcon}
          title={t('profile.about')}
          subtitle={t('profile.aboutSub')}
          onPress={() => router.push('/about')}
        />
      </View>

      <TouchableOpacity
        style={[styles.signOutBtn, signingOut && styles.signOutBtnDisabled]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        <Text style={styles.signOutText}>
          {signingOut ? t('profile.signingOut') : t('profile.signOut')}
        </Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  avatarText: { fontFamily: font.bold, color: '#fff', fontSize: 22 },
  headerInfo: { flex: 1 },
  greeting: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginBottom: 2 },
  name: { fontFamily: font.bold, fontSize: 22, color: colors.text, marginBottom: 2 },
  dateLabel: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted },

  section: { paddingHorizontal: spacing.lg, gap: spacing.md },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardText: { flex: 1 },
  cardTitle: { fontFamily: font.semibold, fontSize: 16, color: colors.text, marginBottom: 2 },
  cardSub: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted },

  signOutBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl + spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  signOutBtnDisabled: { opacity: 0.5 },
  signOutText: { fontFamily: font.medium, color: colors.danger, fontSize: 15 },

  langChips: { flexDirection: 'row', gap: 6 },
  langChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
  },
  langChipActive: { borderColor: colors.primary, backgroundColor: colors.tintBlue },
  langChipText: { fontFamily: font.semibold, fontSize: 13, color: colors.textMuted },
  langChipTextActive: { color: colors.primary },
});
