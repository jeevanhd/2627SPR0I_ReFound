// Staff desk service — FRONTEND MOCK of Jeevan's staff API (backend/src/routes).
// Each function names the endpoint it stands in for; request and response
// shapes follow the backend so swapping in fetch() is a small change.

import { KEYS, appendAudit, notifyClaimsChanged, read, todayISO, wait, write } from "./mockDb.js";
import { loadAllItems, toPublicItem } from "./itemsService.js";
import { loadSession } from "../auth/authService.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const formatRef = (n) => `RF-${String(n).padStart(4, "0")}`;

function setItemStatus(ref, status) {
  const registered = read(KEYS.items, []);
  if (registered.some((i) => i.ref === ref)) {
    write(KEYS.items, registered.map((i) => (i.ref === ref ? { ...i, status } : i)));
  } else {
    write(KEYS.itemStatus, { ...read(KEYS.itemStatus, {}), [ref]: status });
  }
}

function findUser(email) {
  return read(KEYS.users, []).find((u) => u.email === email) ?? null;
}

/** Same rules as parseItemInput() in backend/src/lib/items.js. */
export function validateItemInput(input) {
  const errors = {
    title: input.title.trim() ? "" : "Give the item a short name.",
    category: input.category ? "" : "Pick a category.",
    location: input.location.trim() ? "" : "Where was it found?",
    description: input.description.trim() ? "" : "Add a public description.",
    foundOn: "",
  };
  if (input.foundOn && !DATE_ONLY.test(input.foundOn)) errors.foundOn = "Use a valid date.";
  else if (input.foundOn && input.foundOn > todayISO()) errors.foundOn = "That date is in the future.";
  return errors;
}

/** POST /api/items — register a found item and allocate its reference code. */
export async function registerItem(input) {
  await wait(500);
  const seq = read(KEYS.refSeq, 149); // backend sequence also starts at 149
  const item = {
    ref: formatRef(seq),
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    location: input.location.trim(),
    foundOn: input.foundOn || todayISO(),
    status: "available",
    privateNote: input.privateNote.trim() || null,
    registeredAt: new Date().toISOString(),
  };
  write(KEYS.refSeq, seq + 1);
  write(KEYS.items, [item, ...read(KEYS.items, [])]);
  appendAudit({
    actor: loadSession(),
    action: "item.registered",
    entity: "item",
    entityId: item.ref,
    detail: { ref: item.ref, title: item.title, category: item.category, location: item.location },
  });
  // Like the API, the response is the PUBLIC shape — the private note is not echoed back.
  return toPublicItem(item);
}

/** Claims with private answers, for the review screen. GET /api/items/:ref/claims per item in the real API. */
export async function listClaims() {
  await wait(250);
  const items = new Map(loadAllItems().map((i) => [i.ref, i]));
  const all = read(KEYS.claims, []);
  return all
    .map((c) => {
      const item = items.get(c.ref);
      const user = findUser(c.email);
      return {
        id: c.id,
        status: c.status,
        handedOverAt: c.handedOverAt ?? null,
        submittedAt: c.submittedAt,
        reviewedAt: c.reviewedAt ?? null,
        withdrawnAt: c.withdrawnAt ?? null,
        reason: c.reason ?? null,
        autoClosed: Boolean(c.autoClosed),
        // Other claims still waiting on the same item — approving this one closes them.
        otherPending: all.filter((o) => o.ref === c.ref && o.id !== c.id && o.status === "pending").length,
        claimant: {
          name: c.claimantName ?? user?.name ?? "Unknown student",
          email: c.email,
          studentId: c.claimantStudentId ?? user?.studentId ?? null,
        },
        answers: {
          description: c.description,
          identifying: c.identifying,
          lostOn: c.lostOn,
          lostWhere: c.lostWhere,
        },
        item: item
          ? {
              ref: item.ref,
              title: item.title,
              category: item.category,
              location: item.location,
              foundOn: item.foundOn,
              status: item.status,
              privateNote: item.privateNote ?? null,
            }
          : { ref: c.ref, title: c.itemTitle, status: "unknown", privateNote: null },
      };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

function updateClaim(id, patch) {
  const claims = read(KEYS.claims, []);
  const claim = claims.find((c) => c.id === id);
  if (!claim) throw new Error("No claim with that id.");
  write(KEYS.claims, claims.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return { ...claim, ...patch };
}

export const REJECT_REASONS = [
  "Your description didn't match the item.",
  "The detail only the owner would know didn't match.",
  "We need to see you in person — please visit the help desk.",
];

export const COMPETING_REASON = "Another claim for this item was approved after an ID check.";

/** PATCH /api/claims/:id — approve or reject a pending claim. A rejection needs a reason the student will see. */
export async function reviewClaim(id, status, reason = "") {
  await wait(400);
  if (!["approved", "rejected"].includes(status)) throw new Error("Status must be approved or rejected.");
  const current = read(KEYS.claims, []).find((c) => c.id === id);
  if (!current) throw new Error("No claim with that id.");
  if (current.status !== "pending") throw new Error(`This claim was already ${current.status}.`);
  const why = reason.trim();
  if (status === "rejected" && why.length < 5) throw new Error("Tell the student why — they'll see this reason.");

  const item = loadAllItems().find((i) => i.ref === current.ref);
  if (status === "approved" && item && item.status !== "available") {
    throw new Error("This item is already reserved or returned — another claim was approved.");
  }

  const reviewedAt = new Date().toISOString();
  const actor = loadSession();
  const claim = updateClaim(id, { status, reviewedAt, reason: status === "rejected" ? why : null });
  appendAudit({
    actor,
    action: "claim.reviewed",
    entity: "claim",
    entityId: claim.id,
    detail: {
      status,
      ref: claim.ref,
      title: claim.itemTitle,
      claimant: claim.claimantName ?? claim.email,
      reason: status === "rejected" ? why : undefined,
    },
  });

  let closed = [];
  if (status === "approved") {
    // An approved claim reserves the item, and every other open claim on it is closed with a reason.
    setItemStatus(claim.ref, "claimed");
    closed = read(KEYS.claims, []).filter((c) => c.ref === claim.ref && c.id !== id && c.status === "pending");
    closed.forEach((c) => {
      updateClaim(c.id, { status: "rejected", reviewedAt, reason: COMPETING_REASON, autoClosed: true });
      appendAudit({
        actor,
        action: "claim.reviewed",
        entity: "claim",
        entityId: c.id,
        detail: {
          status: "rejected",
          ref: c.ref,
          title: c.itemTitle,
          claimant: c.claimantName ?? c.email,
          reason: COMPETING_REASON,
          auto: true,
        },
      });
    });
  }
  notifyClaimsChanged();
  return { id: claim.id, status: claim.status, reviewedAt, closedIds: closed.map((c) => c.id) };
}

/** POST /api/claims/:id/handover — needs an approved claim and a recorded identity check. */
export async function recordHandover(id, { identityChecked, identityNote }) {
  await wait(500);
  if (identityChecked !== true) throw new Error("Confirm that you checked the student's ID first.");
  const current = read(KEYS.claims, []).find((c) => c.id === id);
  if (!current) throw new Error("No claim with that id.");
  if (current.status !== "approved") throw new Error("Only an approved claim can be handed over.");
  const item = loadAllItems().find((i) => i.ref === current.ref);
  if (item?.status === "handed_over") throw new Error("This item was already handed over.");

  const handedOverAt = new Date().toISOString();
  updateClaim(id, { handedOverAt, identityNote: identityNote?.trim() || null });
  setItemStatus(current.ref, "handed_over");
  notifyClaimsChanged();
  appendAudit({
    actor: loadSession(),
    action: "item.handed_over",
    entity: "item",
    entityId: current.ref,
    detail: {
      ref: current.ref,
      title: current.itemTitle,
      claimId: id,
      claimant: current.claimantName ?? current.email,
      identityChecked: true,
      note: identityNote?.trim() || null,
    },
  });
  return { id: `HO-${Date.now().toString().slice(-6)}`, claimId: id, handedOverAt };
}

export const LONG_UNCLAIMED_DAYS = 14;

export function daysSince(isoDate) {
  const start = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  return Math.max(0, Math.round((today - start) / 86400000));
}

/** Every record, including returned ones, with claim counts. Staff-only (has privateNote). */
export async function listInventory() {
  // TODO(backend): GET /api/staff/items (not built yet)
  await wait(200);
  const claims = read(KEYS.claims, []);
  return loadAllItems()
    .map((item) => {
      const mine = claims.filter((c) => c.ref === item.ref);
      return {
        ...item,
        daysOnRack: daysSince(item.foundOn),
        claimsCount: mine.length,
        pendingCount: mine.filter((c) => c.status === "pending").length,
      };
    })
    .sort((a, b) => b.foundOn.localeCompare(a.foundOn) || b.ref.localeCompare(a.ref));
}

/** One full record plus every claim on it. Mirrors GET /api/items/:ref/claims. */
export async function getStaffItem(ref) {
  const item = loadAllItems().find((i) => i.ref.toLowerCase() === String(ref).toLowerCase());
  if (!item) throw new Error("not-found");
  const claims = (await listClaims()).filter((c) => c.item.ref === item.ref);
  return { item: { ...item, daysOnRack: daysSince(item.foundOn) }, claims };
}

/** Numbers for the desk overview (no single endpoint yet — derived from the lists). */
export async function getDeskSummary() {
  const claims = await listClaims();
  const items = loadAllItems();
  return {
    onRack: items.filter((i) => i.status !== "handed_over").length,
    pending: claims.filter((c) => c.status === "pending").length,
    awaitingHandover: claims.filter((c) => c.status === "approved" && !c.handedOverAt).length,
    returned: items.filter((i) => i.status === "handed_over").length,
    longUnclaimed: items.filter((i) => i.status === "available" && daysSince(i.foundOn) >= LONG_UNCLAIMED_DAYS).length,
    queue: claims.filter((c) => c.status === "pending").slice(0, 5),
    recentItems: read(KEYS.items, []).slice(0, 4).map(toPublicItem),
  };
}
