import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export const ADMIN_MENU_KEY = ['admin-menu'];

// Owner or staff. Returns the groups array: [{ name, categories: [{ ..., items: [...] }] }]
export function useAdminMenu() {
  return useQuery({
    queryKey: ADMIN_MENU_KEY,
    queryFn: async () => (await api.get('/api/admin/menu')).data.groups,
    staleTime: 30_000,
  });
}