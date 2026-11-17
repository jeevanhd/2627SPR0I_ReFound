// Audit log reader for supervisors — reads GET /api/audit (supervisor only).

import { api } from "../api/client.js";

export const ACTIONS = {
  "item.registered": { label: "Item logged", tone: "marker" },
  "claim.submitted": { label: "Claim filed", tone: "sky" },
  "claim.approved": { label: "Claim approved", tone: "ink" },
  "claim.rejected": { label: "Claim rejected", tone: "stamp" },
  "claim.withdrawn": { label: "Claim withdrawn", tone: "muted" },
  "item.handed_over": { label: "Handed over", tone: "rose" },
};

/** "claim.reviewed" entries are split by outcome so they can be filtered separately. */
export const actionKey = (entry) =>
  entry.action === "claim.reviewed" ? `claim.${entry.detail?.status}` : entry.action;

export function describe(entry) {
  const d = entry.detail ?? {};
  const what = d.title ? `${d.title} (${d.ref})` : d.ref ?? entry.entityId;
  switch (actionKey(entry)) {
    case "item.registered":
      return `Logged ${what}, found at ${d.location}.`;
    case "claim.submitted":
      return `Filed claim ${entry.entityId} for ${what}.`;
    case "claim.approved":
      return `Approved claim ${entry.entityId} by ${d.claimant} for ${what}.`;
    case "claim.rejected":
      return d.auto
        ? `Closed claim ${entry.entityId} by ${d.claimant} for ${what} — another claim was approved.`
        : `Rejected claim ${entry.entityId} by ${d.claimant} for ${what}${d.reason ? ` — “${d.reason}”` : ""}.`;
    case "claim.withdrawn":
      return `${d.claimant} withdrew claim ${entry.entityId} for ${what}.`;
    case "item.handed_over":
      return `Handed ${what} to ${d.claimant} after an ID check${d.note ? ` — “${d.note}”` : ""}.`;
    default:
      return `${entry.action} on ${entry.entity} ${entry.entityId}`;
  }
}

/** Filtering happens on the server, over the same fields the logbook searches. */
export async function listAudit({ action = "", q = "" } = {}) {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (q.trim()) params.set("q", q.trim());
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const { entries } = await api(`/api/audit${suffix}`);
  return entries;
}

/** CSV of the given entries, for supervisors to keep or share with administration. */
export function toCsv(entries) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = entries.map((e) =>
    [e.at, e.actor?.name, e.actor?.role, ACTIONS[actionKey(e)]?.label ?? e.action, e.entityId, describe(e)].map(cell).join(",")
  );
  return ["Time,Who,Role,Action,Reference,Details", ...rows].join("\r\n");
}
