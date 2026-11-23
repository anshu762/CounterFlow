import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// Full settings: owner or staff only.
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/api/settings')).data.settings,
    staleTime: 30_000,
  });
}