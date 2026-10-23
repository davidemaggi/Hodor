import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import it from './locales/it.json';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
] as const;

export const isSupported = (code?: string) => LANGUAGES.some((l) => l.code === code);

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, it: { translation: it } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

/** Follow the language saved in settings; <html lang> too, for screen readers */
export function applyLanguage(code?: string): void {
  const lng = isSupported(code) ? code! : 'en';
  if (i18n.language !== lng) void i18n.changeLanguage(lng);
  document.documentElement.lang = lng;
}

export default i18n;
