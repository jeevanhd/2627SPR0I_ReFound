import { Router } from 'express';
import { withTransaction } from '../db.js';
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
