import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

export const claimsRouter = Router();

const STAFF = ['staff', 'supervisor'];

/** Shown to the student whose claim lost the race for the item. */
export const COMPETING_REASON = 'Another claim for this item was approved after an ID check.';
const MIN_REASON = 5;

async function lockClaim(client, id) {
  const { rows } = await client.query(
    `SELECT c.id, c.item_id, c.user_id, c.status,
            i.ref, i.title AS item_title, i.status AS item_status,
            u.name AS claimant_name, u.email AS claimant_email
     FROM claims c
     JOIN items i ON i.id = c.item_id
     JOIN users u ON u.id = c.user_id
     WHERE c.id = $1
     FOR UPDATE OF c`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'No claim with that id.');
  return rows[0];
}

async function writeAudit(client, actorId, claim, detail) {
  await client.query(
    `INSERT INTO audit_log (actor_id, action, entity, entity_id, detail)
     VALUES ($1, 'claim.reviewed', 'claim', $2, $3)`,
    [actorId, String(claim.id), detail]
  );
}

/* ---------- The student's own claims ---------- */

const STUDENT = ['student'];

// Outcomes a student is told about. Pending and withdrawn are their own doing.
const NEWSWORTHY = ['approved', 'rejected', 'returned'];

// A handed-over claim reads as "returned" to the student; otherwise the stored status.
const MY_CLAIM_SQL = `
  SELECT c.id::int AS id, c.status, c.reason, c.auto_closed, c.seen_status,
         c.description, c.identifying, c.lost_on::text AS lost_on, c.lost_where,
         c.created_at, c.reviewed_at, c.withdrawn_at, h.handed_over_at,
         CASE WHEN h.handed_over_at IS NOT NULL THEN 'returned' ELSE c.status END AS display_status,
         i.ref, i.title, i.description AS item_description, i.category, i.location,
         i.found_on::text AS found_on, i.status AS item_status
  FROM claims c
  JOIN items i ON i.id = c.item_id
  LEFT JOIN handovers h ON h.claim_id = c.id
  WHERE c.user_id = $1`;

/** The student's view of their claim: their own answers, the outcome and the public item. */
function toMyClaim(row) {
  return {
    id: row.id,
    ref: row.ref,
    itemTitle: row.title,
    category: row.category,
    status: row.display_status,
    reason: row.reason,
    autoClosed: row.auto_closed,
    description: row.description,
    identifying: row.identifying,
    lostOn: row.lost_on,
    lostWhere: row.lost_where,
    submittedAt: row.created_at,
    reviewedAt: row.reviewed_at,
    withdrawnAt: row.withdrawn_at,
    handedOverAt: row.handed_over_at,
    unread: NEWSWORTHY.includes(row.display_status) && row.seen_status !== row.display_status,
    item: {
      ref: row.ref,
      title: row.title,
      description: row.item_description,
      category: row.category,
      location: row.location,
      foundOn: row.found_on,
      status: row.item_status,
    },
  };
}

// GET /api/claims/mine — every claim the signed-in student has filed, newest first.
claimsRouter.get('/mine', requireAuth(STUDENT), async (req, res, next) => {
  try {
    const { rows } = await query(`${MY_CLAIM_SQL} ORDER BY c.created_at DESC`, [req.user.id]);
    res.json({ claims: rows.map(toMyClaim) });
  } catch (err) {
    next(err);
  }
});

// GET /api/claims/mine/updates — outcomes the student has not opened yet (the navbar badge).
claimsRouter.get('/mine/updates', requireAuth(STUDENT), async (req, res, next) => {
  try {
    const { rows } = await query(`${MY_CLAIM_SQL} ORDER BY c.created_at DESC`, [req.user.id]);
    const updates = rows
      .map(toMyClaim)
      .filter((c) => c.unread)
      .map((c) => ({
        id: c.id,
        ref: c.ref,
        itemTitle: c.itemTitle,
        status: c.status,
        at: c.handedOverAt ?? c.reviewedAt ?? c.submittedAt,
      }))
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ updates });
  } catch (err) {
    next(err);
  }
});

// POST /api/claims/mine/seen { ids? } — mark outcomes as read; all of them when ids is omitted.
claimsRouter.post('/mine/seen', requireAuth(STUDENT), async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : null;
    const { rowCount } = await query(
      `UPDATE claims c
       SET seen_status = CASE WHEN EXISTS (SELECT 1 FROM handovers h WHERE h.claim_id = c.id)
                              THEN 'returned' ELSE c.status END
       WHERE c.user_id = $1 AND ($2::bigint[] IS NULL OR c.id = ANY($2::bigint[]))`,
      [req.user.id, ids]
    );
    res.json({ marked: rowCount });
  } catch (err) {
    next(err);
  }
});

// GET /api/claims/mine/:id — one of the student's own claims. Another student's id is a 404.
claimsRouter.get('/mine/:id', requireAuth(STUDENT), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'No claim with that id.');
    const { rows } = await query(`${MY_CLAIM_SQL} AND c.id = $2`, [req.user.id, id]);
    if (!rows[0]) throw new HttpError(404, 'No claim with that id.');
    res.json({ claim: toMyClaim(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// POST /api/claims/mine/:id/withdraw — the student cancels a claim that is still pending.
claimsRouter.post('/mine/:id/withdraw', requireAuth(STUDENT), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'No claim with that id.');

    const result = await withTransaction(async (client) => {
      const claim = await lockClaim(client, id);
      if (String(claim.user_id) !== String(req.user.id)) throw new HttpError(404, 'No claim with that id.');
      if (claim.status !== 'pending') {
        throw new HttpError(409, "Only a claim that hasn't been reviewed yet can be withdrawn.");
      }
      const { rows } = await client.query(
        `UPDATE claims SET status = 'withdrawn', withdrawn_at = now()
         WHERE id = $1 RETURNING id::int AS id, status, withdrawn_at`,
        [id]
      );
      await client.query(
        `INSERT INTO audit_log (actor_id, action, entity, entity_id, detail)
         VALUES ($1, 'claim.withdrawn', 'claim', $2, $3)`,
        [req.user.id, String(id), { ref: claim.ref, title: claim.item_title, claimant: claim.claimant_name }]
      );
      return rows[0];
    });

    res.json({ id: result.id, status: result.status, withdrawnAt: result.withdrawn_at });
  } catch (err) {
    next(err);
  }
});

/* ---------- Staff review ---------- */

// PATCH /api/claims/:id — staff approve or reject a claim.
claimsRouter.patch('/:id', requireAuth(STAFF), async (req, res, next) => {
  try {
    const status = String(req.body?.status ?? '');
    if (!['approved', 'rejected'].includes(status)) {
      throw new HttpError(400, "status must be 'approved' or 'rejected'.");
    }

    // A rejection the student cannot understand is worse than no answer, so the reason is required.
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (status === 'rejected' && reason.length < MIN_REASON) {
      throw new HttpError(400, 'Give the student a reason for the rejection — they will see it.');
    }

    const result = await withTransaction(async (client) => {
      const claim = await lockClaim(client, req.params.id);
      if (claim.status !== 'pending') {
        throw new HttpError(409, `This claim was already ${claim.status}.`);
      }
      if (status === 'approved' && claim.item_status !== 'available') {
        throw new HttpError(409, 'This item is already reserved or returned — another claim was approved.');
      }

      const { rows } = await client.query(
        `UPDATE claims
         SET status = $1, reason = $2, reviewed_by = $3, reviewed_at = now()
         WHERE id = $4
         RETURNING id::int AS id, status, item_id, reviewed_at`,
        [status, status === 'rejected' ? reason : null, req.user.id, claim.id]
      );
      const reviewed = rows[0];

      await writeAudit(client, req.user.id, claim, {
        status, ref: claim.ref, title: claim.item_title, claimId: claim.id,
        claimant: claim.claimant_name, claimantEmail: claim.claimant_email,
        ...(status === 'rejected' ? { reason } : {}),
      });

      let closedIds = [];

      if (status === 'approved') {
        // The item is reserved, and every other open claim on it is closed with a reason.
        await client.query(`UPDATE items SET status = 'claimed' WHERE id = $1`, [claim.item_id]);

        const closed = await client.query(
          `UPDATE claims
           SET status = 'rejected', reason = $1, auto_closed = true,
               reviewed_by = $2, reviewed_at = now()
           WHERE item_id = $3 AND id <> $4 AND status = 'pending'
           RETURNING id::int AS id`,
          [COMPETING_REASON, req.user.id, claim.item_id, claim.id]
        );
        closedIds = closed.rows.map((r) => r.id);

        for (const id of closedIds) {
          await writeAudit(client, req.user.id, { ...claim, id }, {
            status: 'rejected', ref: claim.ref, title: claim.item_title, claimId: id,
            claimant: claim.claimant_name, reason: COMPETING_REASON, auto: true,
          });
        }
      }

      return { id: reviewed.id, status: reviewed.status, reviewedAt: reviewed.reviewed_at, closedIds };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/claims/:id/handover — record the handover after an identity check.
claimsRouter.post('/:id/handover', requireAuth(STAFF), async (req, res, next) => {
  try {
    // Handing an item to someone without checking who they are is the failure this guards.
    if (req.body?.identityChecked !== true) {
      throw new HttpError(400, 'A handover needs a recorded identity check (identityChecked: true).');
    }
    const identityNote = typeof req.body?.identityNote === 'string' ? req.body.identityNote.trim() : null;

    const handover = await withTransaction(async (client) => {
      const claim = await lockClaim(client, req.params.id);
      if (claim.status !== 'approved') {
        throw new HttpError(409, 'Only an approved claim can be handed over.');
      }
      if (claim.item_status === 'handed_over') {
        throw new HttpError(409, 'This item was already handed over.');
      }

      const { rows } = await client.query(
        `INSERT INTO handovers (item_id, claim_id, handed_over_by, identity_checked, identity_note)
         VALUES ($1, $2, $3, true, $4)
         RETURNING id::int AS id, handed_over_at`,
        [claim.item_id, claim.id, req.user.id, identityNote]
      );

      await client.query(`UPDATE items SET status = 'handed_over' WHERE id = $1`, [claim.item_id]);

      await client.query(
        `INSERT INTO audit_log (actor_id, action, entity, entity_id, detail)
         VALUES ($1, 'item.handed_over', 'item', $2, $3)`,
        [req.user.id, String(claim.item_id),
         { ref: claim.ref, title: claim.item_title, claimId: claim.id,
           claimant: claim.claimant_name, identityChecked: true, note: identityNote }]
      );

      return rows[0];
    });

    res.status(201).json({
      id: handover.id,
      claimId: Number(req.params.id),
      handedOverAt: handover.handed_over_at,
    });
  } catch (err) {
    if (err.code === '23505') {
      return next(new HttpError(409, 'This item was already handed over.'));
    }
    next(err);
  }
});
