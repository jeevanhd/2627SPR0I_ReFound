// Items + claims service (public register and the student's own claims).
// Every function calls the real API (backend/src/routes); nothing is stored in the browser.

import { api } from "../api/client.js";
import { notifyClaimsChanged } from "./events.js";

// Categories are a fixed vocabulary the desk uses, not data — each has a tag colour.
const CATEGORY_COLORS = {
  Accessories: "rose",
  Bags: "sky",
  Bottles: "marker",
  Clothing: "rose",
  Electronics: "sky",
  "ID & Cards": "marker",
  Keys: "rose",
  Stationery: "marker",
};

export const CATEGORIES = Object.keys(CATEGORY_COLORS).sort();

export const colorFor = (category) => CATEGORY_COLORS[category] ?? "marker";

export function formatDate(iso) {
  return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ---------- Public register ---------- */

/** GET /api/items — every keyword must match; returned items are not listed. */
export async function searchItems({ q = "", category = "", location = "" } = {}) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (category) params.set("category", category);
  if (location) params.set("location", location);
  const suffix = params.toString() ? `?${params}` : "";
  const { items } = await api(`/api/items${suffix}`);
  return items;
}

/** GET /api/items/locations — places items were found, for the filter. */
export async function listLocations() {
  const { locations } = await api("/api/items/locations");
  return locations;
}

/** GET /api/items/:ref — one public record. Throws "not-found" for an unknown ref. */
export async function getItem(ref) {
  try {
    const { item } = await api(`/api/items/${encodeURIComponent(ref)}`);
    return item;
  } catch (err) {
    if (err.status === 404) throw new Error("not-found");
    throw err;
  }
}

/** Newest items still on the rack, for the student home page. */
export async function latestItems(count = 4) {
  return (await searchItems()).slice(0, count);
}

/* ---------- The signed-in student's claims ---------- */

/** GET /api/claims/mine — newest first. */
export async function getMyClaims() {
  const { claims } = await api("/api/claims/mine");
  return claims;
}

/** GET /api/claims/mine/:id — throws "not-found" for an unknown id or someone else's claim. */
export async function getMyClaim(id) {
  try {
    const { claim } = await api(`/api/claims/mine/${encodeURIComponent(id)}`);
    return claim;
  } catch (err) {
    if (err.status === 404) throw new Error("not-found");
    throw err;
  }
}

/** The student's active claim on an item. A withdrawn claim doesn't count, so they can claim again. */
export async function findMyClaim(ref) {
  const claims = await getMyClaims();
  return claims.find((c) => c.ref === ref && c.status !== "withdrawn") ?? null;
}

/** POST /api/items/:ref/claims — the answers go to staff only. */
export async function submitClaim({ item, description, identifying, lostOn, lostWhere }) {
  const { claim } = await api(`/api/items/${encodeURIComponent(item.ref)}/claims`, {
    method: "POST",
    body: {
      description,
      identifying,
      lostOn: lostOn || undefined,
      lostWhere: lostWhere || undefined,
    },
  });
  notifyClaimsChanged();
  return claim;
}

/** POST /api/claims/mine/:id/withdraw — only while the claim is still pending. */
export async function withdrawClaim(id) {
  const result = await api(`/api/claims/mine/${encodeURIComponent(id)}/withdraw`, { method: "POST" });
  notifyClaimsChanged();
  return result;
}

/* ---------- Claim updates (the navbar badge and "What's new") ---------- */

const UPDATE_TEXT = {
  approved: "Approved — bring your student ID to the help desk.",
  rejected: "Not approved. Open the claim to see why.",
  returned: "Handed back to you. Case closed.",
};

/** GET /api/claims/mine/updates — outcomes the student hasn't opened yet. */
export async function getClaimUpdates() {
  const { updates } = await api("/api/claims/mine/updates");
  return updates.map((u) => ({ ...u, text: UPDATE_TEXT[u.status] }));
}

/** POST /api/claims/mine/seen — mark all updates as read, or only the given claim ids. */
export async function markClaimsSeen(ids = null) {
  await api("/api/claims/mine/seen", { method: "POST", body: ids ? { ids } : {} });
  notifyClaimsChanged();
}
