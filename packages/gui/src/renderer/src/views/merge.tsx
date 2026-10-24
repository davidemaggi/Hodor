import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, FilePlus2, X } from 'lucide-react';
import type { KubeconfigFile, MergeOutcome, MergePlan, MergeSource } from '../../../shared/api';
import { api, errorMessage } from '../api';
import { tildify } from '../format';

export const mergePath = '/clusters/merge';

/** What other screens can hand over when they open this one */
export interface MergeState {
  /** Files already read (dropped on the Clusters page) */
  sources?: MergeSource[];
  /** Some of your kubeconfigs to take contexts from */
  known?: string[];
}

const pickKey = (source: string, context: string) => `${source}\u0000${context}`;

type Planned = MergePlan['contexts'][number];

const ResultPill: React.FC<{ planned?: Planned; picked: boolean }> = ({ planned, picked }) => {
  const { t } = useTranslation();
  if (!picked) return <span className="muted">{t('common.dash')}</span>;
  if (!planned) return <span className="pill">{t('merge.planning')}</span>;
  if (planned.status === 'added')
    return <span className="pill pos">{t('merge.status.added')}</span>;
  if (planned.status === 'renamed')
    return <span className="pill warn">{t('merge.status.renamed', { name: planned.as })}</span>;
  return <span className="pill">{t('merge.status.present')}</span>;
};

interface SourceTableProps {
  source: MergeSource;
  picked: Set<string>;
  plan?: MergePlan;
  isTarget: boolean;
  onToggle: (context: string) => void;
  onToggleAll: (all: boolean) => void;
  onRemove: () => void;
}

const SourceTable: React.FC<SourceTableProps> = ({
  source,
  picked,
  plan,
  isTarget,
  onToggle,
  onToggleAll,
  onRemove,
}) => {
  const { t } = useTranslation();
  const file = tildify(source.file);
  const all =
    source.contexts.length > 0 &&
    source.contexts.every((c) => picked.has(pickKey(source.id, c.name)));

  return (
    <section className="merge-source" aria-label={file}>
      <div className="merge-source-head">
        <h2 className="mono truncate">{file}</h2>
        <button
          type="button"
          className="btn ghost icon-only"
          aria-label={t('merge.remove', { file })}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      {isTarget && <p className="hint">{t('merge.sameAsTarget')}</p>}
      {source.contexts.length === 0 ? (
        <p className="muted">{t('merge.noContexts')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="check-col">
                <input
                  type="checkbox"
                  aria-label={t('merge.selectAllIn', { file })}
                  checked={all}
                  onChange={() => onToggleAll(!all)}
                />
              </th>
              <th>{t('merge.colContext')}</th>
              <th>{t('merge.colNamespace')}</th>
              <th className="n">{t('merge.colResult')}</th>
            </tr>
          </thead>
          <tbody>
            {source.contexts.map((c) => {
              const isPicked = picked.has(pickKey(source.id, c.name));
              const planned = plan?.contexts.find(
                (p) => p.source === source.file && p.context === c.name
              );
              return (
                <tr key={c.name}>
                  <td className="check-col">
                    <input
                      type="checkbox"
                      aria-label={t('merge.select', { name: c.name })}
                      checked={isPicked}
                      onChange={() => onToggle(c.name)}
                    />
                  </td>
                  <td className="identity">
                    <span className="name-line truncate">{c.name}</span>
                    <span className="sub truncate">{c.server}</span>
                  </td>
                  <td>{c.namespace ?? 'default'}</td>
                  <td className="n">
                    <ResultPill planned={planned} picked={isPicked} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
};

const YourKubeconfigs: React.FC<{
  files: KubeconfigFile[];
  onTake: (path: string) => void;
}> = ({ files, onTake }) => {
  const { t } = useTranslation();
  if (files.length === 0) return null;
  return (
    <div className="merge-yours">
      <h2>{t('merge.yours')}</h2>
      <ul className="start-list">
        {files.map((f) => (
          <li key={f.path}>
            <div>
              <span className="name mono">{tildify(f.path)}</span>
              <span className="sub">{t('merge.contextsCount', { count: f.contexts.length })}</span>
            </div>
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => onTake(f.path)}>
                {t('merge.takeFrom')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const MergeView: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const queryClient = useQueryClient();
  const handed = (location.state ?? {}) as MergeState;

  const files = useQuery({ queryKey: ['kubeconfig-files'], queryFn: () => api.kubeconfig.files() });
  const [sources, setSources] = useState<MergeSource[]>(handed.sources ?? []);
  const sourcesRef = useRef(sources);
  const [picked, setPicked] = useState<Set<string>>(
    () =>
      new Set((handed.sources ?? []).flatMap((s) => s.contexts.map((c) => pickKey(s.id, c.name))))
  );
  const [chosenTarget, setChosenTarget] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [done, setDone] = useState<MergeOutcome | null>(null);

  const target =
    chosenTarget ?? files.data?.find((f) => f.isDefault)?.path ?? files.data?.[0]?.path ?? null;

  const add = (incoming: MergeSource[]) => {
    // The same file twice adds nothing: it's already on the list
    const fresh = incoming.filter(
      (s, i) =>
        !sourcesRef.current.some((x) => x.file === s.file) &&
        incoming.findIndex((x) => x.file === s.file) === i
    );
    sourcesRef.current = [...sourcesRef.current, ...fresh];
    setSources(sourcesRef.current);
    setPicked((p) => {
      const all = new Set(p);
      for (const s of fresh) for (const c of s.contexts) all.add(pickKey(s.id, c.name));
      return all;
    });
    setDone(null);
  };
  const read = async (load: () => Promise<MergeSource[] | null>) => {
    setReadError(null);
    try {
      const next = await load();
      if (next) add(next);
    } catch (e) {
      setReadError(errorMessage(e));
    }
  };
  const remove = (id: string) => {
    sourcesRef.current = sourcesRef.current.filter((x) => x.id !== id);
    setSources(sourcesRef.current);
    setPicked((p) => new Set([...p].filter((k) => !k.startsWith(`${id}\u0000`))));
  };

  // Kubeconfigs handed over by another screen (a cluster's "Merge into kubectl's file"), once
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (handed.known?.length) void read(() => api.kubeconfig.openKnown(handed.known!));
    // Design-review hook for the browser preview only (?merge=1): starts with a downloaded file
    else if (
      import.meta.env.MODE === 'fixtures' &&
      new URLSearchParams(window.location.search).has('merge')
    )
      void read(() => api.kubeconfig.chooseSources());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const picks = sources.flatMap((s) =>
    s.contexts
      .filter((c) => picked.has(pickKey(s.id, c.name)))
      .map((c) => ({ source: s.id, context: c.name }))
  );
  const plan = useQuery({
    queryKey: ['merge-plan', target, picks],
    queryFn: () => api.kubeconfig.planMerge({ target: target!, picks }),
    enabled: !!target && picks.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const apply = useMutation({
    mutationFn: () => api.kubeconfig.applyMerge({ target: target!, picks }),
    onSuccess: (outcome) => {
      setDone(outcome);
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.invalidateQueries({ queryKey: ['kubeconfig-files'] });
      queryClient.invalidateQueries({ queryKey: ['merge-plan'] });
    },
  });

  const current = picks.length > 0 ? plan.data : undefined;
  const count = (status: Planned['status']) =>
    current?.contexts.filter((c) => c.status === status).length ?? 0;
  const toWrite = count('added') + count('renamed');
  const sourceFiles = new Set(sources.map((s) => s.file));
  const takeable = (files.data ?? []).filter(
    (f) => f.exists && f.contexts.length > 0 && !sourceFiles.has(f.path) && f.path !== target
  );

  return (
    <section
      className={dragging ? 'view dropping' : 'view'}
      aria-labelledby="merge-title"
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
        const dropped = Array.from(e.dataTransfer.files);
        if (dropped.length) void read(() => api.kubeconfig.openDropped(dropped));
      }}
    >
      {dragging && (
        <div className="drop-hint" aria-hidden="true">
          <FilePlus2 />
          {t('merge.dropTitle')}
        </div>
      )}

      <Link to="/clusters" className="back">
        <ChevronLeft aria-hidden="true" />
        {t('nav.clusters')}
      </Link>

      <div className="title-row">
        <div>
          <h1 id="merge-title">{t('merge.title')}</h1>
          <p className="sub">{t('merge.sub')}</p>
        </div>
        {sources.length > 0 && (
          <div className="actions">
            <button
              type="button"
              className="btn"
              onClick={() => read(() => api.kubeconfig.chooseSources())}
            >
              <FilePlus2 aria-hidden="true" />
              {t('merge.addFiles')}
            </button>
          </div>
        )}
      </div>

      {readError && (
        <p className="inline-error" role="alert">
          {t('merge.failedFiles', { message: readError })}
        </p>
      )}
      {apply.isError && (
        <p className="inline-error" role="alert">
          {t('merge.failedMerge', { message: errorMessage(apply.error) })}
        </p>
      )}
      {done && (
        <p className="inline-success" role="status">
          {done.added.length
            ? t('merge.done', {
                count: done.added.length,
                target: tildify(done.target),
                names: done.added.join(', '),
              })
            : t('merge.nothingToDo')}
          {done.backup && ` ${t('merge.doneBackup', { path: tildify(done.backup) })}`}
        </p>
      )}

      <div className="editor-grid">
        <div className="merge-main">
          {sources.length === 0 ? (
            <div className="start drop-zone">
              <h2>{t('merge.dropTitle')}</h2>
              <p>{t('merge.dropBody')}</p>
              <div className="start-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => read(() => api.kubeconfig.chooseSources())}
                >
                  <FilePlus2 aria-hidden="true" />
                  {t('merge.addFiles')}
                </button>
              </div>
            </div>
          ) : (
            sources.map((source) => (
              <SourceTable
                key={source.id}
                source={source}
                picked={picked}
                plan={current}
                isTarget={source.file === target}
                onToggle={(context) =>
                  setPicked((p) => {
                    const next = new Set(p);
                    const k = pickKey(source.id, context);
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                  })
                }
                onToggleAll={(all) =>
                  setPicked((p) => {
                    const next = new Set(p);
                    for (const c of source.contexts) {
                      if (all) next.add(pickKey(source.id, c.name));
                      else next.delete(pickKey(source.id, c.name));
                    }
                    return next;
                  })
                }
                onRemove={() => remove(source.id)}
              />
            ))
          )}
          {sources.length > 0 && <p className="legend">{t('merge.dropMore')}</p>}
          <YourKubeconfigs
            files={takeable}
            onTake={(file) => read(() => api.kubeconfig.openKnown([file]))}
          />
        </div>

        <aside className="picker merge-into" aria-labelledby="into-title">
          <h2 id="into-title">{t('merge.into')}</h2>
          <div className="target-list" role="radiogroup" aria-labelledby="into-title">
            {(files.data ?? []).map((f) => (
              <label key={f.path} className="target-option">
                <input
                  type="radio"
                  name="merge-target"
                  value={f.path}
                  checked={f.path === target}
                  onChange={() => {
                    setChosenTarget(f.path);
                    setDone(null);
                  }}
                />
                <span>
                  <span className="mono truncate">{tildify(f.path)}</span>
                  <span className="sub">
                    {[
                      f.isDefault && t('merge.kubectlFile'),
                      f.exists
                        ? t('merge.contextsCount', { count: f.contexts.length })
                        : t('merge.newFile'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {picks.length === 0 ? (
            <p className="hint">{t('merge.pickSome')}</p>
          ) : plan.isError ? (
            <p className="inline-error" role="alert">
              {t('merge.failedPlan', { message: errorMessage(plan.error) })}
            </p>
          ) : current ? (
            <ul className="merge-summary">
              {count('added') > 0 && <li>{t('merge.summaryNew', { count: count('added') })}</li>}
              {count('renamed') > 0 && (
                <li>{t('merge.summaryRenamed', { count: count('renamed') })}</li>
              )}
              {count('present') > 0 && (
                <li className="muted">{t('merge.summaryPresent', { count: count('present') })}</li>
              )}
            </ul>
          ) : (
            <p className="hint">{t('merge.planning')}</p>
          )}
          {count('renamed') > 0 && <p className="hint">{t('merge.renamedHint')}</p>}
          {current && current.renamed.length > 0 && (
            <p className="hint">
              {t('merge.alsoRenamed', {
                list: current.renamed.map((r) => `${r.from} → ${r.to}`).join(', '),
              })}
            </p>
          )}
          {current && toWrite === 0 && <p className="hint">{t('merge.nothingToDo')}</p>}

          <p className="hint">{t('merge.backup')}</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => apply.mutate()}
            disabled={!target || toWrite === 0 || apply.isPending || plan.isFetching}
          >
            {apply.isPending ? t('merge.merging') : t('merge.confirm', { count: toWrite })}
          </button>
        </aside>
      </div>
    </section>
  );
};
