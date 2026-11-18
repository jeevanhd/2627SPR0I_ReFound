// Staff desk service — talks to the real staff API (backend/src/routes).
//
// The exported functions keep the shapes the screens already use, so swapping
// the mock out did not touch a single page.

import { api } from "../api/client.js";
import { notifyClaimsChanged, todayISO } from "./events.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

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
  const { item } = await api("/api/items", {
    method: "POST",
    body: {
      title: input.title,
      description: input.description,
      category: input.category,
      location: input.location,
      foundOn: input.foundOn || undefined,
      privateNote: input.privateNote || undefined,
    },
  });
  notifyClaimsChanged();
  // Like the API, the response is the PUBLIC shape — the private note is not echoed back.
  return item;
}

/** GET /api/staff/claims — every claim, with the private answers, for the review screen. */
export async function listClaims() {
  const { claims } = await api("/api/staff/claims");
  return claims;
}

export const REJECT_REASONS = [
  "Your description didn't match the item.",
  "The detail only the owner would know didn't match.",
  "We need to see you in person — please visit the help desk.",
];

export const COMPETING_REASON = "Another claim for this item was approved after an ID check.";

/** PATCH /api/claims/:id — approve or reject a pending claim. A rejection needs a reason. */
export async function reviewClaim(id, status, reason = "") {
  const result = await api(`/api/claims/${id}`, {
    method: "PATCH",
    body: status === "rejected" ? { status, reason } : { status },
  });
  notifyClaimsChanged();
  return result;
}

/** POST /api/claims/:id/handover — needs an approved claim and a recorded identity check. */
export async function recordHandover(id, { identityChecked, identityNote }) {
  const result = await api(`/api/claims/${id}/handover`, {
    method: "POST",
    body: { identityChecked, identityNote: identityNote || null },
  });
  notifyClaimsChanged();
  return result;
}

export const LONG_UNCLAIMED_DAYS = 14;

export function daysSince(isoDate) {
  const start = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  return Math.max(0, Math.round((today - start) / 86400000));
}

/** GET /api/staff/items — every record, returned ones included, with claim counts. */
export async function listInventory() {
  const { items } = await api("/api/staff/items");
  return items;
}

/** One full record plus every claim on it. */
export async function getStaffItem(ref) {
  const inventory = await listInventory();
  const item = inventory.find((i) => i.ref.toLowerCase() === String(ref).toLowerCase());
  if (!item) throw new Error("not-found");

  try {
    const { claims } = await api(`/api/items/${item.ref}/claims`);
    return { item, claims };
  } catch (err) {
    if (err.status === 404) return { item, claims: [] };
    throw err;
  }
}

/** Numbers for the desk overview, derived from the two lists. */
export async function getDeskSummary() {
  const [items, claims] = await Promise.all([listInventory(), listClaims()]);
  const pending = claims.filter((c) => c.status === "pending");
  return {
    onRack: items.filter((i) => i.status !== "handed_over").length,
    pending: pending.length,
    awaitingHandover: claims.filter((c) => c.status === "approved" && !c.handedOverAt).length,
    returned: items.filter((i) => i.status === "handed_over").length,
    longUnclaimed: items.filter((i) => i.status === "available" && daysSince(i.foundOn) >= LONG_UNCLAIMED_DAYS).length,
    queue: pending.slice(0, 5),
    recentItems: items.slice(0, 4),
  };
}
