import '../src/i18n'; // initialise i18n before any render

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { Text } from 'react-native';
import { useAuth } from '../src/lib/useAuth';
import { initLanguage } from '../src/i18n';
import { theme } from '../src/theme';

// Apply Poppins globally to all RN Text nodes
if (!Text.defaultProps) (Text as any).defaultProps = {};
(Text as any).defaultProps.style = { fontFamily: theme.font.regular };

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.bg,
    card: theme.colors.bg,
    text: theme.colors.text,
    primary: theme.colors.primary,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    initLanguage().then(() => setLangReady(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded && langReady) SplashScreen.hideAsync();
  }, [fontsLoaded, langReady]);

  if (!fontsLoaded || !langReady) return null;

  return <RootLayoutNav />;
}

const headerStyle = {
  headerStyle: { backgroundColor: theme.colors.bg },
  headerTintColor: theme.colors.primary,
  headerTitleStyle: {
    fontFamily: theme.font.semibold,
    color: theme.colors.text,
    fontSize: 17,
  },
  headerShadowVisible: false,
};

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'auth';
    if (!session && !inAuth) {
      router.replace('/auth');
    } else if (session && inAuth) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  if (loading) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="favorites" options={{ title: 'Saved clinics', ...headerStyle }} />
        <Stack.Screen name="visits"    options={{ title: 'Visit history', ...headerStyle }} />
        <Stack.Screen name="visit-add" options={{ title: 'Add visit', presentation: 'modal', ...headerStyle }} />
        <Stack.Screen name="bills"     options={{ title: 'Expenses', ...headerStyle }} />
        <Stack.Screen name="bill-add"  options={{ title: 'Add expense', presentation: 'modal', ...headerStyle }} />
        <Stack.Screen name="modal"     options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
