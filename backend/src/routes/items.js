import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { formatRef } from '../lib/ref.js';
import { parseItemInput, toPublicItem } from '../lib/items.js';
import { requireAuth } from '../middleware/auth.js';

export const itemsRouter = Router();

const STAFF = ['staff', 'supervisor'];

const ITEM_COLUMNS = `id, ref, title, description, category, location,
                      found_on::text AS found_on, status`;

const STUDENT = ['student'];
const MAX_TEXT = 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Escape LIKE wildcards so a search for "100%" matches the text, not everything. */
const likeTerm = (term) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// GET /api/items?q=&category=&location= — the public register. Anyone may read it.
// Returned items are not listed: once an item is back with its owner it leaves the rack.
itemsRouter.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim().slice(0, 200);
    const category = String(req.query.category ?? '').trim();
    const location = String(req.query.location ?? '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 200);

    // Every keyword must match somewhere in the public fields (AND, not OR).
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 10);
    const params = [];
    const where = [`status <> 'handed_over'`];
    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }
    if (location) {
      params.push(location);
      where.push(`location = $${params.length}`);
    }
    for (const term of terms) {
      params.push(likeTerm(term));
      where.push(`concat_ws(' ', ref, title, description, category, location) ILIKE $${params.length}`);
    }
    params.push(limit);

    const { rows } = await query(
      `SELECT ${ITEM_COLUMNS} FROM items
       WHERE ${where.join(' AND ')}
       ORDER BY found_on DESC, ref DESC
       LIMIT $${params.length}`,
      params
    );
    res.json({ items: rows.map(toPublicItem) });
  } catch (err) {
    next(err);
  }
});

// GET /api/items/locations — distinct places items were found, for the search filter.
itemsRouter.get('/locations', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT location FROM items WHERE status <> 'handed_over' ORDER BY location`
    );
    res.json({ locations: rows.map((r) => r.location) });
  } catch (err) {
    next(err);
  }
});

// GET /api/items/:ref — one public record. Returned items stay readable so old links work.
itemsRouter.get('/:ref', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT ${ITEM_COLUMNS} FROM items WHERE upper(ref) = upper($1)`, [req.params.ref]);
    if (!rows[0]) throw new HttpError(404, `No item with reference ${req.params.ref}.`);
    res.json({ item: toPublicItem(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// POST /api/items/:ref/claims — a signed-in student says "this is mine".
// The answers are private: they are stored for staff and never written to the audit log.
itemsRouter.post('/:ref/claims', requireAuth(STUDENT), async (req, res, next) => {
  try {
    const text = (v) => (typeof v === 'string' ? v.trim() : '');
    const description = text(req.body?.description);
    const identifying = text(req.body?.identifying);
    const lostOn = text(req.body?.lostOn);
    const lostWhere = text(req.body?.lostWhere);

    if (!description || !identifying) {
      throw new HttpError(400, 'Describe the item and give one detail only the owner would know.');
    }
    if ([description, identifying, lostWhere].some((v) => v.length > MAX_TEXT)) {
      throw new HttpError(400, `Keep each answer under ${MAX_TEXT} characters.`);
    }
    if (lostOn && (!DATE_ONLY.test(lostOn) || Number.isNaN(Date.parse(lostOn)))) {
      throw new HttpError(400, 'lostOn must be a date in YYYY-MM-DD form.');
    }

    const claim = await withTransaction(async (client) => {
      const { rows: items } = await client.query(
        `SELECT id, ref, title, status FROM items WHERE upper(ref) = upper($1) FOR UPDATE`,
        [req.params.ref]
      );
      const item = items[0];
      if (!item) throw new HttpError(404, `No item with reference ${req.params.ref}.`);
      if (item.status !== 'available') throw new HttpError(409, 'This item is no longer open for claims.');

      // One claim per student per item. A withdrawn claim may be re-filed: the same row is reused.
      const { rows } = await client.query(
        `INSERT INTO claims (item_id, user_id, description, identifying, lost_on, lost_where)
         VALUES ($1, $2, $3, $4, $5::date, $6)
         ON CONFLICT (item_id, user_id) DO UPDATE
           SET description = EXCLUDED.description, identifying = EXCLUDED.identifying,
               lost_on = EXCLUDED.lost_on, lost_where = EXCLUDED.lost_where,
               status = 'pending', withdrawn_at = NULL, reason = NULL, auto_closed = false,
               reviewed_by = NULL, reviewed_at = NULL, seen_status = NULL, created_at = now()
           WHERE claims.status = 'withdrawn'
         RETURNING id::int AS id, status, created_at`,
        [item.id, req.user.id, description, identifying, lostOn || null, lostWhere || null]
      );
      if (!rows[0]) throw new HttpError(409, "You've already claimed this item.");

      await client.query(
        `INSERT INTO audit_log (actor_id, action, entity, entity_id, detail)
         VALUES ($1, 'claim.submitted', 'claim', $2, $3)`,
        [req.user.id, String(rows[0].id), { ref: item.ref, title: item.title, claimant: req.user.name }]
      );
      return { ...rows[0], ref: item.ref, title: item.title };
    });

    res.status(201).json({
      claim: { id: claim.id, ref: claim.ref, itemTitle: claim.title, status: claim.status, submittedAt: claim.created_at },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/items — a volunteer registers a found item.
itemsRouter.post('/', requireAuth(STAFF), async (req, res, next) => {
  try {
    const input = parseItemInput(req.body, { HttpError });

    const item = await withTransaction(async (client) => {
      const { rows: seq } = await client.query(`SELECT nextval('item_ref_seq') AS n`);
      const ref = formatRef(Number(seq[0].n));

      const { rows } = await client.query(
        `INSERT INTO items (ref, title, description, category, location, found_on, private_note, registered_by)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8)
         RETURNING ${ITEM_COLUMNS}`,
        [ref, input.title, input.description, input.category, input.location,
         input.foundOn, input.privateNote, req.user.id]
      );

      await client.query(
        `INSERT INTO audit_log (actor_id, action, entity, entity_id, detail)
         VALUES ($1, 'item.registered', 'item', $2, $3)`,
        [req.user.id, String(rows[0].id),
         { ref, title: input.title, category: input.category, location: input.location }]
      );

      return rows[0];
    });

    // The private note is deliberately absent from this response.
    res.status(201).json({ item: toPublicItem(item) });
  } catch (err) {
    next(err);
  }
});

// GET /api/items/:ref/claims — staff-only: the private answers, for ownership checks.
itemsRouter.get('/:ref/claims', requireAuth(STAFF), async (req, res, next) => {
  try {
    const { rows: items } = await query('SELECT id, ref, title, status FROM items WHERE ref = $1', [req.params.ref]);
    const item = items[0];
    if (!item) throw new HttpError(404, `No item with reference ${req.params.ref}.`);

    const { rows: claims } = await query(
      `SELECT c.id::int AS id, c.status, c.reason, c.auto_closed, c.reviewed_at, c.withdrawn_at,
              c.description, c.identifying,
              c.lost_on::text AS lost_on, c.lost_where,
              c.created_at, u.name AS claimant_name, u.email AS claimant_email,
              u.student_id AS claimant_student_id, h.handed_over_at
       FROM claims c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN handovers h ON h.claim_id = c.id
       WHERE c.item_id = $1
       ORDER BY c.created_at DESC`,
      [item.id]
    );

    res.json({
      item: { ref: item.ref, title: item.title, status: item.status },
      claims: claims.map((c) => ({
        id: c.id,
        status: c.status,
        reason: c.reason,
        autoClosed: c.auto_closed,
        reviewedAt: c.reviewed_at,
        withdrawnAt: c.withdrawn_at,
        handedOverAt: c.handed_over_at,
        claimant: { name: c.claimant_name, email: c.claimant_email, studentId: c.claimant_student_id },
        answers: { description: c.description, identifying: c.identifying, lostOn: c.lost_on, lostWhere: c.lost_where },
        submittedAt: c.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});
