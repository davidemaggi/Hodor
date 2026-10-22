import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MergeOutcome, MergePreview } from '../../../shared/api';
import { api, errorMessage } from '../api';
import { tildify } from '../format';

interface MergeDialogProps {
  preview: MergePreview | null;
  onClose: (outcome?: MergeOutcome) => void;
}

/**
 * Confirm a kubeconfig merge. A modal on purpose: it is about to rewrite the user's kubeconfig.
 */
export const MergeDialog: React.FC<MergeDialogProps> = ({ preview, onClose }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();

  const apply = useMutation({
    mutationFn: (token: string) => api.kubeconfig.applyMerge(token),
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      onClose(outcome);
    },
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (preview && !dialog.open) {
      apply.reset();
      dialog.showModal();
    }
    if (!preview && dialog.open) dialog.close();
    // apply is stable enough for this purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const nothingNew = preview && preview.added.length === 0;

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="merge-title" onCancel={() => onClose()}>
      {preview && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            apply.mutate(preview.token);
          }}
        >
          <h2 id="merge-title">{t('merge.title', { target: tildify(preview.target) })}</h2>
          <p className="sub">{t('merge.from', { files: preview.files.map(tildify).join(', ') })}</p>

          <section className="dialog-block">
            <h3>
              {nothingNew
                ? t('merge.nothingNew')
                : t('merge.added', { count: preview.added.length })}
            </h3>
            {!nothingNew && (
              <ul className="name-list">
                {preview.added.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </section>

          {preview.skipped.length > 0 && (
            <section className="dialog-block">
              <h3>{t('merge.skipped', { count: preview.skipped.length })}</h3>
              <ul className="name-list muted">
                {preview.skipped.map((s) => (
                  <li key={`${s.kind}:${s.name}:${s.file}`}>
                    {t(`merge.kind.${s.kind}`)} <strong>{s.name}</strong>
                  </li>
                ))}
              </ul>
              <p className="hint">{t('merge.skippedHint')}</p>
            </section>
          )}

          <p className="hint">{t('merge.backup')}</p>

          {apply.isError && <p className="inline-error">{errorMessage(apply.error)}</p>}

          <div className="dialog-actions">
            <button type="button" className="btn" onClick={() => onClose()}>
              {t('merge.cancel')}
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={apply.isPending || !!nothingNew}
            >
              {apply.isPending ? t('merge.merging') : t('merge.confirm')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
};
