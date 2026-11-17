// Load the sample found-item records the frontend ships with, so the API and the
// UI show the same rack. Safe to run more than once: existing refs are left alone.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';
import { assertConfig } from '../src/config.js';

assertConfig();

const path = fileURLToPath(new URL('../db/sample-items.json', import.meta.url));
const items = JSON.parse(await readFile(path, 'utf8'));

try {
  const { rows: staff } = await pool.query(
    `SELECT id, email FROM users WHERE role IN ('staff', 'supervisor') ORDER BY id LIMIT 1`
  );
  if (!staff[0]) {
    console.error('No staff account yet. Run `npm run seed:staff` first, then this.');
    process.exit(1);
  }

  let inserted = 0;
  for (const item of items) {
    const { rowCount } = await pool.query(
      `INSERT INTO items (ref, title, description, category, location, found_on, private_note, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (ref) DO NOTHING`,
      [item.ref, item.title, item.description, item.category, item.location,
       item.foundOn, item.privateNote ?? null, staff[0].id]
    );
    inserted += rowCount;
  }

  // Never hand out a reference code that is already on the rack.
  const { rows } = await pool.query(
    `SELECT (SELECT COALESCE(MAX(NULLIF(regexp_replace(ref, '\\D', '', 'g'), '')::int), 0) FROM items) AS max_ref,
            (SELECT last_value FROM item_ref_seq) AS seq_last`
  );
  const next = Number(rows[0].max_ref) + 1;
  if (next > Number(rows[0].seq_last)) {
    await pool.query('SELECT setval($1, $2, false)', ['item_ref_seq', next]);
  }

  const added = `${inserted} added`;
  const skipped = `${items.length - inserted} already present`;
  console.log(`Sample items: ${added}, ${skipped}. Next reference: RF-${String(next).padStart(4, '0')}.`);
} catch (err) {
  console.error('Seeding items failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
