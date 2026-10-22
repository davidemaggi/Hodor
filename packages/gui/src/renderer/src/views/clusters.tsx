import { useIsFetching, useQueries, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus2, History, RotateCw, Star } from 'lucide-react';
import type { Cluster } from '@hodor/core';
import { api, errorMessage } from '../api';
import { useClusterHealth, useClusters, useSettings } from '../queries';
import { Empty, ErrorBlock, Skeleton } from '../components/states';
import { formatTime, tildify } from '../format';
import { MergeDialog } from '../components/merge-dialog';
import { useMergeFlow } from '../merge';

export const clusterPath = (id: string) => `/clusters/${encodeURIComponent(id)}`;

const HealthCell: React.FC<{ cluster: Cluster }> = ({ cluster }) => {
  const { t } = useTranslation();
  const health = useClusterHealth(cluster.id);

  if (!health.data) {
    return <span className="pill">{t('clusters.checking')}</span>;
  }
  return health.data.reachable ? (
    <span className="pill pos">{t('clusters.up', { version: health.data.version })}</span>
  ) : (
    <span className="pill neg" title={health.data.error}>
      {t('clusters.down')}
    </span>
  );
};

export const ClustersView: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const clusters = useClusters();
  const settings = useSettings();
  const checking = useIsFetching({ queryKey: ['health'] }) > 0;
  const navigate = useNavigate();
  const merge = useMergeFlow();
  const [dragging, setDragging] = useState(false);

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
  const multipleFiles = new Set(list.map((c) => c.sourceFile)).size > 1;

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
          <p className="sub">{clusters.isPending ? <Skeleton width={280} /> : sub || ' '}</p>
        </div>
        <div className="actions">
          {checkedAt > 0 && settled.length === list.length && (
            <span className="stamp num">
              {t('common.checkedAt', { time: formatTime(checkedAt) })}
            </span>
          )}
          <button type="button" className="btn" onClick={refresh} disabled={checking}>
            <RotateCw aria-hidden="true" />
            {t('common.refresh')}
          </button>
          <button type="button" className="btn" onClick={merge.choose} disabled={merge.busy}>
            <FilePlus2 aria-hidden="true" />
            {t('clusters.merge')}
          </button>
        </div>
      </div>

      {merge.error && (
        <p className="inline-error" role="alert">
          {t('merge.failed', { message: merge.error })}
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
      ) : clusters.isSuccess && list.length === 0 ? (
        <Empty title={t('clusters.emptyTitle')} bodyKey="clusters.emptyBody" />
      ) : (
        <table>
          <thead>
            <tr>
              <th aria-label={t('clusters.defaultMark')} />
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
                    aria-selected={cluster.id === settings.data?.lastUsedCluster}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a')) return;
                      navigate(clusterPath(cluster.id));
                    }}
                  >
                    <td className="mark">
                      {cluster.isDefault ? (
                        <span
                          title={t('clusters.defaultMark')}
                          role="img"
                          aria-label={t('clusters.defaultMark')}
                        >
                          <Star className="star" aria-hidden="true" />
                        </span>
                      ) : cluster.id === settings.data?.lastUsedCluster ? (
                        <span
                          title={t('clusters.lastUsedMark')}
                          role="img"
                          aria-label={t('clusters.lastUsedMark')}
                        >
                          <History className="mark-icon" aria-hidden="true" />
                        </span>
                      ) : null}
                    </td>
                    <td className="identity">
                      <Link
                        to={clusterPath(cluster.id)}
                        className={
                          cluster.isDefault ? 'row-link strong truncate' : 'row-link truncate'
                        }
                      >
                        {cluster.name}
                      </Link>
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
      )}
      <MergeDialog preview={merge.preview} onClose={merge.close} />
    </section>
  );
};
