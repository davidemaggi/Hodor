import { useEffect } from 'react';
import type { ThemePreference } from '@hodor/core';

/** Put data-theme on <html>: Snow ("light") or Night ("dark"), resolving "system" from the OS */
export function useTheme(preference: ThemePreference | undefined): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const pref = preference ?? 'system';
      const dark = pref === 'dark' || (pref === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);
}
