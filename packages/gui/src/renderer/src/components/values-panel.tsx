import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import type { LinkedEntry, RevealedValue, ValueRef } from '../../../shared/api';
import { api, errorMessage } from '../api';

const HIDE_AFTER_MS = 30_000;

/** One key: masked until asked, hidden again after 30 seconds; copied by the main process */
const ValueRow: React.FC<{ valueRef: ValueRef }> = ({ valueRef }) => {
  const { t } = useTranslation();
  const [shown, setShown] = useState<RevealedValue | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  const toggle = async () => {
    setError(null);
    if (shown) return setShown(null);
    try {
      setShown(await api.running.reveal(valueRef));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const copy = async () => {
    setError(null);
    try {
      await api.running.copyValue(valueRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <li className="value-row">
      <span className="value-key mono">{valueRef.key}</span>
      <span className={shown ? 'value mono' : 'value masked'}>
        {shown
          ? shown.binary
            ? t('values.binary', { bytes: shown.bytes })
            : shown.text
          : '••••••••'}
      </span>
      <span className="value-actions">
        <button
          type="button"
          className="btn ghost icon-only"
          onClick={toggle}
          aria-label={
            shown
              ? t('values.hide', { key: valueRef.key })
              : t('values.show', { key: valueRef.key })
          }
          title={shown ? t('values.hideTip') : t('values.showTip')}
        >
          {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
        <button type="button" className="btn ghost" onClick={copy} disabled={shown?.binary}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t('values.copied') : t('values.copy')}
        </button>
      </span>
      <span className="visually-hidden" role="status">
        {copied ? t('values.copied') : ''}
      </span>
      {error && <span className="field-error value-error">{error}</span>}
    </li>
  );
};

const Group: React.FC<{
  templateId: string;
  forward: string;
  kind: 'secret' | 'configMap';
  entry: LinkedEntry;
}> = ({ templateId, forward, kind, entry }) => {
  const { t } = useTranslation();
  return (
    <section className="value-group">
      <h4>
        <span className="muted">
          {kind === 'secret' ? t('values.secret') : t('values.configMap')}
        </span>{' '}
        <span className="mono">{entry.name}</span>
      </h4>
      {!entry.keys ? (
        <p className="field-error">{t('values.unreadable', { error: entry.error })}</p>
      ) : entry.keys.length === 0 ? (
        <p className="hint">{t('values.noKeys')}</p>
      ) : (
        <ul>
          {entry.keys.map((key) => (
            <ValueRow key={key} valueRef={{ templateId, forward, kind, name: entry.name, key }} />
          ))}
        </ul>
      )}
    </section>
  );
};

/** Secret and config map values linked to a forward. Values are fetched one at a time, on request. */
export const ValuesPanel: React.FC<{ templateId: string; forward: string }> = ({
  templateId,
  forward,
}) => {
  const { t } = useTranslation();
  const linked = useQuery({
    queryKey: ['linked', templateId, forward],
    queryFn: () => api.running.linked(templateId, forward),
    staleTime: 60_000,
  });

  if (linked.isError) return <p className="inline-error">{errorMessage(linked.error)}</p>;
  if (!linked.data) return <p className="hint">{t('values.loading')}</p>;
  return (
    <div className="values-panel">
      {linked.data.secrets.map((e) => (
        <Group
          key={`s-${e.name}`}
          templateId={templateId}
          forward={forward}
          kind="secret"
          entry={e}
        />
      ))}
      {linked.data.configMaps.map((e) => (
        <Group
          key={`c-${e.name}`}
          templateId={templateId}
          forward={forward}
          kind="configMap"
          entry={e}
        />
      ))}
      <p className="hint">{t('values.hint')}</p>
    </div>
  );
};
