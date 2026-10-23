import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  /** "danger" for actions that delete or stop things */
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Ask before a risky write. Focus starts on Cancel, Esc cancels.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  tone = 'default',
  onConfirm,
  onCancel,
}) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="confirm-title" onCancel={onCancel}>
      {open && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
          }}
        >
          <h2 id="confirm-title">{title}</h2>
          <div className="dialog-body">{body}</div>
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onCancel} autoFocus>
              {cancelLabel}
            </button>
            <button
              type="submit"
              className={tone === 'danger' ? 'btn danger-fill' : 'btn primary'}
              disabled={busy}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
};
