import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DoorOpen, Layers, Server, Settings, Star } from 'lucide-react';
import { Mark } from './components/mark';
import { useAppInfo, useClusters, useProduction, useRunning, useSettings } from './queries';
import { clusterPath } from './views/clusters';

export const Shell: React.FC = () => {
  const { t } = useTranslation();
  const info = useAppInfo();
  const clusters = useClusters();
  const running = useRunning();
  const settings = useSettings();
  const production = useProduction();

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
        <NavLink to="/clusters" end className="nav-item">
          <Server aria-hidden="true" />
          {t('nav.clusters')}
        </NavLink>
        {selected && (
          <NavLink to={clusterPath(selected.id)} className="nav-item nav-sub">
            <span className="visually-hidden">{t('nav.selectedCluster')}: </span>
            <span className="truncate">{selected.name}</span>
          </NavLink>
        )}
        <NavLink to="/templates" className="nav-item">
          <Layers aria-hidden="true" />
          {t('nav.templates')}
        </NavLink>
        <NavLink to="/running" className="nav-item">
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
          <NavLink to="/settings" className="nav-item">
            <Settings aria-hidden="true" />
            {t('nav.settings')}
          </NavLink>
          {info.data && <p className="version num">v{info.data.version}</p>}
        </div>
      </nav>

      <main className="sheet">
        <Outlet />
      </main>
    </div>
  );
};
