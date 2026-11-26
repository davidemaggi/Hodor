import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { matchOptions, type MatchOption } from '../match';

interface ComboboxProps {
  /** Base for the list and option ids */
  id: string;
  value: string;
  options: MatchOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

const MAX_LIST_HEIGHT = 280;

/**
 * A select you can type into: the field filters the list, arrows move, Enter picks, Escape gives up.
 * Wrap it in a <label> for its name. The list lives in the top layer (popover), so scrolling
 * containers like the editor's picker never clip it.
 */
export const Combobox: React.FC<ComboboxProps> = ({ id, value, options, onChange, disabled }) => {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  // null while not typing: the field shows the current choice
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => matchOptions(options, query ?? ''), [options, query]);
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const show = () => {
    if (disabled || open) return;
    setOpen(true);
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value)
      )
    );
  };
  const close = () => {
    setOpen(false);
    setQuery(null);
  };
  const pick = (option: MatchOption | undefined) => {
    if (option && option.value !== value) onChange(option.value);
    close();
  };

  // Follow the field while open: below it, or above when there's no room
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    list.showPopover?.();
    const place = () => {
      const box = wrapRef.current?.getBoundingClientRect();
      if (!box) return;
      const below = window.innerHeight - box.bottom;
      const up = below < 160 && box.top > below;
      list.style.left = `${box.left}px`;
      list.style.width = `${box.width}px`;
      list.style.top = up ? '' : `${box.bottom + 4}px`;
      list.style.bottom = up ? `${window.innerHeight - box.top + 4}px` : '';
      list.style.maxHeight = `${Math.min(MAX_LIST_HEIGHT, (up ? box.top : below) - 12)}px`;
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      if (list.matches(':popover-open')) list.hidePopover?.();
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, shown]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        if (!open) return show();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((a) => Math.min(Math.max(a + step, 0), Math.max(shown.length - 1, 0)));
        break;
      }
      case 'Enter':
        // never submits the surrounding form
        e.preventDefault();
        if (open) pick(shown[active]);
        else show();
        break;
      case 'Escape':
        if (open) {
          // closes the list, not the dialog around it
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case 'Tab':
        close();
        break;
    }
  };

  return (
    <div className="combo" ref={wrapRef} data-open={open || undefined}>
      <input
        ref={inputRef}
        id={id}
        className="input combo-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? optionId(active) : undefined}
        value={query ?? selected?.label ?? value}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onClick={(e) => {
          if (query === null) e.currentTarget.select();
          show();
        }}
        onKeyDown={onKeyDown}
        onBlur={close}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="combo-toggle"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          inputRef.current?.focus();
          if (open) close();
          else {
            inputRef.current?.select();
            show();
          }
        }}
      >
        <ChevronDown />
      </button>
      <ul
        ref={listRef}
        id={listId}
        className="combo-list"
        role="listbox"
        popover="manual"
        // keep focus in the field while clicking the list
        onMouseDown={(e) => e.preventDefault()}
      >
        {open &&
          shown.map((o, i) => (
            <li
              key={o.value}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              data-current={o.value === value || undefined}
              onMouseMove={() => i !== active && setActive(i)}
              onClick={() => pick(o)}
            >
              <span className="truncate">{o.label}</span>
            </li>
          ))}
        {open && shown.length === 0 && (
          <li className="combo-empty" role="presentation">
            {t('common.noMatch', { query: query?.trim() })}
          </li>
        )}
      </ul>
    </div>
  );
};
