import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ThemePreference } from '@hodor/core';
import { api } from '../api';
import { LANGUAGES } from '../i18n';
import { useAppInfo, useSettings } from '../queries';
import { Skeleton } from '../components/states';
import { tildify } from '../format';

const THEMES: Array<{ value: ThemePreference; key: string }> = [
  { value: 'system', key: 'settings.themeSystem' },
  { value: 'light', key: 'settings.themeLight' },
  { value: 'dark', key: 'settings.themeDark' },
];

export const SettingsView: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useSettings();
  const info = useAppInfo();
  const [saved, setSaved] = useState(false);

  const update = useMutation({
    mutationFn: api.settings.update,
    onSuccess: (next) => {
      queryClient.setQueryData(['settings'], next);
      setSaved(true);
    },
  });

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(timer);
  }, [saved]);

  return (
    <section className="view" aria-labelledby="settings-title">
      <div className="title-row">
        <div>
          <h1 id="settings-title">{t('settings.title')}</h1>
          <p className="sub">
            {info.data ? (
              t('settings.sub', { dir: tildify(info.data.dataDir) })
            ) : (
              <Skeleton width={240} />
            )}
          </p>
        </div>
        <div className="actions">
          <span className="saved" aria-live="polite">
            {saved ? t('settings.saved') : ''}
          </span>
        </div>
      </div>

      <div className="setting">
        <div>
          <h2 id="appearance">{t('settings.appearance')}</h2>
          <p className="desc">{t('settings.appearanceDesc')}</p>
        </div>
        <div className="panel">
          <div className="segmented" role="group" aria-labelledby="appearance">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                aria-pressed={settings.data?.theme === theme.value}
                onClick={() => update.mutate({ theme: theme.value })}
              >
                {t(theme.key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="setting">
        <div>
          <h2>
            <label htmlFor="language">{t('settings.language')}</label>
          </h2>
          <p className="desc">{t('settings.languageDesc')}</p>
        </div>
        <div className="panel">
          <select
            id="language"
            className="select"
            value={settings.data?.language ?? 'en'}
            onChange={(e) => update.mutate({ language: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="setting">
        <div>
          <h2>{t('settings.about')}</h2>
          <p className="desc">{t('settings.aboutDesc')}</p>
        </div>
        <div className="panel">
          <dl>
            <dt>{t('settings.version')}</dt>
            <dd className="num">{info.data?.version ?? <Skeleton width={80} />}</dd>
            <dt>{t('settings.kubectl')}</dt>
            <dd className={info.data?.kubectl ? 'mono' : undefined}>
              {info.data ? (
                (info.data.kubectl ?? t('settings.kubectlMissing'))
              ) : (
                <Skeleton width={160} />
              )}
            </dd>
            <dt>{t('settings.dataDir')}</dt>
            <dd className="mono">
              {info.data ? tildify(info.data.dataDir) : <Skeleton width={120} />}
            </dd>
          </dl>
        </div>
      </div>
    </section>
  );
};
