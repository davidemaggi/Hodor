import { Trans, useTranslation } from 'react-i18next';
import { RotateCw } from 'lucide-react';

interface EmptyProps {
  title: string;
  /** i18n key whose text may contain <code></code> */
  bodyKey: string;
}

export const Empty: React.FC<EmptyProps> = ({ title, bodyKey }) => (
  <div className="empty" role="status">
    <strong>{title}</strong>
    <span>
      <Trans i18nKey={bodyKey} components={{ code: <code /> }} />
    </span>
  </div>
);

interface ErrorBlockProps {
  message: string;
  onRetry: () => void;
}

export const ErrorBlock: React.FC<ErrorBlockProps> = ({ message, onRetry }) => {
  const { t } = useTranslation();
  return (
    <div className="error" role="alert">
      <span>{message}</span>
      <button type="button" className="btn ghost" onClick={onRetry}>
        <RotateCw aria-hidden="true" />
        {t('common.retry')}
      </button>
    </div>
  );
};

interface SkeletonProps {
  width: number;
  height?: number;
}

/** A flat grey bar at the real size of the value it stands in for. No shimmer. */
export const Skeleton: React.FC<SkeletonProps> = ({ width, height = 14 }) => (
  <span className="skeleton" style={{ width, height }} aria-hidden="true" />
);
