import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ThemePreference } from '@hodor/core';
import { api, errorMessage } from '../api';
import { Command } from '../components/command';
import { LANGUAGES } from '../i18n';
import { useAppInfo, useSettings, useUpdateCheck } from '../queries';
import { Skeleton } from '../components/states';
import { tildify } from '../format';

const THEMES: Array<{ value: ThemePreference; key: string }> = [
  { value: 'system', key: 'settings.themeSystem' },
  { value: 'light', key: 'settings.themeLight' },
  { value: 'dark', key: 'settings.themeDark' },
];

/** Is `hodor` on the PATH, and a button to put it there */
const CommandLine: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ['cli'], queryFn: () => api.app.cliStatus() });
  const install = useMutation({
    mutationFn: () => api.app.installCli(),
    onSuccess: (next) => queryClient.setQueryData(['cli'], next),
  });
  const state = status.data?.state;
  const canInstall = state === 'missing' || state === 'other' || state === 'notOnPath';

  return (
    <div className="setting">
      <div>
        <h2>{t('settings.cli')}</h2>
        <p className="desc">{t('settings.cliDesc')}</p>
      </div>
      <div className="panel">
        {!status.data ? (
          <Skeleton width={240} />
        ) : (
          <p className={state === 'installed' ? 'cli-state ok' : 'cli-state'}>
            {t(`settings.cliState.${state}`, {
              path: tildify(status.data.path ?? status.data.target ?? ''),
            })}
          </p>
        )}
        {canInstall && (
          <button
            type="button"
            className="btn"
            onClick={() => install.mutate()}
            disabled={install.isPending}
          >
            {install.isPending ? t('settings.cliInstalling') : t('settings.cliInstall')}
          </button>
        )}
        {install.isError && <p className="inline-error">{errorMessage(install.error)}</p>}
        <Command value="hodor --help" />
      </div>
    </div>
  );
};

/** Current version against the newest release */
const UpdateLine: React.FC = () => {
  const { t } = useTranslation();
  const update = useUpdateCheck();
  if (update.isPending) return <Skeleton width={200} />;
  if (!update.data) return <p className="hint">{t('settings.updateUnknown')}</p>;
  if (!update.data.latest)
    return <p className="hint">{t('settings.upToDate', { version: update.data.current })}</p>;
  return (
    <p>
      {t('settings.updateAvailable', { version: update.data.latest })}{' '}
      <button
        type="button"
        className="link-btn"
        onClick={() => api.app.openRelease(update.data!.url!)}
      >
        {t('settings.openRelease')}
      </button>
    </p>
  );
};

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

      <CommandLine />

      <div className="setting">
        <div>
          <h2 id="updates">{t('settings.updates')}</h2>
          <p className="desc">{t('settings.updatesDesc')}</p>
        </div>
        <div className="panel">
          <label className="row switch-row-full">
            <span>{t('settings.checkUpdates')}</span>
            <input
              type="checkbox"
              className="switch plain"
              checked={settings.data?.checkUpdates !== false}
              onChange={(e) => update.mutate({ checkUpdates: e.target.checked })}
            />
          </label>
          <UpdateLine />
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
            <dd className="num">
              {info.data ? (
                <>
                  {info.data.version}
                  {info.data.codename && <span className="muted"> · {info.data.codename}</span>}
                </>
              ) : (
                <Skeleton width={80} />
              )}
            </dd>
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
