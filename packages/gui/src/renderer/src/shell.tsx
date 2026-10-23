import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DoorOpen, Layers, Search, Server, Settings, Star } from 'lucide-react';
import { Mark } from './components/mark';
import {
  useAppInfo,
  useClusters,
  useProduction,
  useRunning,
  useSettings,
  useUpdateCheck,
} from './queries';
import { api } from './api';
import { clusterPath } from './views/clusters';
import { Palette } from './components/palette';
import { useShortcuts } from './hooks/use-shortcuts';

export const Shell: React.FC = () => {
  const { t } = useTranslation();
  const info = useAppInfo();
  const clusters = useClusters();
  const running = useRunning();
  const settings = useSettings();
  const production = useProduction();
  const update = useUpdateCheck();
  const [palette, setPalette] = useState(false);
  const openPalette = useCallback(() => setPalette(true), []);
  useShortcuts(openPalette);
  // Design-review hook for the browser preview only (?palette=1); dropped from real builds
  useEffect(() => {
    if (
      import.meta.env.MODE === 'fixtures' &&
      new URLSearchParams(window.location.search).has('palette')
    )
      setPalette(true);
  }, []);
  const mod = info.data?.platform === 'darwin' ? '⌘' : 'Ctrl+';

  const kubectlDefault = clusters.data?.find((c) => c.isDefault);
  const selected = clusters.data?.find((c) => c.id === settings.data?.lastUsedCluster);
  const doors = running.data?.reduce((sum, r) => sum + r.forwards.length, 0) ?? 0;
  const prodDefault = !!kubectlDefault && production.isProduction(kubectlDefault.id);

  return (
    <div className="app" data-platform={info.data?.platform}>
      <div className="brand">
        <Mark />
        <span>Hodor</span>
      </div>

      <header className="topbar">
        {clusters.isSuccess && (
          <NavLink
            to={kubectlDefault ? clusterPath(kubectlDefault.id) : '/clusters'}
            className={prodDefault ? 'scope prod' : 'scope'}
            aria-label={t('scope.title', { name: kubectlDefault?.name ?? t('scope.none') })}
          >
            <span>{t('scope.kubectl')}</span>
            <Star className="star" aria-hidden="true" />
            <strong>{kubectlDefault?.name ?? t('scope.none')}</strong>
            {prodDefault && <span className="tag prod">{t('clusters.prodTag')}</span>}
          </NavLink>
        )}
      </header>

      <nav className="sidebar" aria-label={t('nav.label')}>
        <NavLink to="/clusters" end className="nav-item" title={`${mod}1`}>
          <Server aria-hidden="true" />
          {t('nav.clusters')}
        </NavLink>
        {selected && (
          <NavLink to={clusterPath(selected.id)} className="nav-item nav-sub">
            <span className="visually-hidden">{t('nav.selectedCluster')}: </span>
            <span className="truncate">{selected.name}</span>
          </NavLink>
        )}
        <NavLink to="/templates" className="nav-item" title={`${mod}2`}>
          <Layers aria-hidden="true" />
          {t('nav.templates')}
        </NavLink>
        <NavLink to="/running" className="nav-item" title={`${mod}3`}>
          <DoorOpen aria-hidden="true" />
          {t('nav.running')}
          {doors > 0 && (
            <span className="count num">
              <span aria-hidden="true">{doors}</span>
              <span className="visually-hidden">{t('nav.doorsHeld', { count: doors })}</span>
            </span>
          )}
        </NavLink>
        <div className="bottom">
          <button type="button" className="nav-item palette-hint" onClick={openPalette}>
            <Search aria-hidden="true" />
            {t('palette.open')}
            <kbd>{mod}K</kbd>
          </button>
          <NavLink to="/settings" className="nav-item" title={`${mod}4`}>
            <Settings aria-hidden="true" />
            {t('nav.settings')}
          </NavLink>
          {update.data?.latest && update.data.url && (
            <button
              type="button"
              className="update-note"
              onClick={() => api.app.openRelease(update.data!.url!)}
            >
              {t('nav.updateAvailable', { version: update.data.latest })}
            </button>
          )}
          {info.data && (
            <p className="version num">
              v{info.data.version}
              {info.data.codename ? ` · ${info.data.codename}` : ''}
            </p>
          )}
        </div>
      </nav>

      <main className="sheet">
        <Outlet />
      </main>
      <Palette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
};
