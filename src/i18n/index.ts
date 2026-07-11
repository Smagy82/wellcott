import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import es from './locales/es.json';

const STORAGE_KEY = 'app_language';
export type AppLanguage = 'en' | 'es';

function systemLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code === 'es' ? 'es' : 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: systemLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

// Called once in _layout.tsx before first render to apply saved preference
export async function initLanguage(): Promise<void> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'es') {
    await i18n.changeLanguage(saved);
  }
}

// Use anywhere to switch language; persists across restarts
export async function setLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
