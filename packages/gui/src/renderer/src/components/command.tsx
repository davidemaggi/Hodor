import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';

interface CopyButtonProps {
  value: string;
  label: string;
  /** Show only the icon; the label stays as the accessible name */
  iconOnly?: boolean;
}

/** Copies a value and confirms in place for a moment */
export const CopyButton: React.FC<CopyButtonProps> = ({ value, label, iconOnly = false }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      className={iconOnly ? 'btn ghost icon' : 'btn ghost'}
      onClick={copy}
      aria-label={iconOnly ? (copied ? t('common.copied') : label) : undefined}
      title={iconOnly ? label : undefined}
      aria-live="polite"
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {!iconOnly && (copied ? t('common.copied') : label)}
    </button>
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
