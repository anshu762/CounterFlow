import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createMenuRoutes } from '../src/modules/menu/menu.routes.js';
import { createMenuService } from '../src/modules/menu/menu.service.js';
import { slotValues } from '../src/modules/menu/menu.util.js';
import { detectImageType } from '../src/modules/uploads/imageType.js';
import { errorHandler, notFound } from '../src/middleware/error.js';
import { AppError } from '../src/utils/errors.js';
import { createMemoryMenuStore } from './helpers/memoryMenuStore.js';
import { createFakeImageStorage } from './helpers/fakeImageStorage.js';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
  Buffer.alloc(32),
]);

// Fake guards: the real ones (JWT + DB role check) are exercised by the live check.
const guard = (allowed) => (req, res, next) => {
  const role = req.get('x-test-role');
  if (!role) return next(new AppError('Sign in required', 401, 'AUTH_REQUIRED'));
  if (!allowed.includes(role)) return next(new AppError('Not allowed', 403, 'FORBIDDEN'));
  return next();
};

let app;
let store;
let storage;

function setup(options = {}) {
  store = createMemoryMenuStore();
  storage = createFakeImageStorage();
  const service = createMenuService({ store, imageStorage: storage });
  app = express();
  app.use(express.json());
  app.use(
    '/api',
    createMenuRoutes({
      service,
      guards: { staff: [guard(['owner', 'staff'])], owner: [guard(['owner'])] },
      maxImageBytes: options.maxImageBytes,
    }),
  );
  app.use(notFound);
  app.use(errorHandler);
}

const as = (role) => {
  const call = (method) => (url) => {
    const r = request(app)[method](url);
    return role ? r.set('x-test-role', role) : r;
  };
  return {
    get: call('get'),
    post: call('post'),
    patch: call('patch'),
    put: call('put'),
    del: call('delete'),
  };
};
const owner = () => as('owner');
const staff = () => as('staff');

async function mkCategory(name = 'Hot Coffee', groupName = 'Beverages', extra = {}) {
  const res = await owner()
    .post('/api/admin/categories')
    .send({ name, groupName, ...extra });
  expect(res.status).toBe(201);
  return res.body.category;
}
async function mkItem(categoryId, over = {}) {
  const res = await owner()
    .post('/api/admin/items')
    .send({ categoryId, name: 'Latte', price: 150, isVeg: true, ...over });
  expect(res.status).toBe(201);
  return res.body.item;
}
const flatCategoryNames = (groups) => groups.flatMap((g) => g.categories.map((c) => c.name));

beforeEach(() => setup());

describe('helpers', () => {
  it('slotValues reuses existing slots in order', () => {
    expect(slotValues([4, 1, 9])).toEqual([1, 4, 9]);
  });
  it('slotValues falls back to consecutive numbers when slots collide', () => {
    expect(slotValues([0, 0, 0])).toEqual([0, 1, 2]);
  });
  it('detects real image signatures', () => {
    expect(detectImageType(JPEG)).toBe('jpeg');
    expect(detectImageType(PNG)).toBe('png');
    expect(detectImageType(WEBP)).toBe('webp');
    expect(detectImageType(Buffer.from('hello world, not an image'))).toBeNull();
    expect(detectImageType(Buffer.alloc(3))).toBeNull();
  });
});

describe('public menu', () => {
  it('returns an empty menu', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ groups: [] });
  });

  it('shows only available items in active categories, grouped, with available sizes', async () => {
    const coffee = await mkCategory('Hot Coffee', 'Beverages');
    const burgers = await mkCategory('Burgers', 'Snacks');
    const hidden = await mkCategory('Hidden', 'Secret', { isActive: false });
    const latte = await mkItem(coffee.id, { name: 'Latte', badge: 'must_try' });
    const mocha = await mkItem(coffee.id, { name: 'Mocha' });
    const gone = await mkItem(coffee.id, { name: 'Gone' });
    await mkItem(burgers.id, { name: 'Zinger', isVeg: false });
    await mkItem(hidden.id, { name: 'Secret Dish' });
    await owner()
      .post(`/api/admin/items/${latte.id}/variants`)
      .send({ label: 'Small', price: 100 });
    const large = await owner()
      .post(`/api/admin/items/${latte.id}/variants`)
      .send({ label: 'Large', price: 190 });
    await owner()
      .patch(`/api/admin/variants/${large.body.variant.id}/availability`)
      .send({ isAvailable: false });
    await staff().patch(`/api/admin/items/${mocha.id}/availability`).send({ isAvailable: false });
    await owner().del(`/api/admin/items/${gone.id}`);

    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/max-age=15/);
    expect(res.body.groups.map((g) => g.name)).toEqual(['Beverages', 'Snacks']);
    const names = res.body.groups.flatMap((g) =>
      g.categories.flatMap((c) => c.items.map((i) => i.name)),
    );
    expect(names).toEqual(['Latte', 'Zinger']);
    const first = res.body.groups[0].categories[0].items[0];
    expect(first.price).toBe(150);
    expect(first.badge).toBe('must_try');
    expect(first.variants).toEqual([{ id: expect.any(String), label: 'Small', price: 100 }]);
    expect(first).not.toHaveProperty('imagePublicId');
    expect(first).not.toHaveProperty('isAvailable');
  });

  it('orders groups by the order of their categories', async () => {
    const pizza = await mkCategory('Classic Pizza', 'Pizza');
    const coffee = await mkCategory('Hot Coffee', 'Beverages');
    const pasta = await mkCategory('Pasta', 'Pizza');
    for (const c of [pizza, coffee, pasta]) await mkItem(c.id, { name: `${c.name} item` });
    const res = await request(app).get('/api/menu');
    expect(res.body.groups.map((g) => g.name)).toEqual(['Pizza', 'Beverages']);
    expect(res.body.groups[0].categories.map((c) => c.name)).toEqual(['Classic Pizza', 'Pasta']);
  });

  it('filters by veg', async () => {
    const cat = await mkCategory();
    await mkItem(cat.id, { name: 'Veg One', isVeg: true });
    await mkItem(cat.id, { name: 'Meat One', isVeg: false });
    const veg = await request(app).get('/api/menu?veg=true');
    const non = await request(app).get('/api/menu?veg=false');
    expect(veg.body.groups[0].categories[0].items.map((i) => i.name)).toEqual(['Veg One']);
    expect(non.body.groups[0].categories[0].items.map((i) => i.name)).toEqual(['Meat One']);
    expect((await request(app).get('/api/menu?veg=maybe')).status).toBe(400);
  });

  it('serves a single available item and hides unavailable ones', async () => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    const ok = await request(app).get(`/api/menu/items/${item.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.item.name).toBe('Latte');
    await owner().patch(`/api/admin/items/${item.id}/availability`).send({ isAvailable: false });
    const hidden = await request(app).get(`/api/menu/items/${item.id}`);
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('ITEM_NOT_FOUND');
    expect((await request(app).get('/api/menu/items/not-an-id')).status).toBe(400);
  });
});

describe('admin access', () => {
  it('requires sign-in', async () => {
    expect((await as(null).get('/api/admin/menu')).status).toBe(401);
    expect((await as(null).post('/api/admin/items').send({})).status).toBe(401);
  });

  it('lets staff read the admin menu and toggle availability only', async () => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    expect((await staff().get('/api/admin/menu')).status).toBe(200);
    expect(
      (await staff().patch(`/api/admin/items/${item.id}/availability`).send({ isAvailable: false }))
        .status,
    ).toBe(200);
    expect(
      (await staff().post('/api/admin/categories').send({ name: 'X', groupName: 'Y' })).status,
    ).toBe(403);
    expect((await staff().patch(`/api/admin/items/${item.id}`).send({ price: 1 })).status).toBe(
      403,
    );
    expect((await staff().del(`/api/admin/items/${item.id}`)).status).toBe(403);
    expect(
      (
        await staff()
          .put(`/api/admin/items/${item.id}/image`)
          .set('Content-Type', 'image/jpeg')
          .send(JPEG)
      ).status,
    ).toBe(403);
  });

  it('admin menu includes hidden categories and unavailable items, no cache', async () => {
    const cat = await mkCategory('Hidden', 'Secret', { isActive: false });
    const item = await mkItem(cat.id);
    await owner().patch(`/api/admin/items/${item.id}/availability`).send({ isAvailable: false });
    const res = await staff().get('/api/admin/menu');
    expect(res.headers['cache-control']).toBe('no-store');
    const c = res.body.groups[0].categories[0];
    expect(c.isActive).toBe(false);
    expect(c.itemCount).toBe(1);
    expect(c.items[0].isAvailable).toBe(false);
    expect(c.items[0].hasOwnImage).toBe(false);
  });
});

describe('categories', () => {
  it('creates, rejects duplicates (case-insensitive) and bad input', async () => {
    const cat = await mkCategory('Hot Coffee', 'Beverages', { description: '  Fresh  ' });
    expect(cat.description).toBe('Fresh');
    expect(cat.isActive).toBe(true);
    const dup = await owner()
      .post('/api/admin/categories')
      .send({ name: 'hot coffee', groupName: 'B' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CATEGORY_NAME_TAKEN');
    expect(
      (await owner().post('/api/admin/categories').send({ name: ' ', groupName: 'B' })).status,
    ).toBe(400);
    expect(
      (await owner().post('/api/admin/categories').send({ name: 'Z', groupName: 'B', foo: 1 }))
        .status,
    ).toBe(400);
  });

  it('updates and hides a category', async () => {
    const cat = await mkCategory();
    const res = await owner()
      .patch(`/api/admin/categories/${cat.id}`)
      .send({ isActive: false, description: '' });
    expect(res.status).toBe(200);
    expect(res.body.category.isActive).toBe(false);
    expect(res.body.category.description).toBeNull();
    expect((await owner().patch(`/api/admin/categories/${cat.id}`).send({})).status).toBe(400);
    expect(
      (await owner().patch(`/api/admin/categories/${randomUUID()}`).send({ name: 'x' })).status,
    ).toBe(404);
  });

  it('deletes empty categories but refuses non-empty ones', async () => {
    const empty = await mkCategory('Empty', 'G');
    const full = await mkCategory('Full', 'G');
    await mkItem(full.id);
    expect((await owner().del(`/api/admin/categories/${empty.id}`)).status).toBe(204);
    const refused = await owner().del(`/api/admin/categories/${full.id}`);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('CATEGORY_NOT_EMPTY');
  });

  it('reorders categories', async () => {
    const a = await mkCategory('A', 'G');
    const b = await mkCategory('B', 'G');
    const c = await mkCategory('C', 'G');
    const res = await owner()
      .put('/api/admin/categories/order')
      .send({ ids: [c.id, a.id, b.id] });
    expect(res.status).toBe(204);
    const menu = await staff().get('/api/admin/menu');
    expect(flatCategoryNames(menu.body.groups)).toEqual(['C', 'A', 'B']);
  });

  it('rejects bad reorder lists', async () => {
    const a = await mkCategory('A', 'G');
    expect(
      (
        await owner()
          .put('/api/admin/categories/order')
          .send({ ids: [a.id, a.id] })
      ).status,
    ).toBe(400);
    expect((await owner().put('/api/admin/categories/order').send({ ids: [] })).status).toBe(400);
    expect(
      (
        await owner()
          .put('/api/admin/categories/order')
          .send({ ids: [randomUUID()] })
      ).status,
    ).toBe(404);
  });
});

describe('items', () => {
  it('creates with defaults', async () => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    expect(item).toMatchObject({
      name: 'Latte',
      price: 150,
      gstPercent: 5,
      prepTimeMinutes: 10,
      isAvailable: true,
      isVeg: true,
      badge: null,
      description: null,
      hasOwnImage: false,
      variants: [],
    });
  });

  it.each([
    ['price 0', { price: 0 }],
    ['negative price', { price: -5 }],
    ['3 decimal places', { price: 10.123 }],
    ['string price', { price: '10' }],
    ['gst 29', { gstPercent: 29 }],
    ['gst -1', { gstPercent: -1 }],
    ['prep 0', { prepTimeMinutes: 0 }],
    ['fractional prep', { prepTimeMinutes: 1.5 }],
    ['blank name', { name: '   ' }],
    ['unknown badge', { badge: 'best' }],
    ['unknown field', { foo: 1 }],
    ['bad category id', { categoryId: 'nope' }],
  ])('rejects %s', async (_label, over) => {
    const cat = await mkCategory();
    const res = await owner()
      .post('/api/admin/items')
      .send({ categoryId: cat.id, name: 'Latte', price: 150, isVeg: true, ...over });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts boundary values', async () => {
    const cat = await mkCategory();
    const a = await mkItem(cat.id, {
      name: 'Cheap',
      price: 0.5,
      gstPercent: 0,
      prepTimeMinutes: 1,
    });
    const b = await mkItem(cat.id, { name: 'Taxed', gstPercent: 28, prepTimeMinutes: 240 });
    expect(a.price).toBe(0.5);
    expect(b.gstPercent).toBe(28);
  });

  it('rejects an unknown category', async () => {
    const res = await owner()
      .post('/api/admin/items')
      .send({ categoryId: randomUUID(), name: 'X', price: 10, isVeg: true });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });

  it('blocks duplicate names inside a category only', async () => {
    const a = await mkCategory('A', 'G');
    const b = await mkCategory('B', 'G');
    await mkItem(a.id, { name: 'Latte' });
    const dup = await owner()
      .post('/api/admin/items')
      .send({ categoryId: a.id, name: 'LATTE', price: 10, isVeg: true });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ITEM_NAME_TAKEN');
    await mkItem(b.id, { name: 'Latte' });
  });

  it('updates fields and moves between categories', async () => {
    const a = await mkCategory('A', 'G');
    const b = await mkCategory('B', 'G');
    const item = await mkItem(a.id);
    const res = await owner()
      .patch(`/api/admin/items/${item.id}`)
      .send({ price: 175.5, name: 'Big Latte', categoryId: b.id, badge: 'signature' });
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({
      price: 175.5,
      name: 'Big Latte',
      categoryId: b.id,
      badge: 'signature',
    });
    expect((await owner().patch(`/api/admin/items/${item.id}`).send({})).status).toBe(400);
    expect((await owner().patch(`/api/admin/items/${item.id}`).send({ price: 0 })).status).toBe(
      400,
    );
    expect(
      (await owner().patch(`/api/admin/items/${randomUUID()}`).send({ price: 5 })).status,
    ).toBe(404);
    expect((await owner().patch('/api/admin/items/abc').send({ price: 5 })).status).toBe(400);
  });

  it('soft deletes and lets the name be reused', async () => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    expect((await owner().del(`/api/admin/items/${item.id}`)).status).toBe(204);
    expect((await staff().get(`/api/admin/items/${item.id}`)).status).toBe(404);
    expect((await owner().del(`/api/admin/items/${item.id}`)).status).toBe(404);
    const menu = await staff().get('/api/admin/menu');
    expect(menu.body.groups[0].categories[0].items).toHaveLength(0);
    await mkItem(cat.id, { name: 'Latte' });
  });

  it('toggles availability', async () => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    const off = await staff()
      .patch(`/api/admin/items/${item.id}/availability`)
      .send({ isAvailable: false });
    expect(off.body.item.isAvailable).toBe(false);
    const on = await staff()
      .patch(`/api/admin/items/${item.id}/availability`)
      .send({ isAvailable: true });
    expect(on.body.item.isAvailable).toBe(true);
    expect(
      (await staff().patch(`/api/admin/items/${item.id}/availability`).send({ isAvailable: 'yes' }))
        .status,
    ).toBe(400);
  });

  it('reorders items inside a category', async () => {
    const cat = await mkCategory();
    const other = await mkCategory('Other', 'G');
    const a = await mkItem(cat.id, { name: 'A' });
    const b = await mkItem(cat.id, { name: 'B' });
    const foreign = await mkItem(other.id, { name: 'F' });
    const ok = await owner()
      .put(`/api/admin/categories/${cat.id}/items/order`)
      .send({ ids: [b.id, a.id] });
    expect(ok.status).toBe(204);
    const menu = await staff().get('/api/admin/menu');
    const cat1 = menu.body.groups[0].categories.find((c) => c.id === cat.id);
    expect(cat1.items.map((i) => i.name)).toEqual(['B', 'A']);
    const bad = await owner()
      .put(`/api/admin/categories/${cat.id}/items/order`)
      .send({ ids: [a.id, foreign.id] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_ORDER');
  });
});

describe('variants', () => {
  it('creates, updates, toggles and deletes sizes', async () => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    const created = await owner()
      .post(`/api/admin/items/${item.id}/variants`)
      .send({ label: 'Medium', price: 120 });
    expect(created.status).toBe(201);
    const vid = created.body.variant.id;
    expect(created.body.variant).toMatchObject({ label: 'Medium', price: 120, isAvailable: true });

    const dup = await owner()
      .post(`/api/admin/items/${item.id}/variants`)
      .send({ label: 'medium', price: 99 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('VARIANT_LABEL_TAKEN');
    expect(
      (await owner().post(`/api/admin/items/${item.id}/variants`).send({ label: 'Free', price: 0 }))
        .status,
    ).toBe(400);

    const upd = await owner().patch(`/api/admin/variants/${vid}`).send({ price: 130 });
    expect(upd.body.variant.price).toBe(130);
    expect(
      (await staff().patch(`/api/admin/variants/${vid}/availability`).send({ isAvailable: false }))
        .body.variant.isAvailable,
    ).toBe(false);
    expect((await staff().patch(`/api/admin/variants/${vid}`).send({ price: 1 })).status).toBe(403);

    expect((await owner().del(`/api/admin/variants/${vid}`)).status).toBe(204);
    expect((await owner().del(`/api/admin/variants/${vid}`)).status).toBe(404);
  });

  it('refuses sizes for a missing item', async () => {
    const res = await owner()
      .post(`/api/admin/items/${randomUUID()}/variants`)
      .send({ label: 'Small', price: 50 });
    expect(res.status).toBe(404);
  });
});

describe('item images', () => {
  const put = (id, body, type = 'image/jpeg') =>
    owner().put(`/api/admin/items/${id}/image`).set('Content-Type', type).send(body);

  it.each([
    ['jpeg', JPEG, 'image/jpeg'],
    ['png', PNG, 'image/png'],
    ['webp', WEBP, 'image/webp'],
  ])('uploads a %s as the item’s own photo', async (_n, buf, type) => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    const res = await put(item.id, buf, type);
    expect(res.status).toBe(200);
    expect(res.body.item.hasOwnImage).toBe(true);
    expect(res.body.item.imageUrl).toContain(`counterflow/menu/own/${item.id}`);
    expect(res.body.item.imageCredit).toBeNull();
    expect(storage.calls.uploads).toEqual([
      { publicId: `counterflow/menu/own/${item.id}`, bytes: buf.length },
    ]);
  });

  it('rejects files that are not real images, even with an image header', async () => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    const res = await put(item.id, Buffer.from('<script>alert(1)</script>'), 'image/jpeg');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_IMAGE');
    expect(storage.calls.uploads).toHaveLength(0);
  });

  it('rejects an empty body', async () => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    const res = await owner()
      .put(`/api/admin/items/${item.id}/image`)
      .set('Content-Type', 'image/jpeg');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMAGE_REQUIRED');
  });

  it('rejects files over the size limit', async () => {
    setup({ maxImageBytes: 1024 });
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    const big = Buffer.concat([JPEG, Buffer.alloc(2048)]);
    const res = await put(item.id, big);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('IMAGE_TOO_LARGE');
    expect(storage.calls.uploads).toHaveLength(0);
  });

  it('404s for a missing item', async () => {
    expect((await put(randomUUID(), JPEG)).status).toBe(404);
  });

  it('keeps the item unchanged when the upload fails', async () => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    storage.failOnce();
    const res = await put(item.id, JPEG);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPLOAD_FAILED');
    const after = await staff().get(`/api/admin/items/${item.id}`);
    expect(after.body.item.imageUrl).toBeNull();
  });

  it('replaces a stock photo without touching the shared Cloudinary file', async () => {
    const cat = await mkCategory();
    const item = await mkItem(cat.id);
    await store.setItemImage(item.id, {
      url: 'https://res.cloudinary.com/test/image/upload/counterflow/menu/pixabay-1.jpg',
      publicId: null,
      credit: 'Photo by Someone on Pixabay',
    });
    const res = await put(item.id, JPEG);
    expect(res.body.item.hasOwnImage).toBe(true);
    expect(res.body.item.imageCredit).toBeNull();
    expect(storage.calls.destroys).toEqual([]);
  });

  it('removing an own photo deletes it; removing a stock photo does not', async () => {
    const cat = await mkCategory();
    const own = await mkItem(cat.id, { name: 'Own' });
    const stock = await mkItem(cat.id, { name: 'Stock' });
    await put(own.id, JPEG);
    await store.setItemImage(stock.id, {
      url: 'https://res.cloudinary.com/test/image/upload/counterflow/menu/pixabay-2.jpg',
      publicId: null,
      credit: 'Photo by X on Pixabay',
    });

    const r1 = await owner().del(`/api/admin/items/${own.id}/image`);
    expect(r1.status).toBe(200);
    expect(r1.body.item.imageUrl).toBeNull();
    expect(storage.calls.destroys).toEqual([`counterflow/menu/own/${own.id}`]);

    const r2 = await owner().del(`/api/admin/items/${stock.id}/image`);
    expect(r2.body.item.imageUrl).toBeNull();
    expect(r2.body.item.imageCredit).toBeNull();
    expect(storage.calls.destroys).toHaveLength(1);
  });
});
