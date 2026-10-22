import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const useAppInfo = () =>
  useQuery({ queryKey: ['app'], queryFn: () => api.app.info(), staleTime: Infinity });
export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: () => api.settings.get() });
export const useClusters = () =>
  useQuery({ queryKey: ['clusters'], queryFn: () => api.clusters.list() });
export const useClusterHealth = (id: string) =>
  useQuery({ queryKey: ['health', id], queryFn: () => api.clusters.health(id), staleTime: 30_000 });
export const useTemplates = () =>
  useQuery({
    queryKey: ['templates'],
    queryFn: () => api.templates.list(),
    refetchInterval: 5_000,
  });
// The CLI starts and stops templates too, so keep polling
export const useRunning = () =>
  useQuery({ queryKey: ['running'], queryFn: () => api.running.list(), refetchInterval: 3_000 });

/** Clusters the user marked as production, and a way to toggle the mark */
export function useProduction() {
  const settings = useSettings();
  const queryClient = useQueryClient();
  const ids = settings.data?.productionClusters ?? [];
  const toggle = useMutation({
    mutationFn: (id: string) =>
      api.settings.update({
        productionClusters: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
      }),
    onSuccess: (next) => queryClient.setQueryData(['settings'], next),
  });
  return {
    isProduction: (id: string) => ids.includes(id),
    toggle: (id: string) => toggle.mutate(id),
    busy: toggle.isPending,
  };
}
