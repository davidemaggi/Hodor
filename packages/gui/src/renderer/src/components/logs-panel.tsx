import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api';
import { formatTime } from '../format';

/** Recent log lines of one forward, refreshed while open */
export const LogsPanel: React.FC<{ templateId: string; forward: string }> = ({
  templateId,
  forward,
}) => {
  const { t } = useTranslation();
  const logs = useQuery({
    queryKey: ['logs', templateId, forward],
    queryFn: () => api.running.logs(templateId, forward),
    refetchInterval: 1500,
  });

  return (
    <div className="logs-panel" aria-label={t('running.logsFor', { name: forward })}>
      {logs.isError ? (
        <p className="inline-error">{errorMessage(logs.error)}</p>
      ) : !logs.data ? null : logs.data.length === 0 ? (
        <p className="hint">{t('running.noLogs')}</p>
      ) : (
        <ol className="log-lines" aria-live="polite">
          {logs.data.slice(-80).map((line, i) => (
            <li key={i} data-level={line.level}>
              <time className="num">{formatTime(line.time, true)}</time>
              <span className="level">{line.level}</span>
              <span className="message">{line.message}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
