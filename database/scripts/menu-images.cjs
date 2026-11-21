'use strict';
/*
  Fill menu item images.
  Usage (from repo root):
    npm run db:menu:images:pixabay -- --list            show items missing images + expected file names
    npm run db:menu:images:pixabay -- --dry --limit 10  preview matches, change nothing
    npm run db:menu:images:pixabay -- --limit 3         do 3 items for real (test first)
    npm run db:menu:images:pixabay                      do all remaining items

  Only items with image_url IS NULL are touched, so it is safe to re-run.
  Order per item:
    1) your own photo: database/seeds/images/<slug>.(jpg|jpeg|png|webp)
    2) Pixabay stock photo (needs PIXABAY_API_KEY)
  Photos are copied to Cloudinary (needs CLOUDINARY_URL); the Cloudinary URL is saved.
*/
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const KEY = process.env.PIXABAY_API_KEY;
const DRY = process.argv.includes('--dry');
const LIST = process.argv.includes('--list');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx > -1 ? Number(process.argv[limitIdx + 1]) : Infinity;
const MAX_IN_A_ROW = 5;

const IMAGES_DIR = path.join(__dirname, '..', 'seeds', 'images');
// const CACHE_FILE = path.join(__dirname, '..', 'seeds', 'image-cache-pixabay.json');

// Fix a bad match here: exact item name -> better search words.
// Example: 'Sham Savera': 'spinach paneer kofta curry',
const QUERY_OVERRIDES = {};

if (!(LIMIT >= 1)) {
  console.error('--limit must be a number of at least 1');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slugify = (s) =>
  plain(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const clean = (s) =>
  plain(s)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// In memory only, per run: Pixabay photo links expire after about 24 hours.
const cache = {};

function findLocal(slug) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const p = path.join(IMAGES_DIR, `${slug}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function search(q) {
  if (cache[q]) return cache[q];
  const url = new URL('https://pixabay.com/api/');
  url.search = new URLSearchParams({
    key: KEY,
    q: q.slice(0, 100),
    image_type: 'photo',
    category: 'food',
    safesearch: 'true',
    orientation: 'horizontal',
    order: 'popular',
    per_page: '20',
  }).toString();
  await sleep(800); // stays well under Pixabay's 100 requests/minute
  const res = await fetch(url);
  if (res.status === 429) {
    const e = new Error('Pixabay rate limit reached');
    e.rateLimited = true;
    throw e;
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    const e = new Error(`Pixabay rejected the request (${res.status}); check PIXABAY_API_KEY`);
    e.fatal = true;
    throw e;
  }
  if (!res.ok) throw new Error(`Pixabay error ${res.status}`);
  const data = await res.json();
  const hits = (data.hits || []).slice(0, 12).map((h) => ({
    id: h.id,
    user: h.user,
    page: h.pageURL,
    url: h.largeImageURL,
    web: h.webformatURL,
  }));
  cache[q] = hits;
  // saveCache();
  return hits;
}

// Download the photo ourselves (Pixabay asks you to host images, not hotlink).
async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'CounterFlow-menu-seeder/1.0' } });
  if (!res.ok) throw new Error(`photo download failed (${res.status}) ${url}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/'))
    throw new Error(`download was not an image (${type || 'unknown'})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${buf.toString('base64')}`;
}

// Validates CLOUDINARY_URL and proves the credentials work BEFORE touching any item.
async function setupCloudinary() {
  const raw = (process.env.CLOUDINARY_URL || '').trim();
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(raw);
  if (!m) {
    console.error(
      'CLOUDINARY_URL in backend/.env is missing or malformed.\n' +
        'It must look like: cloudinary://API_KEY:API_SECRET@CLOUD_NAME (no quotes, no spaces).',
    );
    process.exit(1);
  }
  const [, apiKey, apiSecret, cloudName] = m;
  if (!/^\d{8,20}$/.test(apiKey) || apiSecret === 'secret' || cloudName === 'cloud_name') {
    console.error(
      'CLOUDINARY_URL still contains placeholder text (for example "key:secret@cloud_name").\n' +
        'Copy the real value from Cloudinary -> Settings -> API Keys into backend/.env.',
    );
    process.exit(1);
  }
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  try {
    await cloudinary.api.ping();
  } catch (e) {
    const msg = (e && (e.message || (e.error && e.error.message))) || String(e);
    console.error(`Cloudinary rejected the credentials: ${msg}`);
    console.error('Check the API key, secret and cloud name in backend/.env.');
    process.exit(1);
  }
  console.log(`Cloudinary OK (cloud "${cloudName}", key ${apiKey.slice(0, 4)}...).`);
  return cloudinary;
}

const isAuthError = (e) =>
  e &&
  (e.http_code === 401 ||
    e.http_code === 403 ||
    /unknown api key|invalid signature|invalid api|must supply api_key|unauthorized/i.test(
      String(e.message || (e.error && e.error.message) || ''),
    ));

const queriesFor = (row) =>
  [
    ...new Set([
      QUERY_OVERRIDES[row.name],
      clean(row.name),
      clean(row.category),
      clean(row.group_name),
    ]),
  ].filter(Boolean);

async function main() {
  if (!LIST && !KEY) {
    console.log(
      'PIXABAY_API_KEY not set: only your own photos in database/seeds/images/ will be used.',
    );
  }

  const db = new Client({
    connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
  });
  await db.connect();
  try {
    const { rows } = await db.query(`
      select i.item_id, i.name, c.name as category, c.group_name
      from menu_items i
      join menu_categories c on c.category_id = i.category_id
      where i.deleted_at is null and i.image_url is null
      order by c.sort_order, i.sort_order, i.name`);

    if (LIST) {
      console.log(`${rows.length} items have no image. Expected file name for your own photo:`);
      for (const r of rows) console.log(`${slugify(r.name)}.jpg   <- ${r.name} (${r.category})`);
      return;
    }

    const cloudinary = DRY ? null : await setupCloudinary();
    const options = (publicId) => ({
      public_id: publicId,
      overwrite: false,
      resource_type: 'image',
      transformation: { width: 1000, crop: 'limit', quality: 'auto' },
    });
    const save = (id, url, publicId, credit) =>
      db.query(
        `update menu_items set image_url = $2, image_public_id = $3, image_credit = $4
         where item_id = $1 and image_url is null`,
        [id, url, publicId, credit],
      );

    let tried = 0;
    let own = 0;
    let stock = 0;
    let noMatch = 0;
    let failed = 0;
    let inARow = 0;
    let stoppedEarly = false;

    for (const row of rows) {
      if (tried >= LIMIT) break;
      tried++;
      if (!DRY && tried % 25 === 0) console.log(`...${tried} of ${rows.length} checked`);
      const slug = slugify(row.name);
      try {
        const local = findLocal(slug);
        if (local) {
          if (DRY) {
            console.log(`[dry] ${row.name}: would upload your photo ${path.basename(local)}`);
          } else {
            const publicId = `counterflow/menu/${slugify(row.category)}/${slug}`;
            const r = await cloudinary.uploader.upload(local, options(publicId));
            await save(row.item_id, r.secure_url, r.public_id, null);
          }
          own++;
          inARow = 0;
          continue;
        }
        if (!KEY) {
          noMatch++;
          continue;
        }

        let pick = null;
        for (const q of queriesFor(row)) {
          const hits = await search(q);
          if (hits.length) {
            pick = { hit: hits[hash(row.name) % hits.length], q };
            break;
          }
        }
        if (!pick) {
          noMatch++;
          console.log(`No photo found for: ${row.name}`);
          continue;
        }
        const { hit, q } = pick;
        if (DRY) {
          console.log(
            `[dry] ${row.name} -> search "${q}" -> photo ${hit.id} by ${hit.user} (${hit.page})`,
          );
          stock++;
          continue;
        }

        let result = null;
        let lastErr = null;
        for (const src of [hit.url, hit.web]) {
          try {
            const data = await download(src);
            // The same stock photo can be used by several items, so it has one shared Cloudinary id.
            result = await cloudinary.uploader.upload(
              data,
              options(`counterflow/menu/pixabay-${hit.id}`),
            );
            break;
          } catch (e) {
            if (isAuthError(e)) throw e;
            lastErr = e;
          }
        }
        if (!result) throw lastErr || new Error('upload failed');
        // image_public_id stays NULL for shared stock photos, so replacing one item's image
        // later can never delete a photo that other items still use.
        await save(row.item_id, result.secure_url, null, `Photo by ${hit.user} on Pixabay`);
        stock++;
        inARow = 0;
      } catch (e) {
        if (e.rateLimited) {
          console.log(
            'Pixabay rate limit reached. Wait a few minutes and run again; progress is kept.',
          );
          stoppedEarly = true;
          break;
        }
        const msg = e.message || (e.error && e.error.message) || String(e);
        if (e.fatal || isAuthError(e)) {
          console.log(`STOPPED: ${msg}`);
          stoppedEarly = true;
          break;
        }
        failed++;
        inARow++;
        console.log(`FAILED ${row.name}: ${msg}`);
        if (inARow >= MAX_IN_A_ROW) {
          console.log(
            `STOPPED: ${MAX_IN_A_ROW} failures in a row. Fix the cause above, then run again.`,
          );
          stoppedEarly = true;
          break;
        }
      }
    }

    const verb = DRY ? 'Would set' : 'Set';
    console.log(
      `${verb} images on ${own + stock} items (${own} own photos, ${stock} Pixabay). No match: ${noMatch}. Failed: ${failed}. Checked: ${tried} of ${rows.length}.`,
    );
    if (stoppedEarly) process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
