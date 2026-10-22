import { useIsFetching, useQueries, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { History, RotateCw, Star } from 'lucide-react';
import type { Cluster } from '@hodor/core';
import { api, errorMessage } from '../api';
import { useClusterHealth, useClusters, useSettings } from '../queries';
import { Empty, ErrorBlock, Skeleton } from '../components/states';
import { formatTime, tildify } from '../format';

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
    <section className="view" aria-labelledby="clusters-title">
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
        </div>
      </div>

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
                  <tr key={cluster.id}>
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
                      <span
                        className="truncate"
                        style={{ fontWeight: cluster.isDefault ? 500 : 400 }}
                      >
                        {cluster.name}
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
      )}
    </section>
  );
};
