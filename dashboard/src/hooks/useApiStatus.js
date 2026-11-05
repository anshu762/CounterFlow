import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useApiHealth() {
  return useQuery({
    queryKey: ['health', 'api'],
    queryFn: async () => (await api.get('/health')).data,
    refetchInterval: 15000,
    retry: 1,
  });
}

export function useDbHealth() {
  return useQuery({
    queryKey: ['health', 'db'],
    queryFn: async () => {
      try {
        return (await api.get('/health/db')).data;
      } catch (err) {
        // The API answers 503 with a JSON body when the DB is down: show it as "degraded".
        if (err.response?.data) return err.response.data;
        throw err;
      }
    },
    refetchInterval: 15000,
    retry: 1,
  });
}