import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { upsertItem } from '../lib/menuData';
import { removeVariant, reorderCategoryItems, upsertVariant } from '../lib/menuEdit';
import { toast } from '../lib/toast';
import { ADMIN_MENU_KEY } from './useAdminMenu';

const patchGroups = (qc, fn) => qc.setQueryData(ADMIN_MENU_KEY, (old) => (old ? fn(old) : old));
const refresh = (qc) => qc.invalidateQueries({ queryKey: ADMIN_MENU_KEY });

// A photo from a phone camera over mobile data can be slow.
const UPLOAD_TIMEOUT_MS = 120_000;

// ---------- photo (owner only) ----------
// The server wants the raw bytes with the image Content-Type, not multipart.
export function useUploadItemImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file, contentType }) =>
      (
        await api.put(`/api/admin/items/${id}/image`, file, {
          headers: { 'Content-Type': contentType },
          timeout: UPLOAD_TIMEOUT_MS,
        })
      ).data.item,
    onSuccess: (item) => {
      patchGroups(qc, (g) => upsertItem(g, item));
      toast.success('Photo updated.');
    },
  });
}

export function useRemoveItemImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/api/admin/items/${id}/image`)).data.item,
    onSuccess: (item) => {
      patchGroups(qc, (g) => upsertItem(g, item));
      toast.success('Photo removed.');
    },
  });
}

// ---------- sizes (create/update/delete: owner only; availability: owner or staff) ----------
export function useCreateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, payload }) => ({
      itemId,
      variant: (await api.post(`/api/admin/items/${itemId}/variants`, payload)).data.variant,
    }),
    onSuccess: ({ itemId, variant }) => {
      patchGroups(qc, (g) => upsertVariant(g, itemId, variant));
      toast.success('Size added.');
    },
  });
}

export function useUpdateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, variantId, payload }) => ({
      itemId,
      variant: (await api.patch(`/api/admin/variants/${variantId}`, payload)).data.variant,
    }),
    onSuccess: ({ itemId, variant }) => {
      patchGroups(qc, (g) => upsertVariant(g, itemId, variant));
      toast.success('Size saved.');
    },
  });
}

export function useSetVariantAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, variantId, isAvailable }) => ({
      itemId,
      variant: (await api.patch(`/api/admin/variants/${variantId}/availability`, { isAvailable }))
        .data.variant,
    }),
    onSuccess: ({ itemId, variant }) => {
      patchGroups(qc, (g) => upsertVariant(g, itemId, variant));
      toast.success(`${variant.label ?? 'Size'} is now ${variant.isAvailable ? 'available' : 'unavailable'}.`);
    },
    onError: (err) => toast.error(describeError(err).message),
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, variantId }) => {
      await api.delete(`/api/admin/variants/${variantId}`);
      return { itemId, variantId };
    },
    onSuccess: ({ itemId, variantId }) => {
      patchGroups(qc, (g) => removeVariant(g, itemId, variantId));
      toast.success('Size deleted.');
    },
  });
}

// ---------- item order inside one category (owner only) ----------
// Shows the new order straight away; if the server refuses, the real order is reloaded.
export function useReorderItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ categoryId, ids }) => {
      await api.put(`/api/admin/categories/${categoryId}/items/order`, { ids });
    },
    onMutate: async ({ categoryId, ids }) => {
      await qc.cancelQueries({ queryKey: ADMIN_MENU_KEY });
      patchGroups(qc, (g) => reorderCategoryItems(g, categoryId, ids));
    },
    onError: (err) => {
      toast.error(describeError(err).message);
      return refresh(qc);
    },
  });
}
