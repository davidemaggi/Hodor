import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search, Star } from 'lucide-react';
import type { PodView, ServicePortView, ServiceView } from '@hodor/core';
import { api, errorMessage } from '../api';
import { useAppInfo, useClusterHealth, useClusters } from '../queries';
import { ErrorBlock, Skeleton } from '../components/states';
import { MergeDialog } from '../components/merge-dialog';
import { Command } from '../components/command';
import { useMergeFlow } from '../merge';
import { formatAge, tildify } from '../format';

const BAD = /crash|error|fail|backoff|oomkilled|invalid|evicted/i;
const WAITING = /pending|creating|init|terminating|unknown/i;

function statusClass(status: string): string | undefined {
  if (BAD.test(status)) return 'pill neg';
  if (WAITING.test(status)) return 'pill warn';
  return undefined;
}

function servicePort(p: ServicePortView): string {
  const target = p.targetPort === p.port ? '' : ` → ${p.targetPort}`;
  const proto = p.protocol === 'TCP' ? '' : `/${p.protocol}`;
  return `${p.port}${target}${proto}`;
}

const Count: React.FC<{ shown: number; total?: number; filtered: boolean }> = ({
  shown,
  total,
  filtered,
}) => {
  const { t } = useTranslation();
  if (!total) return null;
  return (
    <span className="stamp num">{filtered ? t('detail.count', { shown, total }) : total}</span>
  );
};

const matches = (query: string, ...values: Array<string | number | undefined>) =>
  !query || values.some((v) => v !== undefined && String(v).toLowerCase().includes(query));

export const ClusterDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const [filter, setFilter] = useState('');
  const queryClient = useQueryClient();
  const clusters = useClusters();
  const info = useAppInfo();
  const merge = useMergeFlow();

  const cluster = clusters.data?.find((c) => c.id === id);
  const health = useClusterHealth(id);

  // Remember this cluster: it is selected again after a restart
  useEffect(() => {
    if (!cluster) return;
    api.clusters
      .select(cluster.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['settings'] }));
  }, [cluster?.id, queryClient]);

  const namespaces = useQuery({
    queryKey: ['namespaces', id],
    queryFn: () => api.clusters.namespaces(id),
    enabled: !!cluster,
    retry: false,
  });

  const list = namespaces.data?.namespaces ?? [];
  const preferred = cluster?.namespace || 'default';
  const namespace =
    search.get('ns') || (list.includes(preferred) ? preferred : list[0]) || preferred;

  const services = useQuery({
    queryKey: ['services', id, namespace],
    queryFn: () => api.clusters.services(id, namespace),
    enabled: namespaces.isSuccess,
  });
  const pods = useQuery({
    queryKey: ['pods', id, namespace],
    queryFn: () => api.clusters.pods(id, namespace),
    enabled: namespaces.isSuccess,
    refetchInterval: 10_000,
  });

  const invalidateClusters = () => queryClient.invalidateQueries({ queryKey: ['clusters'] });
  const setContext = useMutation({
    mutationFn: () => api.kubectl.setContext(id),
    onSuccess: invalidateClusters,
  });
  const setNamespace = useMutation({
    mutationFn: () => api.kubectl.setNamespace(id, namespace),
    onSuccess: invalidateClusters,
  });

  const query = filter.trim().toLowerCase();
  const shownServices = useMemo(
    () =>
      (services.data ?? []).filter((s: ServiceView) =>
        matches(query, s.name, s.type, ...s.ports.flatMap((p) => [p.port, p.targetPort, p.name]))
      ),
    [services.data, query]
  );
  const shownPods = useMemo(
    () =>
      (pods.data ?? []).filter((p: PodView) =>
        matches(query, p.name, p.status, p.owner, ...p.ports.flatMap((x) => [x.port, x.name]))
      ),
    [pods.data, query]
  );

  if (clusters.isSuccess && !cluster) {
    return (
      <section className="view">
        <Link to="/clusters" className="back">
          <ChevronLeft aria-hidden="true" />
          {t('nav.clusters')}
        </Link>
        <ErrorBlock message={t('detail.gone')} onRetry={invalidateClusters} />
      </section>
    );
  }

  const kubectl = info.data?.kubectl;
  const inDefaultFile =
    !!cluster && !!info.data && cluster.sourceFile === info.data.defaultKubeconfig;
  const canSwitch = !!kubectl && inDefaultFile;
  const actionError = setContext.error || setNamespace.error;

  const sub = cluster
    ? [
        cluster.server,
        health.data?.reachable ? health.data.version : undefined,
        tildify(cluster.sourceFile),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <section className="view" aria-labelledby="detail-title">
      <Link to="/clusters" className="back">
        <ChevronLeft aria-hidden="true" />
        {t('nav.clusters')}
      </Link>

      <div className="title-row">
        <div>
          <h1 id="detail-title">{cluster?.name ?? <Skeleton width={180} height={24} />}</h1>
          <p className="sub truncate">{cluster ? sub : <Skeleton width={320} />}</p>
        </div>
        <div className="actions">
          {cluster?.isDefault ? (
            <span className="status-note">
              <Star className="star" aria-hidden="true" />
              {t('detail.isDefault')}
            </span>
          ) : canSwitch ? (
            <button
              type="button"
              className="btn"
              onClick={() => setContext.mutate()}
              disabled={setContext.isPending}
            >
              <Star aria-hidden="true" />
              {t('detail.makeDefault')}
            </button>
          ) : kubectl && cluster ? (
            <button
              type="button"
              className="btn"
              onClick={() => merge.fromCluster(cluster.id)}
              disabled={merge.busy}
              title={t('detail.otherFileHint', { file: tildify(cluster.sourceFile) })}
            >
              {t('detail.mergeIntoDefault')}
            </button>
          ) : null}
        </div>
      </div>

      {(actionError || merge.error) && (
        <p className="inline-error" role="alert">
          {actionError ? errorMessage(actionError) : merge.error}
        </p>
      )}
      {merge.outcome && (
        <p className="inline-success" role="status">
          {t('merge.done', {
            count: merge.outcome.added.length,
            names: merge.outcome.added.join(', '),
          })}
        </p>
      )}

      {namespaces.isError ? (
        <>
          <ErrorBlock
            message={t('detail.unreachable', { message: errorMessage(namespaces.error) })}
            onRetry={() => namespaces.refetch()}
          />
          {cluster && (
            <div className="setting">
              <div>
                <h2>{t('detail.troubleTitle')}</h2>
                <p className="desc">{t('detail.troubleDesc')}</p>
              </div>
              <div className="panel">
                <dl>
                  <dt>{t('detail.server')}</dt>
                  <dd className="mono">{cluster.server}</dd>
                  <dt>{t('detail.user')}</dt>
                  <dd>{cluster.user}</dd>
                  <dt>{t('detail.namespace')}</dt>
                  <dd>{cluster.namespace || 'default'}</dd>
                  <dt>{t('detail.kubeconfig')}</dt>
                  <dd className="mono">{tildify(cluster.sourceFile)}</dd>
                </dl>
                <Command
                  value={`kubectl --kubeconfig ${tildify(cluster.sourceFile)} --context ${cluster.name} cluster-info`}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="toolbar">
            <label className="field-inline">
              <span>{t('detail.namespace')}</span>
              {namespaces.data && !namespaces.data.complete ? (
                <input
                  className="input"
                  defaultValue={namespace}
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      setSearch({ ns: e.currentTarget.value.trim() || preferred });
                  }}
                  aria-describedby="ns-hint"
                />
              ) : (
                <select
                  className="select"
                  value={namespace}
                  onChange={(e) => setSearch({ ns: e.target.value })}
                  disabled={!namespaces.data}
                >
                  {(list.length ? list : [namespace]).map((ns) => (
                    <option key={ns} value={ns}>
                      {ns}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {canSwitch && namespace !== (cluster?.namespace || 'default') && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setNamespace.mutate()}
                disabled={setNamespace.isPending}
              >
                {t('detail.makeDefaultNamespace')}
              </button>
            )}
            <span className="spacer" />
            <label className="search">
              <Search aria-hidden="true" />
              <span className="visually-hidden">{t('detail.filter')}</span>
              <input
                type="search"
                className="input"
                placeholder={t('detail.filter')}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                spellCheck={false}
              />
            </label>
          </div>
          {namespaces.data && !namespaces.data.complete && (
            <p id="ns-hint" className="hint">
              {t('detail.namespacesForbidden')}
            </p>
          )}

          <section className="block" aria-labelledby="services-title">
            <div className="block-head">
              <h2 id="services-title">{t('detail.services')}</h2>
              <Count
                shown={shownServices.length}
                total={services.data?.length}
                filtered={!!query}
              />
            </div>
            {services.isError ? (
              <ErrorBlock
                message={errorMessage(services.error)}
                onRetry={() => services.refetch()}
              />
            ) : services.isSuccess && shownServices.length === 0 ? (
              <p className="empty-line">
                {query ? t('detail.noMatch') : t('detail.noServices', { namespace })}
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t('detail.colName')}</th>
                    <th>{t('detail.colType')}</th>
                    <th>{t('detail.colPorts')}</th>
                  </tr>
                </thead>
                <tbody>
                  {!services.data
                    ? [0, 1, 2].map((i) => (
                        <tr key={i}>
                          <td className="identity">
                            <Skeleton width={140} />
                          </td>
                          <td>
                            <Skeleton width={70} />
                          </td>
                          <td>
                            <Skeleton width={120} />
                          </td>
                        </tr>
                      ))
                    : shownServices.map((s) => (
                        <tr key={s.name}>
                          <td className="identity">
                            <span className="truncate name">{s.name}</span>
                            {!s.forwardable && (
                              <span className="sub">{t('detail.notForwardable')}</span>
                            )}
                          </td>
                          <td className="muted">{s.type}</td>
                          <td>
                            {s.ports.length ? (
                              <span className="ports num">
                                {s.ports.map((p) => (
                                  <span key={`${p.port}-${p.protocol}`} title={p.name}>
                                    {servicePort(p)}
                                    {p.name && p.name !== p.targetPort && (
                                      <span className="port-name"> {p.name}</span>
                                    )}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="muted">{t('common.dash')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="block" aria-labelledby="pods-title">
            <div className="block-head">
              <h2 id="pods-title">{t('detail.pods')}</h2>
              <Count shown={shownPods.length} total={pods.data?.length} filtered={!!query} />
            </div>
            {pods.isError ? (
              <ErrorBlock message={errorMessage(pods.error)} onRetry={() => pods.refetch()} />
            ) : pods.isSuccess && shownPods.length === 0 ? (
              <p className="empty-line">
                {query ? t('detail.noMatch') : t('detail.noPods', { namespace })}
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t('detail.colName')}</th>
                    <th>{t('detail.colStatus')}</th>
                    <th className="n">{t('detail.colReady')}</th>
                    <th className="n">{t('detail.colRestarts')}</th>
                    <th className="n">{t('detail.colAge')}</th>
                    <th>{t('detail.colPorts')}</th>
                  </tr>
                </thead>
                <tbody>
                  {!pods.data
                    ? [0, 1, 2].map((i) => (
                        <tr key={i}>
                          <td className="identity">
                            <Skeleton width={180} />
                          </td>
                          <td>
                            <Skeleton width={60} />
                          </td>
                          <td className="n">
                            <Skeleton width={24} />
                          </td>
                          <td className="n">
                            <Skeleton width={16} />
                          </td>
                          <td className="n">
                            <Skeleton width={28} />
                          </td>
                          <td>
                            <Skeleton width={80} />
                          </td>
                        </tr>
                      ))
                    : shownPods.map((p) => (
                        <tr key={p.name}>
                          <td className="identity">
                            <span className="truncate name mono-id" title={p.name}>
                              {p.name}
                            </span>
                            {p.owner && <span className="sub truncate">{p.owner}</span>}
                          </td>
                          <td>
                            {statusClass(p.status) ? (
                              <span className={statusClass(p.status)}>{p.status}</span>
                            ) : (
                              <span className={p.status === 'Completed' ? 'muted' : undefined}>
                                {p.status}
                              </span>
                            )}
                          </td>
                          <td className="n num">
                            {p.ready}/{p.containers}
                          </td>
                          <td className={p.restarts > 0 ? 'n num' : 'n num muted'}>{p.restarts}</td>
                          <td className="n num nowrap">
                            {p.createdAt ? formatAge(p.createdAt) : t('common.dash')}
                          </td>
                          <td>
                            {p.ports.length ? (
                              <span className="ports num">
                                {p.ports.map((x) => (
                                  <span key={`${x.container}-${x.port}`} title={x.container}>
                                    {x.port}
                                    {x.name && <span className="port-name"> {x.name}</span>}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="muted">{t('common.dash')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <MergeDialog preview={merge.preview} onClose={merge.close} />
    </section>
  );
};
