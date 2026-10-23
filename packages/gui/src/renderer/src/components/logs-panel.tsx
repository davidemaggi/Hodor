import { useEffect, useRef } from 'react';
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
  const list = useRef<HTMLOListElement>(null);
  const following = useRef(true);

  // Follow the tail unless the user scrolled up to read
  useEffect(() => {
    const el = list.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [logs.data]);

  return (
    <div className="logs-panel" aria-label={t('running.logsFor', { name: forward })}>
      {logs.isError ? (
        <p className="inline-error">{errorMessage(logs.error)}</p>
      ) : !logs.data ? null : logs.data.length === 0 ? (
        <p className="hint">{t('running.noLogs')}</p>
      ) : (
        <ol
          className="log-lines"
          ref={list}
          tabIndex={0}
          onScroll={(e) => {
            const el = e.currentTarget;
            following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
        >
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
