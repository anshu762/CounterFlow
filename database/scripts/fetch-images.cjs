/* global process, console, __dirname, fetch, setTimeout, clearTimeout, Buffer, URL */
'use strict';
// Fills menu_items.image_url with food photos from Pexels (free API key: https://www.pexels.com/api/).
// Only touches items that have NO image yet, so your own uploads are never replaced.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const categories = require('../seeds/menu-data.cjs');

const KEY = process.env.PEXELS_API_KEY;
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
const CACHE_FILE = path.join(__dirname, '..', 'seeds', 'image-cache.json');

if (!KEY || !url) {
  console.error(
    'Set PEXELS_API_KEY (get one free at pexels.com/api) in backend/.env, plus DATABASE_URL_DIRECT.',
  );
  process.exit(1);
}

// More specific words win over the category's default search.
const RULES = [
  [/pizza/i, 'pizza'],
  [/burger/i, 'burger'],
  [/wrap|burrito|shawarma/i, 'chicken wrap'],
  [/kathi/i, 'kathi roll'],
  [/sandwich|panini|club/i, 'grilled sandwich'],
  [/dim sum|dumpling|shumai/i, 'dim sum dumplings'],
  [/risotto/i, 'risotto'],
  [
    /pasta|spaghetti|ravioli|tortellini|arrabiata|alfredo|rigatoni|lasagne|canelloni|fettuccine/i,
    'pasta',
  ],
  [/nachos/i, 'nachos'],
  [/quesadilla/i, 'quesadilla'],
  [/enchilada/i, 'enchiladas'],
  [/biryani/i, 'biryani'],
  [/naan|roti|parantha/i, 'naan bread'],
  [/^dal /i, 'dal tadka'],
  [/soup/i, 'soup bowl'],
  [/salad/i, 'salad bowl'],
  [/noodle|chopsuey/i, 'noodles'],
  [/fried rice|steam rice|jeera rice|steamed rice/i, 'fried rice'],
  [/waffle/i, 'waffle'],
  [/brownie|sundae|avalanche|choco fudge/i, 'chocolate brownie sundae'],
  [/shake/i, 'milkshake'],
  [/frappe/i, 'frappe coffee'],
  [/mojito/i, 'mojito'],
  [/lemonade/i, 'lemonade'],
  [/kebab|seekh/i, 'kebab'],
  [/prawn/i, 'prawns'],
  [/fish/i, 'fish dish'],
  [/wings/i, 'chicken wings'],
  [/fries|potato/i, 'french fries'],
  [/garlic bread/i, 'garlic bread'],
  [/curry/i, 'thai curry'],
  [/manchurian/i, 'manchurian'],
  [/sizzler/i, 'sizzler'],
  [/steak/i, 'steak'],
  [/bowl/i, 'rice bowl'],
  [/paneer/i, 'paneer dish'],
  [/mushroom/i, 'mushroom dish'],
  [/mutton|keema|rogan|ghosht/i, 'mutton curry'],
];

const catQuery = new Map(categories.map((c) => [c.name.toLowerCase(), c.img]));
const queryFor = (item, category) => {
  for (const [re, q] of RULES) if (re.test(item)) return q;
  return catQuery.get(category.toLowerCase()) || 'restaurant food';
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100000, 7);

async function search(query) {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`,
    { headers: { Authorization: KEY } },
  );
  if (res.status === 429) return { rateLimited: true };
  if (res.status === 401) throw new Error('Pexels rejected the API key (401).');
  if (!res.ok) throw new Error(`Pexels error ${res.status}`);
  const data = await res.json();
  return {
    photos: (data.photos || []).map((p) => ({
      url: p.src.large,
      credit: `Photo by ${p.photographer} on Pexels`,
    })),
  };
}

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select i.item_id, i.name, c.name as category
         from menu_items i join menu_categories c using (category_id)
        where i.image_url is null and i.deleted_at is null`,
    );
    console.log(`${rows.length} items without an image.`);
    if (!rows.length) return;

    const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
    const queries = [...new Set(rows.map((r) => queryFor(r.name, r.category)))];
    const missing = queries.filter((q) => !cache[q]);
    console.log(`${queries.length} distinct searches, ${missing.length} not cached yet.`);

    for (const q of missing) {
      const r = await search(q);
      if (r.rateLimited) {
        console.log(
          'Pexels rate limit reached. Run this command again in an hour; progress is saved.',
        );
        break;
      }
      cache[q] = r.photos;
      console.log(`  "${q}": ${r.photos.length} photos`);
      await sleep(300);
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));

    const ids = [];
    const urls = [];
    const credits = [];
    for (const r of rows) {
      let photos = cache[queryFor(r.name, r.category)];
      if (!photos || !photos.length) photos = cache[catQuery.get(r.category.toLowerCase())] || [];
      if (!photos.length) continue;
      const p = photos[hash(r.name) % photos.length];
      ids.push(r.item_id);
      urls.push(p.url);
      credits.push(p.credit);
    }

    for (let i = 0; i < ids.length; i += 200) {
      await client.query(
        `update menu_items m set image_url = x.url, image_credit = x.credit
           from unnest($1::uuid[], $2::text[], $3::text[]) as x(id, url, credit)
          where m.item_id = x.id and m.image_url is null`,
        [ids.slice(i, i + 200), urls.slice(i, i + 200), credits.slice(i, i + 200)],
      );
    }
    console.log(
      `\nSet images on ${ids.length} items. ${rows.length - ids.length} still without (run again later if rate-limited).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Image fetch failed:', e.message);
  process.exit(1);
});
