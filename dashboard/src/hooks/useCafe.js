import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// Public endpoint: works before sign-in, so the login page can show the café name and theme.
export function useCafe() {
  return useQuery({
    queryKey: ['cafe'],
    queryFn: async () => (await api.get('/api/cafe')).data.cafe,
    staleTime: 60_000,
    retry: 1,
  });
}