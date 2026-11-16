import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Staff desk reads. These are the only endpoints that return the private note and
 * the private claim answers, so every route here is staff-only.
 */
export const staffRouter = Router();

const STAFF = ['staff', 'supervisor'];
const CLAIM_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'];

// GET /api/staff/items — every record, including returned ones, with claim counts.
staffRouter.get('/items', requireAuth(STAFF), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT i.ref, i.title, i.description, i.category, i.location,
              i.found_on::text AS found_on, i.status, i.private_note,
              GREATEST(0, (CURRENT_DATE - i.found_on))::int AS days_on_rack,
              COUNT(c.id)::int AS claims_count,
              COUNT(c.id) FILTER (WHERE c.status = 'pending')::int AS pending_count
       FROM items i
       LEFT JOIN claims c ON c.item_id = i.id
       GROUP BY i.id
       ORDER BY i.found_on DESC, i.ref DESC`
    );

    res.json({
      items: rows.map((row) => ({
        ref: row.ref,
        title: row.title,
        description: row.description,
        category: row.category,
        location: row.location,
        foundOn: row.found_on,
        status: row.status,
        privateNote: row.private_note,
        daysOnRack: row.days_on_rack,
        claimsCount: row.claims_count,
        pendingCount: row.pending_count,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/staff/claims?status= — the review queue, with the private answers and item detail.
staffRouter.get('/claims', requireAuth(STAFF), async (req, res, next) => {
  try {
    const status = String(req.query.status ?? '').trim();
    if (status && !CLAIM_STATUSES.includes(status)) {
      throw new HttpError(400, `status must be one of: ${CLAIM_STATUSES.join(', ')}.`);
    }

    const { rows } = await query(
      `SELECT c.id::int AS id, c.status, c.reason, c.auto_closed,
              c.created_at, c.reviewed_at, c.withdrawn_at,
              c.description, c.identifying, c.lost_on::text AS lost_on, c.lost_where,
              u.name AS claimant_name, u.email AS claimant_email, u.student_id AS claimant_student_id,
              i.ref, i.title AS item_title, i.category, i.location,
              i.found_on::text AS item_found_on, i.status AS item_status, i.private_note,
              h.handed_over_at,
              (SELECT COUNT(*)::int FROM claims o
                WHERE o.item_id = c.item_id AND o.id <> c.id AND o.status = 'pending') AS other_pending
       FROM claims c
       JOIN users u ON u.id = c.user_id
       JOIN items i ON i.id = c.item_id
       LEFT JOIN handovers h ON h.claim_id = c.id
       WHERE ($1::text IS NULL OR c.status = $1)
       ORDER BY c.created_at DESC`,
      [status || null]
    );

    res.json({
      claims: rows.map((row) => ({
        id: row.id,
        status: row.status,
        submittedAt: row.created_at,
        reviewedAt: row.reviewed_at,
        handedOverAt: row.handed_over_at,
        withdrawnAt: row.withdrawn_at,
        reason: row.reason,
        autoClosed: row.auto_closed,
        otherPending: row.other_pending,
        claimant: {
          name: row.claimant_name,
          email: row.claimant_email,
          studentId: row.claimant_student_id,
        },
        answers: {
          description: row.description,
          identifying: row.identifying,
          lostOn: row.lost_on,
          lostWhere: row.lost_where,
        },
        item: {
          ref: row.ref,
          title: row.item_title,
          category: row.category,
          location: row.location,
          foundOn: row.item_found_on,
          status: row.item_status,
          privateNote: row.private_note,
        },
      })),
    });
  } catch (err) {
    next(err);
  }
});
