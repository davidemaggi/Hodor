import i18next from 'i18next';
import { SettingsStorage } from '@hodor/core';
import en from './locales/en.json' with { type: 'json' };
import it from './locales/it.json' with { type: 'json' };

export const SUPPORTED_LANGUAGES = ['en', 'it'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

const i18n = i18next.createInstance();

/**
 * Map a BCP 47 tag ("it", "it-IT", "it_IT.UTF-8") to a supported language, or undefined
 */
export function resolveLanguage(value?: string | null): Language | undefined {
  const base = value?.trim().toLowerCase().split(/[-_.]/)[0];
  return SUPPORTED_LANGUAGES.find((lang) => lang === base);
}

/**
 * HODOR_LANG wins when set; otherwise the `language` saved in ~/.hodor/settings.json (shared with the app).
 * Anything unsupported falls back to English.
 */
async function detectLanguage(): Promise<Language> {
  const fromEnv = process.env.HODOR_LANG;
  if (fromEnv) return resolveLanguage(fromEnv) ?? DEFAULT_LANGUAGE;

  try {
    const settings = new SettingsStorage();
    await settings.load();
    return resolveLanguage(settings.get('language')) ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Initialise translations. Call once, before any command output (including Commander's help).
 */
export async function initI18n(language?: string): Promise<Language> {
  const lng = resolveLanguage(language) ?? (await detectLanguage());
  await i18n.init({
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    resources: {
      en: { translation: en },
      it: { translation: it },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
  return lng;
}

/**
 * Current language (falls back to English before initI18n has run)
 */
export function getLanguage(): Language {
  return resolveLanguage(i18n.language) ?? DEFAULT_LANGUAGE;
}

/**
 * Translate a key. Pass `count` for plurals (`key_one` / `key_other`).
 */
export function t(key: string, vars?: Record<string, unknown>): string {
  return i18n.t(key, vars as any) as unknown as string;
}
