import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../src/lib/supabase';
import { theme } from '../src/theme';

const { colors, radius, font, shadow } = theme;

export default function AuthScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: e } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (e) throw e;
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (e) throw e;
      }
    } catch (e: any) {
      setError(e?.message ?? t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>{t('auth.appName')}</Text>
        <Text style={styles.title}>
          {mode === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
        </Text>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder={t('auth.fullName')}
            placeholderTextColor={colors.textMuted}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            returnKeyType="next"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? t('auth.loading') : mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toggle} onPress={toggle}>
          <Text style={styles.toggleText}>
            {mode === 'signin' ? t('auth.noAccount') : t('auth.haveAccount')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 24,
    ...shadow,
  },
  logo: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: { fontFamily: font.bold, fontSize: 22, color: colors.text, marginBottom: 20 },
  input: {
    fontFamily: font.regular,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  errorText: { fontFamily: font.regular, fontSize: 13, color: colors.danger, marginBottom: 10 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontFamily: font.bold, color: '#fff', fontSize: 15 },
  toggle: { marginTop: 18, alignItems: 'center' },
  toggleText: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },
});
