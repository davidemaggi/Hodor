import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useClusters, useTemplates } from '../queries';
import { clusterPath } from '../views/clusters';
import { templatePath } from '../views/templates';

interface Item {
  id: string;
  label: string;
  hint: string;
  to: string;
}

/** ⌘K / Ctrl+K: jump to any section, cluster or template */
export const Palette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clusters = useClusters();
  const templates = useTemplates();
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery('');
      setActive(0);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const items = useMemo<Item[]>(
    () => [
      { id: 'v-clusters', label: t('nav.clusters'), hint: t('palette.section'), to: '/clusters' },
      {
        id: 'v-templates',
        label: t('nav.templates'),
        hint: t('palette.section'),
        to: '/templates',
      },
      { id: 'v-running', label: t('nav.running'), hint: t('palette.section'), to: '/running' },
      { id: 'v-settings', label: t('nav.settings'), hint: t('palette.section'), to: '/settings' },
      { id: 'a-new', label: t('templates.new'), hint: t('palette.action'), to: '/templates/new' },
      ...(clusters.data ?? []).map((c) => ({
        id: `c-${c.id}`,
        label: c.name,
        hint: t('palette.cluster'),
        to: clusterPath(c.id),
      })),
      ...(templates.data ?? []).map((x) => ({
        id: `t-${x.id}`,
        label: x.name,
        hint: t('palette.template'),
        to: templatePath(x.id),
      })),
    ],
    [clusters.data, templates.data, t]
  );

  const q = query.trim().toLowerCase();
  const shown = (q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items).slice(0, 12);
  const go = (item?: Item) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  return (
    <dialog
      ref={ref}
      className="dialog palette"
      aria-label={t('palette.title')}
      onCancel={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <>
          <label className="search full">
            <Search aria-hidden="true" />
            <span className="visually-hidden">{t('palette.title')}</span>
            <input
              className="input"
              autoFocus
              value={query}
              placeholder={t('palette.placeholder')}
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={shown[active] ? `pal-${shown[active].id}` : undefined}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, shown.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  go(shown[active]);
                }
              }}
              spellCheck={false}
            />
          </label>
          <ul id="palette-list" role="listbox" className="palette-list">
            {shown.length === 0 && <li className="hint">{t('palette.nothing')}</li>}
            {shown.map((item, i) => (
              <li
                key={item.id}
                id={`pal-${item.id}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
              >
                <span className="truncate">{item.label}</span>
                <span className="muted">{item.hint}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </dialog>
  );
};
