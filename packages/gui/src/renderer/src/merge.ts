import { useState } from 'react';
import type { MergeOutcome, MergePreview } from '../../shared/api';
import { api, errorMessage } from './api';

/**
 * State for the merge flow: start a preview from any source, show the dialog, report the outcome
 */
export function useMergeFlow() {
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [outcome, setOutcome] = useState<MergeOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<'files' | 'cluster'>('files');

  const start = async (
    load: () => Promise<MergePreview | null>,
    from: 'files' | 'cluster' = 'files'
  ) => {
    setSource(from);
    setError(null);
    setOutcome(null);
    setBusy(true);
    try {
      setPreview(await load());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return {
    preview,
    outcome,
    error,
    busy,
    /** Where the failed merge started from, to word the error */
    source,
    choose: () => start(() => api.kubeconfig.chooseAndPreview()),
    dropped: (files: File[]) => start(() => api.kubeconfig.previewDropped(files)),
    fromCluster: (clusterId: string) =>
      start(() => api.kubeconfig.previewCluster(clusterId), 'cluster'),
    close: (result?: MergeOutcome) => {
      setPreview(null);
      if (result) setOutcome(result);
    },
  };
}
