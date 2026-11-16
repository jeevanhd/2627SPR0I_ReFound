// Items + claims service (student side) — FRONTEND MOCK.
// Swap each function body for a fetch() call when the public API exists.

import { CATEGORY_COLORS, ITEMS } from "../data/items.js";
import { KEYS, appendAudit, notifyClaimsChanged, read, wait, write } from "./mockDb.js";

export const CATEGORIES = Object.keys(CATEGORY_COLORS).sort();

export const colorFor = (category) => CATEGORY_COLORS[category] ?? "marker";

export function formatDate(iso) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Every item, INCLUDING the staff-only privateNote. Only the staff service may
 * use this directly — student-facing functions must go through toPublicItem().
 */
export function loadAllItems() {
  const overrides = read(KEYS.itemStatus, {});
  return [...read(KEYS.items, []), ...ITEMS].map((item) => ({
    ...item,
    status: overrides[item.ref] ?? item.status ?? "available",
  }));
}

/** Mirrors toPublicItem() in backend/src/lib/items.js — privateNote is never included. */
export function toPublicItem(item) {
  return {
    ref: item.ref,
    title: item.title,
    description: item.description,
    category: item.category,
    location: item.location,
    foundOn: item.foundOn,
    status: item.status,
  };
}

export function listLocations() {
  return [...new Set(loadAllItems().map((i) => i.location))].sort();
}

/** Public search. Every keyword must match somewhere in the item's public fields. */
export async function searchItems({ q = "", category = "", location = "" } = {}) {
  // TODO(backend): GET /api/items?q=&category=&location=
  await wait(250);
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return loadAllItems()
    .filter((item) => item.status !== "handed_over")
    .filter((item) => {
      if (category && item.category !== category) return false;
      if (location && item.location !== location) return false;
      const haystack = `${item.ref} ${item.title} ${item.description} ${item.category} ${item.location}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    })
    .sort((a, b) => b.foundOn.localeCompare(a.foundOn))
    .map(toPublicItem);
}

export async function getItem(ref) {
  // TODO(backend): GET /api/items/:ref
  await wait(200);
  const item = loadAllItems().find((i) => i.ref.toLowerCase() === String(ref).toLowerCase());
  if (!item) throw new Error("not-found");
  return toPublicItem(item);
}

const displayStatus = (claim) => (claim.handedOverAt ? "returned" : claim.status);

/** The student's active claim on an item. A withdrawn claim doesn't count, so they can claim again. */
export function findMyClaim(email, ref) {
  const claim = read(KEYS.claims, []).find((c) => c.email === email && c.ref === ref && c.status !== "withdrawn");
  return claim ? { ...claim, status: displayStatus(claim) } : null;
}

export async function getMyClaims(email) {
  // TODO(backend): GET /api/claims/mine
  await wait(200);
  return read(KEYS.claims, [])
    .filter((c) => c.email === email)
    .map((c) => ({ ...c, status: displayStatus(c) }))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** One of the signed-in student's own claims (their answers are theirs to see). */
export async function getMyClaim(email, id) {
  // TODO(backend): GET /api/claims/mine/:id
  await wait(200);
  const claim = read(KEYS.claims, []).find((c) => c.id === id && c.email === email);
  if (!claim) throw new Error("not-found");
  const item = loadAllItems().find((i) => i.ref === claim.ref);
  return { ...claim, status: displayStatus(claim), item: item ? toPublicItem(item) : null };
}

/** Newest items still on the rack, for the student home page. */
export async function latestItems(count = 4) {
  return (await searchItems()).slice(0, count);
}

/** Submit a private ownership claim. Only staff will ever see the answers. */
export async function submitClaim({ item, user, description, identifying, lostOn, lostWhere }) {
  // TODO(backend): POST /api/items/:ref/claims (server checks the user is a signed-in student)
  await wait(600);
  if (!description.trim() || !identifying.trim()) throw new Error("Fill in both description fields.");
  if (findMyClaim(user.email, item.ref)) throw new Error("You've already claimed this item.");
  if (item.status !== "available") throw new Error("This item is no longer open for claims.");

  const claim = {
    id: `CL-${Date.now().toString().slice(-6)}`,
    ref: item.ref,
    itemTitle: item.title,
    category: item.category,
    email: user.email,
    claimantName: user.name,
    claimantStudentId: user.studentId ?? null,
    status: "pending",
    lostOn: lostOn || null,
    lostWhere: lostWhere.trim() || null,
    // Private answers — in the real app these live server-side, staff-only.
    description: description.trim(),
    identifying: identifying.trim(),
    submittedAt: new Date().toISOString(),
  };
  write(KEYS.claims, [...read(KEYS.claims, []), claim]);
  // The log records THAT a claim was filed — never the private answers.
  appendAudit({
    actor: user,
    action: "claim.submitted",
    entity: "claim",
    entityId: claim.id,
    detail: { ref: item.ref, title: item.title },
  });
  return claim;
}

/** Withdraw one of your own claims while it is still waiting for review. */
export async function withdrawClaim(user, id) {
  // TODO(backend): DELETE /api/claims/mine/:id (or PATCH status=withdrawn)
  await wait(400);
  const claims = read(KEYS.claims, []);
  const claim = claims.find((c) => c.id === id && c.email === user.email);
  if (!claim) throw new Error("No claim with that id.");
  if (claim.status !== "pending") throw new Error("Only a claim that hasn't been reviewed yet can be withdrawn.");
  const withdrawnAt = new Date().toISOString();
  write(KEYS.claims, claims.map((c) => (c.id === id ? { ...c, status: "withdrawn", withdrawnAt } : c)));
  appendAudit({
    actor: user,
    action: "claim.withdrawn",
    entity: "claim",
    entityId: id,
    detail: { ref: claim.ref, title: claim.itemTitle, claimant: claim.claimantName ?? claim.email },
  });
  notifyClaimsChanged();
  return { id, status: "withdrawn", withdrawnAt };
}

/* ---------- Claim updates (in-app notifications) ---------- */

// Outcomes a student should be told about. Pending and withdrawn are their own doing.
const NEWSWORTHY = ["approved", "rejected", "returned"];

const UPDATE_TEXT = {
  approved: "Approved — bring your student ID to the help desk.",
  rejected: "Not approved. Open the claim to see why.",
  returned: "Handed back to you. Case closed.",
};

/** Claim outcomes this student hasn't seen yet, newest first. */
export function getClaimUpdates(email) {
  // TODO(backend): GET /api/claims/mine?unseen=1 (or a notifications endpoint)
  if (!email) return [];
  const seen = read(KEYS.seen, {})[email] ?? {};
  return read(KEYS.claims, [])
    .filter((c) => c.email === email)
    .map((c) => ({ ...c, status: displayStatus(c) }))
    .filter((c) => NEWSWORTHY.includes(c.status) && seen[c.id] !== c.status)
    .map((c) => ({
      id: c.id,
      ref: c.ref,
      itemTitle: c.itemTitle,
      status: c.status,
      text: UPDATE_TEXT[c.status],
      at: c.handedOverAt ?? c.reviewedAt ?? c.submittedAt,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Mark updates as seen — all of them, or only the claim ids given. */
export function markClaimsSeen(email, ids = null) {
  if (!email) return;
  const all = read(KEYS.seen, {});
  const mine = { ...(all[email] ?? {}) };
  read(KEYS.claims, [])
    .filter((c) => c.email === email && (!ids || ids.includes(c.id)))
    .forEach((c) => {
      mine[c.id] = displayStatus(c);
    });
  write(KEYS.seen, { ...all, [email]: mine });
  notifyClaimsChanged();
}
