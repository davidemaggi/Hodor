import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { KeyRound, Play, RotateCw, ScrollText, Square } from 'lucide-react';
import type { RunningForward, RunningTemplate, TemplateSummary } from '../../../shared/api';
import { api, errorMessage } from '../api';
import { useRunning, useTemplates } from '../queries';
import { Empty, ErrorBlock, Skeleton } from '../components/states';
import { Command, CopyButton } from '../components/command';
import { ConfirmDialog } from '../components/confirm-dialog';
import { LogsPanel } from '../components/logs-panel';
import { ValuesPanel } from '../components/values-panel';
import { StartDialog } from '../components/start-dialog';
import { formatTime } from '../format';

type DoorState = 'running' | 'error' | 'stopped' | 'closed';

function doorState(f: RunningForward): DoorState {
  if (f.status) return f.status;
  return f.listening ? 'running' : 'closed';
}

const Door: React.FC<{ run: RunningTemplate; forward: RunningForward }> = ({ run, forward }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Design-review hook for the browser preview only (?panel=logs|values opens it on the postgres forward)
  const preview =
    import.meta.env.MODE === 'fixtures' && forward.name === 'postgres'
      ? new URLSearchParams(window.location.search).get('panel')
      : null;
  const [panel, setPanel] = useState<'logs' | 'values' | null>(
    preview === 'logs' || preview === 'values' ? preview : null
  );
  const address = `127.0.0.1:${forward.localPort}`;
  const state = doorState(forward);
  const linked = forward.secrets.length + forward.configMaps.length;

  const toggle = useMutation({
    mutationFn: () =>
      api.running.forward(run.templateId, forward.name, state === 'running' ? 'stop' : 'start'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['running'] }),
  });

  return (
    <div className="door-wrap">
      <div className="door" data-state={state === 'running' ? 'open' : 'closed'}>
        <span className="port num">:{forward.localPort}</span>
        <div>
          <span className="name-line">
            <span className="name">{forward.name}</span>
            {state === 'error' && <span className="pill neg">{t('running.error_state')}</span>}
            {state === 'stopped' && <span className="pill">{t('running.stopped_state')}</span>}
            {state === 'closed' && <span className="pill neg">{t('running.notListening')}</span>}
            {state === 'running' &&
              forward.connections !== undefined &&
              forward.connections > 0 && (
                <span className="muted small">
                  {t('running.connections', { count: forward.connections })}
                </span>
              )}
          </span>
          <span className="target">
            {t('running.target', {
              namespace: forward.namespace,
              kind: forward.resourceType,
              name: forward.resourceName,
              port: forward.remotePort,
            })}
            {forward.pod && forward.resourceType !== 'pod' ? ` · ${forward.pod}` : ''}
          </span>
          {state === 'error' && forward.error && (
            <span className="field-error block">{forward.error}</span>
          )}
          {state === 'closed' && (
            <span className="hint">{t('running.notListeningHint', { address })}</span>
          )}
        </div>
        <div className="door-actions">
          {linked > 0 && (
            <button
              type="button"
              className="btn ghost"
              aria-expanded={panel === 'values'}
              onClick={() => setPanel(panel === 'values' ? null : 'values')}
            >
              <KeyRound aria-hidden="true" />
              {t('running.values', { count: linked })}
            </button>
          )}
          {run.controllable && (
            <button
              type="button"
              className="btn ghost"
              aria-expanded={panel === 'logs'}
              onClick={() => setPanel(panel === 'logs' ? null : 'logs')}
            >
              <ScrollText aria-hidden="true" />
              {t('running.logs')}
            </button>
          )}
          {run.controllable && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
            >
              {state === 'running' ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
              {state === 'running' ? t('running.stopForward') : t('running.startForward')}
            </button>
          )}
          <CopyButton value={address} label={t('running.copy')} />
        </div>
      </div>
      {toggle.isError && <p className="inline-error door-note">{errorMessage(toggle.error)}</p>}
      {panel === 'logs' && <LogsPanel templateId={run.templateId} forward={forward.name} />}
      {panel === 'values' && <ValuesPanel templateId={run.templateId} forward={forward.name} />}
    </div>
  );
};

const Run: React.FC<{ run: RunningTemplate }> = ({ run }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: ['running'] });
    queryClient.invalidateQueries({ queryKey: ['templates'] });
  };
  const stop = useMutation({
    mutationFn: () => api.running.stop(run.templateId),
    onSettled: settle,
  });
  const restart = useMutation({
    mutationFn: () => api.running.restart(run.templateId),
    onSettled: settle,
  });
  const errors = run.forwards.filter(
    (f) => doorState(f) === 'error' || doorState(f) === 'closed'
  ).length;

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
            {errors > 0 && (
              <span className="neg-text"> · {t('running.problems', { count: errors })}</span>
            )}
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => restart.mutate()}
            disabled={restart.isPending}
          >
            <RotateCw aria-hidden="true" />
            {restart.isPending ? t('running.restarting') : t('running.restart')}
          </button>
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
      </div>
      {(stop.isError || restart.isError) && (
        <p className="inline-error">{errorMessage(stop.error || restart.error)}</p>
      )}
      {!run.controllable && <p className="hint run-note">{t('running.fromTerminal')}</p>}
      {run.forwards.map((f) => (
        <Door key={f.name} run={run} forward={f} />
      ))}
    </article>
  );
};

/** Nothing running: start one of the user's templates */
const StartOne: React.FC<{ onStart: (t: TemplateSummary) => void }> = ({ onStart }) => {
  const { t } = useTranslation();
  const templates = useTemplates();
  const list = (templates.data ?? []).slice(0, 8);

  if (list.length === 0) {
    return <Empty title={t('running.emptyTitle')} bodyKey="running.emptyBody" />;
  }

  return (
    <div className="start">
      <h2>{t('running.startOne')}</h2>
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
            <button type="button" className="btn" onClick={() => onStart(tpl)}>
              <Play aria-hidden="true" />
              {t('running.startIt')}
            </button>
          </li>
        ))}
      </ul>
      <p className="note">
        {t('running.orTerminal')} <Command value="hodor template:run name" />
      </p>
    </div>
  );
};

export const RunningView: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const running = useRunning();
  const [starting, setStarting] = useState<TemplateSummary | null>(null);
  const [confirmStopAll, setConfirmStopAll] = useState(false);
  const list = running.data ?? [];
  const doors = list.reduce((sum, r) => sum + r.forwards.length, 0);
  const problems = list.reduce(
    (sum, r) => sum + r.forwards.filter((f) => ['error', 'closed'].includes(doorState(f))).length,
    0
  );

  const stopAll = useMutation({
    mutationFn: () => api.running.stopAll(),
    onSettled: () => {
      setConfirmStopAll(false);
      queryClient.invalidateQueries({ queryKey: ['running'] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

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
  if (problems > 0) sub += ` · ${t('running.subClosed', { count: problems })}`;

  return (
    <section className="view" aria-labelledby="running-title">
      <div className="title-row">
        <div>
          <h1 id="running-title">{t('running.title')}</h1>
          <p className="sub" aria-live="polite">
            {running.isPending ? <Skeleton width={260} /> : sub}
          </p>
        </div>
        {list.length > 0 && (
          <div className="actions">
            <button type="button" className="btn danger" onClick={() => setConfirmStopAll(true)}>
              <Square aria-hidden="true" />
              {t('running.stopAll')}
            </button>
          </div>
        )}
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
        <StartOne onStart={setStarting} />
      ) : (
        list.map((run) => <Run key={run.templateId} run={run} />)
      )}

      <StartDialog template={starting} onClose={() => setStarting(null)} />
      <ConfirmDialog
        open={confirmStopAll}
        title={t('running.stopAllTitle')}
        body={<p>{t('running.stopAllBody', { count: list.length })}</p>}
        confirmLabel={t('running.stopAll')}
        cancelLabel={t('merge.cancel')}
        busy={stopAll.isPending}
        onConfirm={() => stopAll.mutate()}
        onCancel={() => setConfirmStopAll(false)}
      />
    </section>
  );
};
