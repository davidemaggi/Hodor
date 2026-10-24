import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import type { TemplateSummary } from '../../../shared/api';
import { api, errorMessage } from '../api';
import { useClusters, useProduction, useRunning, useSettings } from '../queries';

interface StartDialogProps {
  template: TemplateSummary | null;
  onClose: (started: boolean) => void;
}

/** Pick the cluster a template runs on; the template itself carries none */
export const StartDialog: React.FC<StartDialogProps> = ({ template, onClose }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const clusters = useClusters();
  const settings = useSettings();
  const running = useRunning();
  const production = useProduction();
  const [clusterId, setClusterId] = useState('');
  // Production clusters take a second, explicit yes
  const [confirming, setConfirming] = useState(false);

  const start = useMutation({
    mutationFn: () => api.running.start(template!.id, clusterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['running'] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      onClose(true);
    },
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (template && !dialog.open) {
      start.reset();
      setConfirming(false);
      const list = clusters.data ?? [];
      const preferred =
        list.find((c) => c.id === settings.data?.lastUsedCluster) ??
        list.find((c) => c.isDefault) ??
        list[0];
      setClusterId(preferred?.id ?? '');
      dialog.showModal();
    }
    if (!template && dialog.open) dialog.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  // Local ports already held by other running templates: those forwards would fail
  const busy = new Map<number, string>();
  for (const r of running.data ?? [])
    for (const f of r.forwards) busy.set(f.localPort, r.templateName);
  const clashes = template?.forwards.filter((f) => busy.has(f.localPort)) ?? [];
  const isProd = !!clusterId && production.isProduction(clusterId);
  const clusterName = clusters.data?.find((c) => c.id === clusterId)?.name;

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="start-title"
      onCancel={() => onClose(false)}
    >
      {template && confirming && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            start.mutate();
          }}
        >
          <h2 id="start-title">{t('start.confirmTitle')}</h2>
          <p className="dialog-block">
            <Trans
              i18nKey="start.confirmBody"
              values={{ cluster: clusterName, count: template.forwards.length }}
              components={{ strong: <strong /> }}
            />
          </p>
          <ul className="name-list dialog-block">
            {template.forwards.map((f) => (
              <li key={f.name}>
                :{f.localPort} → {f.namespace}/{f.resourceName}:{f.remotePort}
              </li>
            ))}
          </ul>
          {start.isError && (
            <p className="inline-error" role="alert">
              {errorMessage(start.error)}
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={() => setConfirming(false)} autoFocus>
              {t('start.back')}
            </button>
            <button type="submit" className="btn danger-fill" disabled={start.isPending}>
              <Play aria-hidden="true" />
              {start.isPending
                ? t('start.starting')
                : t('start.confirmRun', { cluster: clusterName })}
            </button>
          </div>
        </form>
      )}
      {template && !confirming && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            if (!clusterId) return;
            if (isProd) setConfirming(true);
            else start.mutate();
          }}
        >
          <h2 id="start-title">{t('start.title', { name: template.name })}</h2>
          <p className="sub">{t('start.sub', { count: template.forwards.length })}</p>

          <label className="field dialog-block">
            <span>{t('start.cluster')}</span>
            <select
              className="select wide"
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
              autoFocus
            >
              {(clusters.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {production.isProduction(c.id) ? ` (${t('clusters.prodTag')})` : ''}
                  {c.isDefault ? ` · ${t('clusters.defaultMark')}` : ''}
                </option>
              ))}
            </select>
          </label>

          <ul className="name-list dialog-block">
            {template.forwards.map((f) => (
              <li key={f.name}>
                :{f.localPort} → {f.namespace}/{f.resourceName}:{f.remotePort}
              </li>
            ))}
          </ul>

          {isProd && (
            <p className="notice-prod" role="alert">
              {t('start.prod')}
            </p>
          )}
          {clashes.length > 0 && (
            <p className="hint warn-text">
              {t('start.clash', {
                list: clashes.map((f) => `:${f.localPort} (${busy.get(f.localPort)})`).join(', '),
              })}
            </p>
          )}
          {start.isError && (
            <p className="inline-error" role="alert">
              {errorMessage(start.error)}
            </p>
          )}

          <div className="dialog-actions">
            <button type="button" className="btn" onClick={() => onClose(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn primary" disabled={!clusterId || start.isPending}>
              <Play aria-hidden="true" />
              {start.isPending
                ? t('start.starting')
                : isProd
                  ? t('start.runOn', { cluster: clusterName })
                  : t('start.run')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
};
