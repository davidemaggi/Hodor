import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Download,
  GripVertical,
  Play,
  Plus,
  Search,
  Square,
  SquareTerminal,
  Trash2,
  Upload,
} from 'lucide-react';
import type { TemplateSummary } from '../../../shared/api';
import { api, errorMessage } from '../api';
import { useTemplates } from '../queries';
import { ErrorBlock, Skeleton } from '../components/states';
import { Command } from '../components/command';
import { CommandsPanel } from '../components/commands-panel';
import { ConfirmDialog } from '../components/confirm-dialog';
import { StartDialog } from '../components/start-dialog';
import { moveItem, useReorder } from '../hooks/use-reorder';
import { formatRelative } from '../format';

export const templatePath = (id: string) => `/templates/${id}`;

function matches(t: TemplateSummary, query: string, tags: string[]): boolean {
  if (tags.length && !tags.every((tag) => t.tags.includes(tag))) return false;
  if (!query) return true;
  const haystack = [
    t.name,
    t.description,
    ...t.tags,
    ...t.forwards.flatMap((f) => [f.name, f.resourceName, String(f.localPort)]),
  ]
    .join(' ')
    .toLowerCase();
  return query.split(/\s+/).every((word) => haystack.includes(word));
}

export const TemplatesView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const templates = useTemplates();
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TemplateSummary | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [starting, setStarting] = useState<TemplateSummary | null>(null);
  const stopRun = useMutation({
    mutationFn: (id: string) => api.running.stop(id),
    onSettled: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ['running'] });
    },
  });

  // Design-review hook for the browser preview only (?cmd=1); dropped from real builds
  useEffect(() => {
    if (
      import.meta.env.MODE === 'fixtures' &&
      new URLSearchParams(window.location.search).has('cmd') &&
      templates.data?.[0]
    ) {
      setOpen(templates.data[0].id);
    }
  }, [templates.data]);

  const all = templates.data ?? [];
  const list = order
    ? order.map((id) => all.find((x) => x.id === id)).filter((x): x is TemplateSummary => !!x)
    : all;
  const q = query.trim().toLowerCase();
  const filtering = !!q || tags.length > 0;
  const shown = list.filter((x) => matches(x, q, tags));
  const allTags = useMemo(() => [...new Set(all.flatMap((x) => x.tags))].sort(), [all]);
  const running = all.filter((x) => x.running).length;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['templates'] });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.templates.reorder(ids),
    onSettled: () => {
      setOrder(null);
      refresh();
    },
  });
  const { rowProps, handleProps } = useReorder((from, to) => {
    const ids = moveItem(
      list.map((x) => x.id),
      from,
      to
    );
    setOrder(ids);
    reorder.mutate(ids);
  }, !filtering);

  const remove = useMutation({
    mutationFn: (id: string) => api.templates.remove(id),
    onSuccess: (_d, id) => {
      const name = all.find((x) => x.id === id)?.name;
      setDeleting(null);
      setSelected((s) => new Set([...s].filter((x) => x !== id)));
      setNotice({ kind: 'ok', text: t('templates.deleted', { name }) });
      refresh();
      queryClient.invalidateQueries({ queryKey: ['running'] });
    },
  });

  const run = async <T,>(action: () => Promise<T>, ok: (value: T) => string | null) => {
    setNotice(null);
    try {
      const value = await action();
      const text = ok(value);
      if (text) setNotice({ kind: 'ok', text });
      refresh();
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error) });
    }
  };

  const doImport = () =>
    run(
      () => api.templates.importFromFile(),
      (names) =>
        names ? t('templates.imported', { count: names.length, names: names.join(', ') }) : null
    );
  const doExport = (ids: string[]) =>
    run(
      () => api.templates.exportToFile(ids),
      (file) => (file ? t('templates.exported', { count: ids.length, file }) : null)
    );

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allShownSelected = shown.length > 0 && shown.every((x) => selected.has(x.id));

  return (
    <section className="view" aria-labelledby="templates-title">
      <div className="title-row">
        <div>
          <h1 id="templates-title">{t('templates.title')}</h1>
          <p className="sub">
            {templates.isPending ? (
              <Skeleton width={180} />
            ) : all.length > 0 ? (
              t('templates.sub', { count: all.length, running })
            ) : (
              t('templates.subEmpty')
            )}
          </p>
        </div>
        <div className="actions">
          {selected.size > 0 && (
            <button type="button" className="btn" onClick={() => doExport([...selected])}>
              <Download aria-hidden="true" />
              {t('templates.exportSelected', { count: selected.size })}
            </button>
          )}
          <button type="button" className="btn" onClick={doImport}>
            <Upload aria-hidden="true" />
            {t('templates.import')}
          </button>
          <Link to="/templates/new" className="btn primary">
            <Plus aria-hidden="true" />
            {t('templates.new')}
          </Link>
        </div>
      </div>

      {notice && (
        <p
          className={notice.kind === 'ok' ? 'inline-success' : 'inline-error'}
          role={notice.kind === 'ok' ? 'status' : 'alert'}
        >
          {notice.text}
        </p>
      )}
      {(reorder.isError || remove.isError) && (
        <p className="inline-error" role="alert">
          {errorMessage(reorder.error || remove.error)}
        </p>
      )}

      {templates.isError ? (
        <ErrorBlock
          message={t('templates.error', { message: errorMessage(templates.error) })}
          onRetry={() => templates.refetch()}
        />
      ) : templates.isSuccess && all.length === 0 ? (
        <div className="start">
          <h2>{t('templates.startTitle')}</h2>
          <ol className="steps">
            <li>
              <h3>{t('templates.stepCreate')}</h3>
              <p>{t('templates.stepCreateDesc')}</p>
              <Link to="/templates/new" className="btn primary">
                <Plus aria-hidden="true" />
                {t('templates.new')}
              </Link>
            </li>
            <li>
              <h3>{t('templates.stepImport')}</h3>
              <p>{t('templates.stepImportDesc')}</p>
              <button type="button" className="btn" onClick={doImport}>
                <Upload aria-hidden="true" />
                {t('templates.import')}
              </button>
            </li>
            <li>
              <h3>{t('templates.stepRun')}</h3>
              <p>{t('templates.stepRunDesc')}</p>
              <Command value="hodor template:run stack" />
            </li>
          </ol>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <label className="search">
              <Search aria-hidden="true" />
              <span className="visually-hidden">{t('templates.search')}</span>
              <input
                type="search"
                className="input"
                data-search
                placeholder={t('templates.search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck={false}
              />
            </label>
            {allTags.length > 0 && (
              <div className="tag-filter" role="group" aria-label={t('templates.filterTags')}>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag-toggle"
                    aria-pressed={tags.includes(tag)}
                    onClick={() =>
                      setTags((x) => (x.includes(tag) ? x.filter((y) => y !== tag) : [...x, tag]))
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <span className="spacer" />
            {filtering && (
              <span className="stamp num">
                {t('templates.shown', { shown: shown.length, count: all.length })}
              </span>
            )}
          </div>
          {filtering && <p className="hint">{t('templates.reorderHint')}</p>}

          {shown.length === 0 && templates.isSuccess ? (
            <p className="empty-line">{t('templates.noMatch')}</p>
          ) : (
            <table className="templates-table">
              <thead>
                <tr>
                  <th className="handle-col">
                    <span className="visually-hidden">{t('templates.colOrder')}</span>
                  </th>
                  <th className="check-col">
                    <input
                      type="checkbox"
                      aria-label={t('templates.selectAll')}
                      checked={allShownSelected}
                      onChange={() =>
                        setSelected(allShownSelected ? new Set() : new Set(shown.map((x) => x.id)))
                      }
                    />
                  </th>
                  <th>{t('templates.colName')}</th>
                  <th>{t('templates.colPorts')}</th>
                  <th>{t('templates.colTags')}</th>
                  <th className="n">{t('templates.colUpdated')}</th>
                  <th>
                    <span className="visually-hidden">{t('templates.colActions')}</span>
                  </th>
                </tr>
              </thead>
              {templates.isPending ? (
                <tbody>
                  {[0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td />
                      <td />
                      <td className="identity">
                        <Skeleton width={120} />
                      </td>
                      <td>
                        <Skeleton width={150} />
                      </td>
                      <td>
                        <Skeleton width={80} height={22} />
                      </td>
                      <td className="n">
                        <Skeleton width={70} />
                      </td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              ) : (
                shown.map((tpl, index) => (
                  <tbody key={tpl.id} className="template-group" {...rowProps(index)}>
                    <tr
                      className="clickable"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a, button, input, label')) return;
                        navigate(templatePath(tpl.id));
                      }}
                    >
                      <td className="handle-col">
                        <button
                          type="button"
                          className="drag-handle"
                          aria-label={t('templates.reorder', { name: tpl.name })}
                          title={filtering ? t('templates.reorderHint') : t('templates.reorderTip')}
                          {...handleProps(index, shown.length)}
                        >
                          <GripVertical aria-hidden="true" />
                        </button>
                      </td>
                      <td className="check-col">
                        <input
                          type="checkbox"
                          aria-label={t('templates.select', { name: tpl.name })}
                          checked={selected.has(tpl.id)}
                          onChange={() => toggle(tpl.id)}
                        />
                      </td>
                      <td className="identity">
                        <span className="name-line">
                          <Link to={templatePath(tpl.id)} className="row-link name truncate">
                            {tpl.name}
                          </Link>
                          {tpl.running && (
                            <span className="pill pos">{t('templates.running')}</span>
                          )}
                        </span>
                        {tpl.description && <span className="sub truncate">{tpl.description}</span>}
                      </td>
                      <td>
                        <span className="port-list num">
                          {tpl.forwards.map((f) => (
                            <span key={f.name}>
                              <span className="mono">:{f.localPort}</span>{' '}
                              <span className="port-name">{f.name}</span>
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>
                        {tpl.tags.length ? (
                          <span className="tags">
                            {tpl.tags.map((tag) => (
                              <span key={tag} className="tag">
                                {tag}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="muted">{t('common.dash')}</span>
                        )}
                      </td>
                      <td className="n num nowrap">{formatRelative(tpl.updatedAt)}</td>
                      <td className="row-actions">
                        {tpl.running ? (
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => stopRun.mutate(tpl.id)}
                            disabled={stopRun.isPending}
                          >
                            <Square aria-hidden="true" />
                            {t('running.stop')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => setStarting(tpl)}
                          >
                            <Play aria-hidden="true" />
                            {t('start.run')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn ghost"
                          aria-expanded={open === tpl.id}
                          aria-controls={`commands-${tpl.id}`}
                          onClick={() => setOpen(open === tpl.id ? null : tpl.id)}
                        >
                          <SquareTerminal aria-hidden="true" />
                          {t('templates.kubectl')}
                        </button>
                        <button
                          type="button"
                          className="btn ghost icon-only"
                          aria-label={t('templates.exportOne', { name: tpl.name })}
                          title={t('templates.exportOne', { name: tpl.name })}
                          onClick={() => doExport([tpl.id])}
                        >
                          <Download aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn ghost icon-only danger"
                          aria-label={t('templates.delete', { name: tpl.name })}
                          title={t('templates.delete', { name: tpl.name })}
                          onClick={() => setDeleting(tpl)}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                    {open === tpl.id && (
                      <tr className="expansion" id={`commands-${tpl.id}`}>
                        <td colSpan={7}>
                          <CommandsPanel template={tpl} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))
              )}
            </table>
          )}
        </>
      )}

      <StartDialog
        template={starting}
        onClose={(started) => {
          setStarting(null);
          if (started) navigate('/running');
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t('templates.deleteTitle', { name: deleting?.name })}
        body={<p>{deleting?.running ? t('templates.deleteRunning') : t('templates.deleteBody')}</p>}
        confirmLabel={deleting?.running ? t('templates.deleteStop') : t('templates.deleteYes')}
        cancelLabel={t('merge.cancel')}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
};
