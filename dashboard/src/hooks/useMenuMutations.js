import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { removeItem, reorderGroupCategories, upsertItem } from '../lib/menuData';
import { toast } from '../lib/toast';
import { ADMIN_MENU_KEY } from './useAdminMenu';

const patchGroups = (qc, fn) => qc.setQueryData(ADMIN_MENU_KEY, (old) => (old ? fn(old) : old));
const refresh = (qc) => qc.invalidateQueries({ queryKey: ADMIN_MENU_KEY });

// Owner or staff.
export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isAvailable }) =>
      (await api.patch(`/api/admin/items/${id}/availability`, { isAvailable })).data.item,
    onSuccess: (item) => {
      patchGroups(qc, (g) => upsertItem(g, item));
      toast.success(`${item.name} is now ${item.isAvailable ? 'available' : 'unavailable'}.`);
    },
    onError: (err) => toast.error(describeError(err).message),
  });
}

// Owner only. `id` present = edit (partial payload), absent = create.
export function useSaveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = id
        ? await api.patch(`/api/admin/items/${id}`, payload)
        : await api.post('/api/admin/items', payload);
      return res.data.item;
    },
    onSuccess: (item) => patchGroups(qc, (g) => upsertItem(g, item)),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/admin/items/${id}`);
      return id;
    },
    onSuccess: (id) => patchGroups(qc, (g) => removeItem(g, id)),
  });
}

// Category changes are rare, so the menu is simply reloaded afterwards.
export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = id
        ? await api.patch(`/api/admin/categories/${id}`, payload)
        : await api.post('/api/admin/categories', payload);
      return res.data.category;
    },
    onSuccess: () => refresh(qc),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/admin/categories/${id}`);
      return id;
    },
    onSuccess: () => refresh(qc),
  });
}

// Shows the new order straight away; if the server refuses, the real order is reloaded.
export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }) => {
      await api.put('/api/admin/categories/order', { ids });
    },
    onMutate: ({ groupName, ids }) => {
      patchGroups(qc, (g) => reorderGroupCategories(g, groupName, ids));
    },
    onError: (err) => {
      toast.error(describeError(err).message);
      return refresh(qc);
    },
  });
}