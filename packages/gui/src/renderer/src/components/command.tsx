import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, X } from 'lucide-react';

interface CopyButtonProps {
  value: string;
  label: string;
  /** Show only the icon; the label stays as the accessible name */
  iconOnly?: boolean;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** Copies a value and confirms in place for a moment; announces the result to screen readers */
export const CopyButton: React.FC<CopyButtonProps> = ({ value, label, iconOnly = false }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<CopyState>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1800);
  };

  const text =
    state === 'copied' ? t('common.copied') : state === 'failed' ? t('common.copyFailed') : label;
  const Icon = state === 'copied' ? Check : state === 'failed' ? X : Copy;

  return (
    <>
      <button
        type="button"
        className={iconOnly ? 'btn ghost icon' : 'btn ghost'}
        onClick={copy}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        data-state={state}
      >
        <Icon aria-hidden="true" />
        {!iconOnly && text}
      </button>
      <span className="visually-hidden" role="status">
        {state === 'idle' ? '' : text}
      </span>
    </>
  );
};

/** A terminal command the user can copy */
export const Command: React.FC<{ value: string }> = ({ value }) => {
  const { t } = useTranslation();
  return (
    <span className="command">
      <code>{value}</code>
      <CopyButton value={value} label={t('common.copyCommand')} iconOnly />
    </span>
  );
};
