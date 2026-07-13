import '../src/i18n';

import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  useFonts,
} from '@expo-google-fonts/figtree';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useAuth } from '../src/lib/useAuth';
import { initLanguage } from '../src/i18n';
import { theme } from '../src/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.bg,
    card:       theme.colors.card,
    text:       theme.colors.text,
    primary:    theme.colors.primary,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const [langReady, setLangReady] = useState(false);

  useEffect(() => { if (fontError) throw fontError; }, [fontError]);
  useEffect(() => { initLanguage().then(() => setLangReady(true)); }, []);
  useEffect(() => {
    if (fontsLoaded && langReady) SplashScreen.hideAsync();
  }, [fontsLoaded, langReady]);

  if (!fontsLoaded || !langReady) return null;
  return <RootLayoutNav />;
}

const headerStyle = {
  headerShown: false,
};

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'auth';
    if (!session && !inAuth) router.replace('/auth');
    else if (session && inAuth) router.replace('/(tabs)');
  }, [session, loading, segments]);

  if (loading) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ ...headerStyle }}>
        <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
        <Stack.Screen name="auth"        options={{ headerShown: false }} />
        <Stack.Screen name="clinic/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="favorites"   options={{ headerShown: false }} />
        <Stack.Screen name="visits"      options={{ headerShown: false }} />
        <Stack.Screen name="visit-add"   options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="bills"       options={{ headerShown: false }} />
        <Stack.Screen name="bill-add"    options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="first-visit" options={{ headerShown: false }} />
        <Stack.Screen name="modal"       options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
