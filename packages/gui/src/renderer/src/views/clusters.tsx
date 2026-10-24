import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useIsFetching, useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, FilePlus2, History, RotateCw, Star } from 'lucide-react';
import type { Cluster } from '@hodor/core';
import { api, errorMessage } from '../api';
import { useClusterHealth, useClusters, useProduction, useSettings } from '../queries';
import { ErrorBlock, Skeleton } from '../components/states';
import { Command } from '../components/command';
import { MergeDialog } from '../components/merge-dialog';
import { useMergeFlow } from '../merge';
import { formatTime, tildify } from '../format';

export const clusterPath = (id: string) => `/clusters/${encodeURIComponent(id)}`;

/** Shorten a connection error to its useful part: "getaddrinfo ENOTFOUND host" → "ENOTFOUND host" */
export function shortReason(error = ''): string {
  const reason = error
    .replace(/^.*?(E[A-Z]{3,}\b)/, '$1')
    .replace(/^Timed out after (\d+)ms$/, 'timed out');
  return reason.length > 48 ? `${reason.slice(0, 47)}…` : reason;
}

const HealthCell: React.FC<{ cluster: Cluster }> = ({ cluster }) => {
  const { t } = useTranslation();
  const health = useClusterHealth(cluster.id);

  if (!health.data) {
    return <span className="pill">{t('clusters.checking')}</span>;
  }
  return health.data.reachable ? (
    <span className="pill pos">{t('clusters.up', { version: health.data.version })}</span>
  ) : (
    <>
      <span className="pill neg">{t('clusters.down')}</span>
      <span className="sub">{shortReason(health.data.error)}</span>
    </>
  );
};

export const ClustersView: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const clusters = useClusters();
  const settings = useSettings();
  const production = useProduction();
  const checking = useIsFetching({ queryKey: ['health'] }) > 0;
  const navigate = useNavigate();
  const merge = useMergeFlow();
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const exporting = useMutation({
    mutationFn: (ids: string[]) => api.kubeconfig.exportContexts(ids),
  });

  // Design-review hook for the browser preview only (?merge=1); dropped from real builds
  useEffect(() => {
    if (
      import.meta.env.MODE === 'fixtures' &&
      new URLSearchParams(window.location.search).has('merge')
    )
      merge.choose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = clusters.data ?? [];
  const healths = useQueries({
    queries: list.map((c) => ({
      queryKey: ['health', c.id],
      queryFn: () => api.clusters.health(c.id),
      staleTime: 30_000,
    })),
  });
  const settled = healths.filter((h) => h.data);
  const up = settled.filter((h) => h.data?.reachable).length;
  const checkedAt = Math.max(0, ...healths.map((h) => h.dataUpdatedAt));
  const kubectlDefault = list.find((c) => c.isDefault);
  const lastUsed = settings.data?.lastUsedCluster;
  const multipleFiles = new Set(list.map((c) => c.sourceFile)).size > 1;
  const empty = clusters.isSuccess && list.length === 0;
  // Clusters that disappeared (a kubeconfig changed) drop out of the selection
  const chosen = list.filter((c) => selected.has(c.id)).map((c) => c.id);
  const allSelected = list.length > 0 && chosen.length === list.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['clusters'] });
    queryClient.invalidateQueries({ queryKey: ['health'] });
  };

  let sub = '';
  if (list.length > 0) {
    sub =
      settled.length < list.length
        ? t('clusters.subChecking', { count: list.length })
        : t('clusters.sub', { up, count: list.length });
    if (kubectlDefault) sub += ` · ${t('clusters.subDefault', { name: kubectlDefault.name })}`;
  }

  return (
    <section
      className={dragging ? 'view dropping' : 'view'}
      aria-labelledby="clusters-title"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) merge.dropped(files);
      }}
    >
      {dragging && (
        <div className="drop-hint" aria-hidden="true">
          <FilePlus2 />
          {t('clusters.dropHint')}
        </div>
      )}

      <div className="title-row">
        <div>
          <h1 id="clusters-title">{t('clusters.title')}</h1>
          <p className="sub">
            {clusters.isPending ? <Skeleton width={280} /> : sub || t('clusters.subEmpty')}
          </p>
        </div>
        <div className="actions">
          {chosen.length > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => exporting.mutate(chosen)}
              disabled={exporting.isPending}
            >
              <Download aria-hidden="true" />
              {t('clusters.exportSelected', { count: chosen.length })}
            </button>
          )}
          {checkedAt > 0 && settled.length === list.length && (
            <span className="stamp num">
              {t('common.checkedAt', { time: formatTime(checkedAt) })}
            </span>
          )}
          {!empty && (
            <button type="button" className="btn" onClick={refresh} disabled={checking}>
              <RotateCw aria-hidden="true" />
              {t('common.refresh')}
            </button>
          )}
          {!empty && (
            <button type="button" className="btn" onClick={merge.choose} disabled={merge.busy}>
              <FilePlus2 aria-hidden="true" />
              {t('clusters.merge')}
            </button>
          )}
        </div>
      </div>

      {exporting.isError && (
        <p className="inline-error" role="alert">
          {t('clusters.exportFailed', { message: errorMessage(exporting.error) })}
        </p>
      )}
      {exporting.data && (
        <p className="inline-success" role="status">
          {t('clusters.exported', {
            count: exporting.data.contexts.length,
            file: tildify(exporting.data.file),
          })}
          {exporting.data.renamed.length > 0 &&
            ` ${t('clusters.exportRenamed', {
              list: exporting.data.renamed.map((r) => `${r.from} → ${r.to}`).join(', '),
            })}`}
        </p>
      )}
      {merge.error && (
        <p className="inline-error" role="alert">
          {t('merge.failedFiles', { message: merge.error })}
        </p>
      )}
      {merge.outcome && (
        <p className="inline-success" role="status">
          {merge.outcome.added.length
            ? t('merge.done', {
                count: merge.outcome.added.length,
                names: merge.outcome.added.join(', '),
              })
            : t('merge.doneNothing')}
        </p>
      )}

      {clusters.isError ? (
        <ErrorBlock
          message={t('clusters.error', { message: errorMessage(clusters.error) })}
          onRetry={refresh}
        />
      ) : empty ? (
        <div className="start drop-zone">
          <h2>{t('clusters.emptyTitle')}</h2>
          <p>{t('clusters.emptyBody')}</p>
          <div className="start-actions">
            <button
              type="button"
              className="btn primary"
              onClick={merge.choose}
              disabled={merge.busy}
            >
              <FilePlus2 aria-hidden="true" />
              {t('clusters.chooseFile')}
            </button>
            <span className="muted">{t('clusters.orTerminal')}</span>
            <Command value="hodor config:merge ~/Downloads/kubeconfig.yaml" />
          </div>
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th className="check-col">
                  <input
                    type="checkbox"
                    aria-label={t('clusters.selectAll')}
                    checked={allSelected}
                    disabled={list.length === 0}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(list.map((c) => c.id)))
                    }
                  />
                </th>
                <th>
                  <span className="visually-hidden">{t('clusters.colMarks')}</span>
                </th>
                <th>{t('clusters.colContext')}</th>
                <th>{t('clusters.colNamespace')}</th>
                {multipleFiles && <th>{t('clusters.colKubeconfig')}</th>}
                <th className="n">{t('clusters.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {clusters.isPending
                ? [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td className="check-col" />
                      <td className="mark" />
                      <td className="identity">
                        <Skeleton width={140} />
                        <span className="sub">
                          <Skeleton width={220} height={12} />
                        </span>
                      </td>
                      <td>
                        <Skeleton width={64} />
                      </td>
                      <td className="n">
                        <Skeleton width={96} height={22} />
                      </td>
                    </tr>
                  ))
                : list.map((cluster) => (
                    <tr
                      key={cluster.id}
                      className="clickable"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a, button, input, label')) return;
                        navigate(clusterPath(cluster.id));
                      }}
                    >
                      <td className="check-col">
                        <input
                          type="checkbox"
                          aria-label={t('clusters.select', { name: cluster.name })}
                          checked={selected.has(cluster.id)}
                          onChange={() => toggle(cluster.id)}
                        />
                      </td>
                      <td className="mark">
                        {cluster.isDefault ? (
                          <span role="img" aria-label={t('clusters.defaultMark')}>
                            <Star className="star" aria-hidden="true" />
                          </span>
                        ) : cluster.id === lastUsed ? (
                          <span role="img" aria-label={t('clusters.lastUsedMark')}>
                            <History className="mark-icon" aria-hidden="true" />
                          </span>
                        ) : null}
                      </td>
                      <td className="identity">
                        <span className="name-line">
                          <Link
                            to={clusterPath(cluster.id)}
                            className={
                              cluster.isDefault ? 'row-link strong truncate' : 'row-link truncate'
                            }
                          >
                            {cluster.name}
                          </Link>
                          {production.isProduction(cluster.id) && (
                            <span className="tag prod">{t('clusters.prodTag')}</span>
                          )}
                        </span>
                        <span className="sub truncate">{cluster.server}</span>
                      </td>
                      <td>{cluster.namespace ?? 'default'}</td>
                      {multipleFiles && <td className="mono">{tildify(cluster.sourceFile)}</td>}
                      <td className="n">
                        <HealthCell cluster={cluster} />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {clusters.isSuccess && (
            <p className="legend">
              <span>
                <Star className="star" aria-hidden="true" /> {t('clusters.defaultMark')}
              </span>
              <span>
                <History className="mark-icon" aria-hidden="true" /> {t('clusters.lastUsedMark')}
              </span>
              <span>{t('clusters.dropLegend')}</span>
            </p>
          )}
        </>
      )}

      <MergeDialog preview={merge.preview} onClose={merge.close} />
    </section>
  );
};
