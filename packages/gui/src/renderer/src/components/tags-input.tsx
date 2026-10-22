import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface TagsInputProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

/** Tags as removable chips; Enter or comma adds, Backspace on an empty field removes the last */
export const TagsInput: React.FC<TagsInputProps> = ({
  id,
  value,
  onChange,
  suggestions = [],
  placeholder,
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 50);
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };

  return (
    <div className="tags-input">
      {value.map((tag) => (
        <span key={tag} className="tag">
          {tag}
          <button
            type="button"
            className="tag-remove"
            onClick={() => onChange(value.filter((x) => x !== tag))}
            aria-label={t('editor.removeTag', { tag })}
          >
            <X aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="tags-field"
        value={draft}
        list={`${id}-suggestions`}
        placeholder={value.length ? '' : (placeholder ?? t('editor.tagsPlaceholder'))}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) add(e.target.value.slice(0, -1));
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        spellCheck={false}
      />
      <datalist id={`${id}-suggestions`}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
};
