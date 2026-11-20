// In-page signal that claims changed, so the navbar badge can refresh.
// The API has no push channel; screens fire this after they change something.

export const CLAIMS_CHANGED = "refound:claims-changed";

export function notifyClaimsChanged() {
  try {
    window.dispatchEvent(new Event(CLAIMS_CHANGED));
  } catch {
    // no window (tests) — nothing to notify
  }
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
