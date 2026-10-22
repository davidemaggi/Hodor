import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './styles/tokens.css';
import './styles/app.css';
import './i18n';
import { Shell } from './shell';
import { useSettings } from './queries';
import { useTheme } from './theme';
import { ClustersView } from './views/clusters';
import { TemplatesView } from './views/templates';
import { RunningView } from './views/running';
import { SettingsView } from './views/settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

const App: React.FC = () => {
  const settings = useSettings();
  useTheme(settings.data?.theme);

  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/clusters" element={<ClustersView />} />
          <Route path="/templates" element={<TemplatesView />} />
          <Route path="/running" element={<RunningView />} />
          <Route path="/settings" element={<SettingsView />} />
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
