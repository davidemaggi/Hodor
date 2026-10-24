import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, GripVertical, Plus, Search, X } from 'lucide-react';
import type { PodView, PortForwardConfig, ServiceView } from '@hodor/core';
import type { TemplateInput } from '../../../shared/api';
import { api, errorMessage } from '../api';
import { useClusters, useSettings, useTemplates } from '../queries';
import { ErrorBlock, Skeleton } from '../components/states';
import { TagsInput } from '../components/tags-input';
import { ConfirmDialog } from '../components/confirm-dialog';
import { moveItem, useReorder } from '../hooks/use-reorder';
import {
  blocking,
  forwardIssues,
  portConflicts,
  suggestLocalPort,
  type ForwardIssues,
} from '../template-rules';

const EMPTY: TemplateInput = { name: '', description: '', tags: [], forwards: [] };

/** A pod owned by a ReplicaSet belongs to a Deployment: forward to that, it outlives its pods */
function podTarget(pod: PodView): Pick<PortForwardConfig, 'resourceType' | 'resourceName'> {
  const [kind, owner] = pod.owner?.split('/') ?? [];
  if (kind === 'ReplicaSet' && owner) {
    return { resourceType: 'deployment', resourceName: owner.replace(/-[a-z0-9]{5,10}$/, '') };
  }
  return { resourceType: 'pod', resourceName: pod.name };
}

function uniqueName(base: string, taken: string[]): string {
  let name = base.slice(0, 63);
  for (let n = 2; taken.includes(name); n++) name = `${base.slice(0, 60)}-${n}`;
  return name;
}

interface ForwardRowProps {
  forward: PortForwardConfig;
  issues: ForwardIssues;
  /** Only after the row was edited or a save was attempted */
  showIssues: boolean;
  index: number;
  count: number;
  linkables?: { secrets: string[] | null; configMaps: string[] | null };
  onChange: (f: PortForwardConfig) => void;
  onRemove: () => void;
  handleProps: ReturnType<ReturnType<typeof useReorder>['handleProps']> | Record<string, unknown>;
  /** Drop target for drag & drop reordering */
  rowProps: ReturnType<ReturnType<typeof useReorder>['rowProps']>;
}

const ForwardRow: React.FC<ForwardRowProps> = ({
  forward: f,
  issues: allIssues,
  showIssues,
  index,
  linkables,
  onChange,
  onRemove,
  handleProps,
  rowProps,
}) => {
  const { t } = useTranslation();
  const id = `fwd-${index}`;
  const issues: ForwardIssues = showIssues ? allIssues : {};
  const describedBy = Object.keys(issues).length ? `${id}-problems` : undefined;
  const set = <K extends keyof PortForwardConfig>(key: K, value: PortForwardConfig[K]) =>
    onChange({ ...f, [key]: value });
  const problems = Object.entries(issues).map(([field, kind]) =>
    t(`editor.issue.${field}.${kind}`)
  );

  return (
    <div className="forward-row" data-invalid={blocking(issues) ? true : undefined} {...rowProps}>
      <button
        type="button"
        className="drag-handle"
        aria-label={t('editor.reorderForward', { name: f.name || index + 1 })}
        {...handleProps}
      >
        <GripVertical aria-hidden="true" />
      </button>
      <div className="forward-main">
        <div className="forward-line">
          <label className="port-field">
            <span className="visually-hidden">{t('editor.localPort')}</span>
            <span aria-hidden="true">:</span>
            <input
              id={`${id}-local`}
              className="port-input num"
              inputMode="numeric"
              value={Number.isNaN(f.localPort) ? '' : f.localPort}
              onChange={(e) => set('localPort', Number(e.target.value.replace(/\D/g, '')))}
              aria-invalid={!!issues.localPort && issues.localPort !== 'privileged'}
              aria-describedby={describedBy}
            />
          </label>
          <label className="grow">
            <span className="visually-hidden">{t('editor.forwardName')}</span>
            <input
              className="input name-input"
              value={f.name}
              placeholder={t('editor.forwardName')}
              onChange={(e) => set('name', e.target.value)}
              aria-invalid={!!issues.name}
              aria-describedby={describedBy}
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className="btn ghost icon-only"
            onClick={onRemove}
            aria-label={t('editor.removeForward', { name: f.name })}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="forward-line target-line">
          <span className="muted">{t('editor.to')}</span>
          <select
            className="select compact"
            value={f.resourceType}
            onChange={(e) =>
              set('resourceType', e.target.value as PortForwardConfig['resourceType'])
            }
            aria-label={t('editor.kind')}
          >
            <option value="service">service</option>
            <option value="deployment">deployment</option>
            <option value="pod">pod</option>
          </select>
          <input
            className="input mono-input"
            value={f.resourceName}
            onChange={(e) => set('resourceName', e.target.value.trim())}
            aria-label={t('editor.resourceName')}
            aria-invalid={!!issues.resourceName}
            spellCheck={false}
          />
          <span className="muted">{t('editor.in')}</span>
          <input
            className="input mono-input short"
            value={f.namespace}
            onChange={(e) => set('namespace', e.target.value.trim())}
            aria-label={t('editor.namespace')}
            aria-invalid={!!issues.namespace}
            spellCheck={false}
          />
          <span className="muted">{t('editor.port')}</span>
          <input
            className="input mono-input port"
            inputMode="numeric"
            value={Number.isNaN(f.remotePort) ? '' : f.remotePort}
            onChange={(e) => set('remotePort', Number(e.target.value.replace(/\D/g, '')))}
            aria-label={t('editor.remotePort')}
            aria-invalid={!!issues.remotePort}
          />
        </div>
        <div className="forward-line links-line">
          <label className="link-field">
            <span>{t('editor.secrets')}</span>
            <TagsInput
              id={`${id}-secrets`}
              value={f.secrets ?? []}
              onChange={(v) => set('secrets', v)}
              suggestions={linkables?.secrets ?? []}
              placeholder={t('editor.secretsPlaceholder')}
            />
          </label>
          <label className="link-field">
            <span>{t('editor.configMaps')}</span>
            <TagsInput
              id={`${id}-configmaps`}
              value={f.configMaps ?? []}
              onChange={(v) => set('configMaps', v)}
              suggestions={linkables?.configMaps ?? []}
              placeholder={t('editor.configMapsPlaceholder')}
            />
          </label>
        </div>
        {problems.length > 0 && (
          <p
            className={blocking(issues) ? 'field-error' : 'hint'}
            role={blocking(issues) ? 'alert' : undefined}
          >
            {problems.join(' ')}
          </p>
        )}
      </div>
    </div>
  );
};

/** Right rail: pick services and pods from a cluster; each port becomes a forward */
const ClusterPicker: React.FC<{
  forwards: PortForwardConfig[];
  onAdd: (target: Omit<PortForwardConfig, 'name' | 'localPort'>, baseName: string) => void;
  clusterId: string;
  onCluster: (id: string) => void;
}> = ({ forwards, onAdd, clusterId, onCluster }) => {
  const { t } = useTranslation();
  const clusters = useClusters();
  const [ns, setNs] = useState('');
  const [filter, setFilter] = useState('');
  const cluster = clusters.data?.find((c) => c.id === clusterId);

  const namespaces = useQuery({
    queryKey: ['namespaces', clusterId],
    queryFn: () => api.clusters.namespaces(clusterId),
    enabled: !!cluster,
    retry: false,
  });
  const namespace =
    ns ||
    (namespaces.data?.namespaces.includes(cluster?.namespace || 'default')
      ? cluster?.namespace || 'default'
      : namespaces.data?.namespaces[0]) ||
    'default';
  const services = useQuery({
    queryKey: ['services', clusterId, namespace],
    queryFn: () => api.clusters.services(clusterId, namespace),
    enabled: namespaces.isSuccess,
  });
  const pods = useQuery({
    queryKey: ['pods', clusterId, namespace],
    queryFn: () => api.clusters.pods(clusterId, namespace),
    enabled: namespaces.isSuccess,
  });

  const has = (type: string, name: string, port: number) =>
    forwards.some(
      (f) =>
        f.resourceType === type &&
        f.resourceName === name &&
        f.remotePort === port &&
        f.namespace === namespace
    );
  const q = filter.trim().toLowerCase();
  const shownServices = (services.data ?? []).filter(
    (s: ServiceView) => s.forwardable && s.ports.length && (!q || s.name.includes(q))
  );
  const shownPods = (pods.data ?? []).filter(
    (p: PodView) => p.ports.length && (!q || p.name.includes(q))
  );

  return (
    <aside className="picker" aria-labelledby="picker-title">
      <h2 id="picker-title">{t('editor.pickerTitle')}</h2>
      <p className="hint">{t('editor.pickerHint')}</p>
      <label className="field">
        <span>{t('editor.cluster')}</span>
        <select
          className="select"
          value={clusterId}
          onChange={(e) => {
            onCluster(e.target.value);
            setNs('');
          }}
        >
          {(clusters.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {namespaces.isError ? (
        <p className="inline-error">
          {t('editor.pickerUnreachable', { message: errorMessage(namespaces.error) })}
        </p>
      ) : (
        <>
          <label className="field">
            <span>{t('detail.namespace')}</span>
            <select
              className="select"
              value={namespace}
              onChange={(e) => setNs(e.target.value)}
              disabled={!namespaces.data}
            >
              {(namespaces.data?.namespaces.length ? namespaces.data.namespaces : [namespace]).map(
                (n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="search full">
            <Search aria-hidden="true" />
            <span className="visually-hidden">{t('editor.pickerFilter')}</span>
            <input
              type="search"
              className="input"
              placeholder={t('editor.pickerFilter')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              spellCheck={false}
            />
          </label>

          <h3>{t('detail.services')}</h3>
          {!services.data ? (
            <Skeleton width={200} />
          ) : shownServices.length === 0 ? (
            <p className="hint">{t('editor.nothingHere')}</p>
          ) : (
            <ul className="pick-list">
              {shownServices.map((s) => (
                <li key={s.name}>
                  <span className="mono-id truncate">{s.name}</span>
                  <span className="pick-ports">
                    {s.ports.map((p) => {
                      const added = has('service', s.name, p.port);
                      return (
                        <button
                          key={p.port}
                          type="button"
                          className="port-chip"
                          disabled={added}
                          onClick={() =>
                            onAdd(
                              {
                                namespace,
                                resourceType: 'service',
                                resourceName: s.name,
                                remotePort: p.port,
                              },
                              s.ports.length > 1 && p.name ? `${s.name}-${p.name}` : s.name
                            )
                          }
                          aria-label={
                            added
                              ? t('editor.added', { target: `${s.name}:${p.port}` })
                              : t('editor.add', { target: `${s.name}:${p.port}` })
                          }
                        >
                          {added ? null : <Plus aria-hidden="true" />}
                          {p.port}
                          {p.name && <span className="port-name"> {p.name}</span>}
                        </button>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3>{t('detail.pods')}</h3>
          {!pods.data ? (
            <Skeleton width={200} />
          ) : shownPods.length === 0 ? (
            <p className="hint">{t('editor.nothingHere')}</p>
          ) : (
            <ul className="pick-list">
              {shownPods.map((p) => {
                const target = podTarget(p);
                return (
                  <li key={p.name}>
                    <span className="truncate">
                      <span className="mono-id">{target.resourceName}</span>
                      {target.resourceType === 'deployment' && (
                        <span className="sub">{t('editor.viaDeployment')}</span>
                      )}
                    </span>
                    <span className="pick-ports">
                      {p.ports.map((x) => {
                        const added = has(target.resourceType, target.resourceName, x.port);
                        return (
                          <button
                            key={`${x.container}-${x.port}`}
                            type="button"
                            className="port-chip"
                            disabled={added}
                            onClick={() =>
                              onAdd(
                                { namespace, ...target, remotePort: x.port },
                                x.name && p.ports.length > 1
                                  ? `${target.resourceName}-${x.name}`
                                  : target.resourceName
                              )
                            }
                            aria-label={
                              added
                                ? t('editor.added', { target: `${target.resourceName}:${x.port}` })
                                : t('editor.add', { target: `${target.resourceName}:${x.port}` })
                            }
                          >
                            {added ? null : <Plus aria-hidden="true" />}
                            {x.port}
                            {x.name && <span className="port-name"> {x.name}</span>}
                          </button>
                        );
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </aside>
  );
};

export const TemplateEditorView: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const templates = useTemplates();
  const settings = useSettings();
  const clusters = useClusters();

  const existing = useQuery({
    queryKey: ['template', id],
    queryFn: () => api.templates.get(id!),
    enabled: !isNew,
    retry: false,
  });
  const [draft, setDraft] = useState<TemplateInput>(EMPTY);
  const [baseline, setBaseline] = useState<string>(JSON.stringify(EMPTY));
  const [clusterId, setClusterId] = useState('');
  // Stable identities for forwards, so reordering never moves focus or field state onto another row
  const [keys, setKeys] = useState<number[]>([]);
  const nextKey = useRef(0);
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const allowLeave = useRef(false);
  const [restartFor, setRestartFor] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (existing.data) {
      const loaded: TemplateInput = {
        name: existing.data.name,
        description: existing.data.description ?? '',
        tags: existing.data.tags,
        forwards: existing.data.forwards,
      };
      setDraft(loaded);
      setKeys(loaded.forwards.map(() => nextKey.current++));
      setBaseline(JSON.stringify(loaded));
    }
  }, [existing.data]);

  useEffect(() => {
    if (clusterId || !clusters.data?.length) return;
    const preferred =
      clusters.data.find((c) => c.id === settings.data?.lastUsedCluster) ??
      clusters.data.find((c) => c.isDefault) ??
      clusters.data[0];
    setClusterId(preferred.id);
  }, [clusters.data, settings.data, clusterId]);

  const linkableNamespaces = [...new Set(draft.forwards.map((f) => f.namespace))];
  const linkables = useQuery({
    queryKey: ['linkables', clusterId, linkableNamespaces],
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          linkableNamespaces.map(
            async (ns) => [ns, await api.clusters.linkables(clusterId, ns)] as const
          )
        )
      ),
    enabled: !!clusterId && linkableNamespaces.length > 0,
    retry: false,
  });

  const others = (templates.data ?? []).filter((x) => x.id !== id);
  const issues = forwardIssues(draft.forwards);
  const conflicts = portConflicts(draft.forwards, others);
  const nameTaken = others.some((x) => x.name === draft.name.trim());
  const nameProblem = !draft.name.trim() ? 'missing' : nameTaken ? 'taken' : null;
  const invalid = !!nameProblem || draft.forwards.length === 0 || issues.some(blocking);
  const dirty = JSON.stringify(draft) !== baseline;
  const allTags = useMemo(
    () => [...new Set((templates.data ?? []).flatMap((x) => x.tags))].sort(),
    [templates.data]
  );

  const setForwards = (forwards: PortForwardConfig[]) => setDraft((d) => ({ ...d, forwards }));
  const { rowProps, handleProps } = useReorder((from, to) => {
    setForwards(moveItem(draft.forwards, from, to));
    setKeys((k) => moveItem(k, from, to));
  });

  // Any navigation away with unsaved edits asks first: sidebar, shortcuts, palette, Back
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allowLeave.current && currentLocation.pathname !== nextLocation.pathname
  );
  const leaveSaved = (to: string) => {
    allowLeave.current = true;
    navigate(to);
  };

  const addForward = (target: Omit<PortForwardConfig, 'name' | 'localPort'>, baseName: string) => {
    const taken = [
      ...draft.forwards.map((f) => f.localPort),
      ...others.flatMap((x) => x.forwards.map((f) => f.localPort)),
    ];
    setForwards([
      ...draft.forwards,
      {
        ...target,
        name: uniqueName(
          baseName,
          draft.forwards.map((f) => f.name)
        ),
        localPort: suggestLocalPort(target.remotePort, taken),
      },
    ]);
    setKeys((k) => [...k, nextKey.current++]);
  };

  const save = useMutation({
    mutationFn: async () => {
      const input: TemplateInput = {
        name: draft.name.trim(),
        ...(draft.description?.trim() ? { description: draft.description.trim() } : {}),
        tags: draft.tags,
        forwards: draft.forwards.map((f) => ({
          ...f,
          name: f.name.trim(),
          ...(f.secrets?.length ? { secrets: f.secrets } : { secrets: undefined }),
          ...(f.configMaps?.length ? { configMaps: f.configMaps } : { configMaps: undefined }),
        })),
      };
      if (isNew) return { template: await api.templates.create(input), running: false };
      return api.templates.update(id!, input);
    },
    onSuccess: ({ template, running }) => {
      setBaseline(JSON.stringify(draft));
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.setQueryData(['template', template.id], template);
      allowLeave.current = true;
      if (running) setRestartFor(template.id);
      else navigate('/templates');
    },
  });

  const restart = useMutation({
    mutationFn: (templateId: string) => api.running.restart(templateId),
    onSettled: () => leaveSaved('/templates'),
  });

  if (!isNew && existing.isError) {
    return (
      <section className="view">
        <Link to="/templates" className="back">
          <ChevronLeft aria-hidden="true" />
          {t('nav.templates')}
        </Link>
        <ErrorBlock message={errorMessage(existing.error)} onRetry={() => existing.refetch()} />
      </section>
    );
  }

  const leave = () => navigate('/templates');

  return (
    <section className="view editor" aria-labelledby="editor-title">
      <button type="button" className="back link-like" onClick={leave}>
        <ChevronLeft aria-hidden="true" />
        {t('nav.templates')}
      </button>

      <form
        className="editor-grid"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (!invalid) save.mutate();
        }}
      >
        <div className="editor-main">
          <div className="title-row">
            <div>
              <h1 id="editor-title">
                {isNew
                  ? t('editor.newTitle')
                  : (existing.data?.name ?? <Skeleton width={160} height={24} />)}
              </h1>
              <p className="sub">{t('editor.sub')}</p>
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={leave}>
                {t('merge.cancel')}
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={save.isPending || (submitted && invalid)}
              >
                {save.isPending ? t('editor.saving') : t('editor.save')}
              </button>
            </div>
          </div>

          {save.isError && (
            <p className="inline-error" role="alert">
              {errorMessage(save.error)}
            </p>
          )}

          <div className="fields">
            <label className="field">
              <span>{t('editor.name')}</span>
              <input
                className="input"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                aria-invalid={submitted && !!nameProblem}
                aria-describedby={
                  (submitted || nameTaken) && nameProblem ? 'name-error' : undefined
                }
                maxLength={100}
                spellCheck={false}
                autoFocus={isNew}
              />
              {(submitted || nameTaken) && nameProblem && (
                <span id="name-error" className="field-error">
                  {t(`editor.nameProblem.${nameProblem}`)}
                </span>
              )}
            </label>
            <label className="field">
              <span>
                {t('editor.description')} <span className="muted">{t('editor.optional')}</span>
              </span>
              <input
                className="input"
                value={draft.description ?? ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                maxLength={500}
              />
            </label>
            <label className="field">
              <span>
                {t('editor.tags')} <span className="muted">{t('editor.optional')}</span>
              </span>
              <TagsInput
                id="template-tags"
                value={draft.tags}
                onChange={(tags) => setDraft({ ...draft, tags })}
                suggestions={allTags}
              />
            </label>
          </div>

          <div className="block-head">
            <h2>{t('editor.forwards')}</h2>
            <span className="stamp num">
              {t('editor.forwardCount', { count: draft.forwards.length })}
            </span>
          </div>
          {draft.forwards.length === 0 ? (
            <p className={submitted ? 'empty-line field-error' : 'empty-line'}>
              {t('editor.noForwards')}
            </p>
          ) : (
            <div className="forward-list">
              {draft.forwards.map((f, index) => (
                <ForwardRow
                  key={keys[index] ?? index}
                  forward={f}
                  index={index}
                  count={draft.forwards.length}
                  issues={issues[index]}
                  showIssues={submitted || touched.has(keys[index])}
                  linkables={linkables.data?.[f.namespace]}
                  onChange={(next) => {
                    setForwards(draft.forwards.map((x, i) => (i === index ? next : x)));
                    setTouched((t) => new Set(t).add(keys[index]));
                  }}
                  onRemove={() => {
                    setForwards(draft.forwards.filter((_, i) => i !== index));
                    setKeys((k) => k.filter((_, i) => i !== index));
                  }}
                  handleProps={handleProps(index, draft.forwards.length)}
                  rowProps={rowProps(index)}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn ghost add-manual"
            onClick={() =>
              addForward(
                { namespace: 'default', resourceType: 'service', resourceName: '', remotePort: 80 },
                'forward'
              )
            }
          >
            <Plus aria-hidden="true" />
            {t('editor.addManually')}
          </button>

          {conflicts.length > 0 && (
            <p className="hint conflict">
              {t('editor.conflicts', {
                list: conflicts.map((c) => `:${c.port} (${c.template})`).join(', '),
              })}
            </p>
          )}
        </div>

        {clusterId ? (
          <ClusterPicker
            forwards={draft.forwards}
            onAdd={addForward}
            clusterId={clusterId}
            onCluster={setClusterId}
          />
        ) : (
          <aside className="picker">
            <h2>{t('editor.pickerTitle')}</h2>
            <p className="hint">
              {clusters.isSuccess ? t('editor.noClusters') : <Skeleton width={180} />}
            </p>
          </aside>
        )}
      </form>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        tone="danger"
        title={t('editor.discardTitle')}
        body={<p>{t('editor.discardBody')}</p>}
        confirmLabel={t('editor.discard')}
        cancelLabel={t('editor.keepEditing')}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
      <ConfirmDialog
        open={!!restartFor}
        title={t('editor.restartTitle', { name: draft.name })}
        body={<p>{t('editor.restartBody')}</p>}
        confirmLabel={t('editor.restart')}
        cancelLabel={t('editor.later')}
        busy={restart.isPending}
        onConfirm={() => restartFor && restart.mutate(restartFor)}
        onCancel={() => leaveSaved('/templates')}
      />
    </section>
  );
};
