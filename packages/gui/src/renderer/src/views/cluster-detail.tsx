import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { ChevronLeft, Search, Star } from 'lucide-react';
import type { PodView, ServicePortView, ServiceView } from '@hodor/core';
import { api, errorMessage } from '../api';
import { useAppInfo, useClusterHealth, useClusters, useProduction } from '../queries';
import { ErrorBlock, Skeleton } from '../components/states';
import { Command } from '../components/command';
import { ConfirmDialog } from '../components/confirm-dialog';
import { MergeDialog } from '../components/merge-dialog';
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

const matches = (query: string, ...values: Array<string | number | undefined>) =>
  !query || values.some((v) => v !== undefined && String(v).toLowerCase().includes(query));

/** "6 pods", or "2 of 6 pods" while filtering */
const Count: React.FC<{
  shown: number;
  total?: number;
  filtered: boolean;
  noun: 'services' | 'pods';
}> = ({ shown, total, filtered, noun }) => {
  const { t } = useTranslation();
  if (total === undefined) return null;
  return (
    <span className="stamp num">
      {filtered
        ? t(`detail.countFiltered_${noun}`, { shown, count: total })
        : t(`detail.count_${noun}`, { count: total })}
    </span>
  );
};

/** What just changed in kubectl's config, and how to put it back */
type Change =
  | { kind: 'context'; to: string; from?: { id: string; name: string } }
  | { kind: 'namespace'; context: string; to: string; from: string };

export const ClusterDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const [filter, setFilter] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [change, setChange] = useState<Change | null>(null);
  const queryClient = useQueryClient();
  const clusters = useClusters();
  const info = useAppInfo();
  const production = useProduction();
  const merge = useMergeFlow();

  const cluster = clusters.data?.find((c) => c.id === id);
  const kubectlDefault = clusters.data?.find((c) => c.isDefault);
  const health = useClusterHealth(id);
  const isProd = production.isProduction(id);

  // Remember this cluster: it is opened again after a restart
  useEffect(() => {
    if (!cluster) return;
    setChange(null);
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
    mutationFn: (targetId: string) => api.kubectl.setContext(targetId),
    onSuccess: invalidateClusters,
  });
  const setNamespace = useMutation({
    mutationFn: (ns: string) => api.kubectl.setNamespace(id, ns),
    onSuccess: invalidateClusters,
  });

  const pointKubectlHere = () => {
    if (!cluster) return;
    const from = kubectlDefault ? { id: kubectlDefault.id, name: kubectlDefault.name } : undefined;
    setContext.mutate(cluster.id, {
      onSuccess: () => {
        setConfirming(false);
        setChange({ kind: 'context', to: cluster.name, from });
      },
    });
  };

  const undo = () => {
    if (!change) return;
    if (change.kind === 'context' && change.from) {
      setContext.mutate(change.from.id, { onSuccess: () => setChange(null) });
    } else if (change.kind === 'namespace') {
      setNamespace.mutate(change.from, { onSuccess: () => setChange(null) });
    }
  };

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
  const currentNamespace = cluster?.namespace || 'default';

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
        <div className="title-block">
          <h1 id="detail-title" className="name-line">
            {cluster?.name ?? <Skeleton width={180} height={24} />}
            {isProd && <span className="tag prod">{t('clusters.prodTag')}</span>}
          </h1>
          <p className="sub truncate">{cluster ? sub : <Skeleton width={320} />}</p>
        </div>
        <div className="actions">
          {cluster && (
            <label className="switch-row">
              <input
                type="checkbox"
                className="switch"
                checked={isProd}
                onChange={() => production.toggle(cluster.id)}
                disabled={production.busy}
              />
              {t('detail.production')}
            </label>
          )}
          {cluster?.isDefault ? (
            <span className="status-note">
              <Star className="star" aria-hidden="true" />
              {t('detail.isDefault')}
            </span>
          ) : canSwitch ? (
            <button
              type="button"
              className="btn"
              onClick={() => (isProd ? setConfirming(true) : pointKubectlHere())}
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
            >
              {t('detail.mergeIntoDefault')}
            </button>
          ) : null}
        </div>
      </div>

      {cluster && !cluster.isDefault && (
        <p className="hint title-hint">
          {!kubectl
            ? t('detail.noKubectl')
            : !inDefaultFile
              ? t('detail.otherFileHint', { file: tildify(cluster.sourceFile) })
              : isProd
                ? t('detail.prodHint')
                : null}
        </p>
      )}

      {change && (
        <p className="inline-success" role="status">
          {change.kind === 'context'
            ? change.from
              ? t('detail.switchedFrom', { to: change.to, from: change.from.name })
              : t('detail.switched', { to: change.to })
            : t('detail.namespaceSwitched', {
                context: change.context,
                to: change.to,
                from: change.from,
              })}{' '}
          {t('detail.backedUp')}{' '}
          {(change.kind === 'namespace' || change.from) && (
            <button
              type="button"
              className="link-btn"
              onClick={undo}
              disabled={setContext.isPending || setNamespace.isPending}
            >
              {t('detail.undo')}
            </button>
          )}
        </p>
      )}
      {(actionError || merge.error) && (
        <p className="inline-error" role="alert">
          {actionError
            ? errorMessage(actionError)
            : merge.source === 'cluster'
              ? t('merge.failedCluster', { message: merge.error })
              : t('merge.failedFiles', { message: merge.error })}
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
                  <dd>{currentNamespace}</dd>
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
            {namespaces.data && !namespaces.data.complete ? (
              <form
                className="field-inline"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = String(new FormData(e.currentTarget).get('ns') || '').trim();
                  setSearch({ ns: value || preferred });
                }}
              >
                <label htmlFor="ns-input">{t('detail.namespace')}</label>
                <input
                  id="ns-input"
                  name="ns"
                  key={namespace}
                  className="input"
                  defaultValue={namespace}
                  spellCheck={false}
                  aria-describedby="ns-hint"
                />
                <button type="submit" className="btn">
                  {t('detail.show')}
                </button>
              </form>
            ) : (
              <label className="field-inline">
                <span>{t('detail.namespace')}</span>
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
              </label>
            )}
            {canSwitch && namespace !== currentNamespace && (
              <button
                type="button"
                className="btn ghost"
                disabled={setNamespace.isPending}
                onClick={() =>
                  setNamespace.mutate(namespace, {
                    onSuccess: () =>
                      setChange({
                        kind: 'namespace',
                        context: cluster!.name,
                        to: namespace,
                        from: currentNamespace,
                      }),
                  })
                }
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
                noun="services"
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
                            <span className="truncate mono-id">{s.name}</span>
                            {!s.forwardable && (
                              <span className="sub">{t('detail.notForwardable')}</span>
                            )}
                          </td>
                          <td className="muted">{s.type}</td>
                          <td>
                            {s.ports.length ? (
                              <span className="ports num">
                                {s.ports.map((p) => (
                                  <span key={`${p.port}-${p.protocol}`}>
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
              <Count
                noun="pods"
                shown={shownPods.length}
                total={pods.data?.length}
                filtered={!!query}
              />
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
                            <span className="truncate mono-id" title={p.name}>
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
                                  <span key={`${x.container}-${x.port}`}>
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
      {cluster && (
        <ConfirmDialog
          open={confirming}
          title={t('detail.confirmTitle', { name: cluster.name })}
          body={
            <p>
              <Trans
                i18nKey="detail.confirmBody"
                values={{ name: cluster.name, from: kubectlDefault?.name ?? t('scope.none') }}
                components={{ strong: <strong /> }}
              />
            </p>
          }
          confirmLabel={t('detail.confirmYes')}
          cancelLabel={t('merge.cancel')}
          busy={setContext.isPending}
          onConfirm={pointKubectlHere}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  );
};
