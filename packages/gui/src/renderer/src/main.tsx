import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ClusterDetailView } from './views/cluster-detail';
import { clusterPath } from './views/clusters';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './styles/tokens.css';
import './styles/app.css';
import './i18n';
import { Shell } from './shell';
import { useClusters, useSettings } from './queries';
import { useTheme } from './theme';
import { ClustersView } from './views/clusters';
import { TemplatesView } from './views/templates';
import { RunningView } from './views/running';
import { SettingsView } from './views/settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

/** On launch, reopen the cluster used last; otherwise the cluster list */
const Start: React.FC = () => {
  const settings = useSettings();
  const clusters = useClusters();
  if (settings.isPending || clusters.isPending) return null;
  const last = clusters.data?.find((c) => c.id === settings.data?.lastUsedCluster);
  return <Navigate to={last ? clusterPath(last.id) : '/clusters'} replace />;
};

// Files dropped outside a drop zone must never make the window navigate to them
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

const App: React.FC = () => {
  const settings = useSettings();
  useTheme(settings.data?.theme);

  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/clusters" element={<ClustersView />} />
          <Route path="/clusters/:id" element={<ClusterDetailView />} />
          <Route path="/templates" element={<TemplatesView />} />
          <Route path="/running" element={<RunningView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/" element={<Start />} />
          <Route path="*" element={<Navigate to="/clusters" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
