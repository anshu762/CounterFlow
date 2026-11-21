import { Router } from 'express';
import { rawImageBody, MAX_IMAGE_BYTES } from '../uploads/rawImageBody.js';
import {
  idParams,
  variantParams,
  categoryCreate,
  categoryUpdate,
  itemCreate,
  itemUpdate,
  variantCreate,
  variantUpdate,
  availabilityBody,
  reorderBody,
  publicMenuQuery,
} from './menu.schemas.js';

// guards = { staff: [middleware...], owner: [middleware...] }
export function createMenuRoutes({ service, guards, maxImageBytes = MAX_IMAGE_BYTES }) {
  const router = Router();

  // ---------- public ----------
  router.get('/menu', async (req, res) => {
    const query = publicMenuQuery.parse(req.query);
    const veg = query.veg === undefined ? null : query.veg === 'true';
    const data = await service.getPublicMenu({ veg });
    res.set('Cache-Control', 'public, max-age=15');
    res.json(data);
  });

  router.get('/menu/items/:id', async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.set('Cache-Control', 'public, max-age=15');
    res.json(await service.getPublicItem(id));
  });

  // ---------- admin ----------
  router.use('/admin', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // staff + owner
  router.get('/admin/menu', ...guards.staff, async (req, res) => {
    res.json(await service.getAdminMenu());
  });

  router.get('/admin/items/:id', ...guards.staff, async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json(await service.getAdminItem(id));
  });

  router.patch('/admin/items/:id/availability', ...guards.staff, async (req, res) => {
    const { id } = idParams.parse(req.params);
    const { isAvailable } = availabilityBody.parse(req.body);
    res.json(await service.setItemAvailability(id, isAvailable));
  });

  router.patch('/admin/variants/:variantId/availability', ...guards.staff, async (req, res) => {
    const { variantId } = variantParams.parse(req.params);
    const { isAvailable } = availabilityBody.parse(req.body);
    res.json(await service.updateVariant(variantId, { isAvailable }));
  });

  // owner only: categories
  router.post('/admin/categories', ...guards.owner, async (req, res) => {
    const input = categoryCreate.parse(req.body);
    res.status(201).json(await service.createCategory(input));
  });

  router.put('/admin/categories/order', ...guards.owner, async (req, res) => {
    const { ids } = reorderBody.parse(req.body);
    await service.reorderCategories(ids);
    res.status(204).end();
  });

  router.patch('/admin/categories/:id', ...guards.owner, async (req, res) => {
    const { id } = idParams.parse(req.params);
    const input = categoryUpdate.parse(req.body);
    res.json(await service.updateCategory(id, input));
  });

  router.delete('/admin/categories/:id', ...guards.owner, async (req, res) => {
    const { id } = idParams.parse(req.params);
    await service.deleteCategory(id);
    res.status(204).end();
  });

  router.put('/admin/categories/:id/items/order', ...guards.owner, async (req, res) => {
    const { id } = idParams.parse(req.params);
    const { ids } = reorderBody.parse(req.body);
    await service.reorderItems(id, ids);
    res.status(204).end();
  });

  // owner only: items
  router.post('/admin/items', ...guards.owner, async (req, res) => {
    const input = itemCreate.parse(req.body);
    res.status(201).json(await service.createItem(input));
  });

  router.patch('/admin/items/:id', ...guards.owner, async (req, res) => {
    const { id } = idParams.parse(req.params);
    const input = itemUpdate.parse(req.body);
    res.json(await service.updateItem(id, input));
  });

  router.delete('/admin/items/:id', ...guards.owner, async (req, res) => {
    const { id } = idParams.parse(req.params);
    await service.deleteItem(id);
    res.status(204).end();
  });

  // owner only: item image (raw bytes in the body)
  router.put(
    '/admin/items/:id/image',
    ...guards.owner,
    rawImageBody(maxImageBytes),
    async (req, res) => {
      const { id } = idParams.parse(req.params);
      res.json(await service.uploadItemImage(id, req.body));
    },
  );

  router.delete('/admin/items/:id/image', ...guards.owner, async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json(await service.removeItemImage(id));
  });

  // owner only: variants
  router.post('/admin/items/:id/variants', ...guards.owner, async (req, res) => {
    const { id } = idParams.parse(req.params);
    const input = variantCreate.parse(req.body);
    res.status(201).json(await service.createVariant(id, input));
  });

  router.patch('/admin/variants/:variantId', ...guards.owner, async (req, res) => {
    const { variantId } = variantParams.parse(req.params);
    const input = variantUpdate.parse(req.body);
    res.json(await service.updateVariant(variantId, input));
  });

  router.delete('/admin/variants/:variantId', ...guards.owner, async (req, res) => {
    const { variantId } = variantParams.parse(req.params);
    await service.deleteVariant(variantId);
    res.status(204).end();
  });

  return router;
}
