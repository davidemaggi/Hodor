import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Square } from 'lucide-react';
import type { RunningForward, RunningTemplate } from '../../../shared/api';
import { api, errorMessage } from '../api';
import { useRunning, useTemplates } from '../queries';
import { Empty, ErrorBlock, Skeleton } from '../components/states';
import { Command, CopyButton } from '../components/command';
import { formatTime } from '../format';

const Door: React.FC<{ forward: RunningForward }> = ({ forward }) => {
  const { t } = useTranslation();
  const address = `127.0.0.1:${forward.localPort}`;

  return (
    <div className="door" data-state={forward.listening ? 'open' : 'closed'}>
      <span className="port num">:{forward.localPort}</span>
      <div>
        <span className="name-line">
          <span className="name">{forward.name}</span>
          {!forward.listening && <span className="pill neg">{t('running.notListening')}</span>}
        </span>
        <span className="target">
          {t('running.target', {
            namespace: forward.namespace,
            kind: forward.resourceType,
            name: forward.resourceName,
            port: forward.remotePort,
          })}
        </span>
        {!forward.listening && (
          <span className="hint">{t('running.notListeningHint', { address })}</span>
        )}
      </div>
      <CopyButton value={address} label={t('running.copy')} />
    </div>
  );
};

const Run: React.FC<{ run: RunningTemplate }> = ({ run }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const stop = useMutation({
    mutationFn: () => api.running.stop(run.templateId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['running'] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  return (
    <article className="run" aria-labelledby={`run-${run.templateId}`}>
      <div className="run-head">
        <div>
          <h2 id={`run-${run.templateId}`}>{run.templateName}</h2>
          <p className="meta num">
            {t(run.source === 'app' ? 'running.metaApp' : 'running.metaCli', {
              cluster: run.clusterName,
              time: formatTime(run.startedAt),
            })}
          </p>
        </div>
        <button
          type="button"
          className="btn danger"
          onClick={() => stop.mutate()}
          disabled={stop.isPending}
        >
          <Square aria-hidden="true" />
          {stop.isPending ? t('running.stopping') : t('running.stop')}
        </button>
      </div>
      {stop.isError && <p className="inline-error">{errorMessage(stop.error)}</p>}
      {run.forwards.map((f) => (
        <Door key={f.name} forward={f} />
      ))}
    </article>
  );
};

/** Nothing running: offer the user's own templates, each with its run command */
const StartOne: React.FC = () => {
  const { t } = useTranslation();
  const templates = useTemplates();
  const list = (templates.data ?? []).slice(0, 6);

  if (list.length === 0) {
    return <Empty title={t('running.emptyTitle')} bodyKey="running.emptyBody" />;
  }

  return (
    <div className="start">
      <h2>{t('running.startOne')}</h2>
      <p className="note">{t('running.startOneDesc')}</p>
      <ul className="start-list">
        {list.map((tpl) => (
          <li key={tpl.id}>
            <div>
              <span className="name">{tpl.name}</span>
              <span className="ports num">
                {tpl.forwards.map((f) => (
                  <span key={f.name}>:{f.localPort}</span>
                ))}
              </span>
            </div>
            <Command value={`hodor template:run ${tpl.name}`} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export const RunningView: React.FC = () => {
  const { t } = useTranslation();
  const running = useRunning();
  const list = running.data ?? [];
  const doors = list.reduce((sum, r) => sum + r.forwards.length, 0);
  const closed = list.reduce((sum, r) => sum + r.forwards.filter((f) => !f.listening).length, 0);

  let sub =
    list.length === 0
      ? t('running.subNone')
      : list.length === 1
        ? t('running.subSingle', {
            template: list[0].templateName,
            count: doors,
            cluster: list[0].clusterName,
          })
        : t('running.sub', { count: doors, templates: list.length });
  if (closed > 0) sub += ` · ${t('running.subClosed', { count: closed })}`;

  return (
    <section className="view" aria-labelledby="running-title">
      <div className="title-row">
        <div>
          <h1 id="running-title">{t('running.title')}</h1>
          <p className="sub" aria-live="polite">
            {running.isPending ? <Skeleton width={260} /> : sub}
          </p>
        </div>
      </div>

      {running.isError ? (
        <ErrorBlock
          message={t('running.error', { message: errorMessage(running.error) })}
          onRetry={() => running.refetch()}
        />
      ) : running.isPending ? (
        <div className="run">
          <Skeleton width={120} height={16} />
          {[0, 1].map((i) => (
            <div className="door" key={i}>
              <Skeleton width={110} height={28} />
              <Skeleton width={220} />
              <span />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <StartOne />
      ) : (
        list.map((run) => <Run key={run.templateId} run={run} />)
      )}
    </section>
  );
};
