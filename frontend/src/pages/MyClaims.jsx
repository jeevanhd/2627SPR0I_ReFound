import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { formatDate, getClaimUpdates, getMyClaims, markClaimsSeen } from "../services/itemsService.js";

const STATUS_TEXT = {
  pending: "Waiting for the help desk to review.",
  approved: "Approved — bring your student ID to collect it.",
  rejected: "Not approved.",
  returned: "Handed back. Case closed.",
  withdrawn: "You withdrew this claim.",
};

export default function MyClaims() {
  const { user } = useAuth();
  const [claims, setClaims] = useState(null);
  const [updates, setUpdates] = useState([]);

  useEffect(() => {
    getMyClaims(user.email).then(setClaims);
    setUpdates(getClaimUpdates(user.email));
  }, [user.email]);

  const unseen = new Set(updates.map((u) => u.id));

  function markAllRead() {
    markClaimsSeen(user.email);
    setUpdates([]);
  }

  return (
    <div className="container register">
      <header className="register__head">
        <p className="eyebrow mono">Your claims</p>
        <h1>
          Claims you've <em>filed</em>
        </h1>
      </header>

      {updates.length > 0 && (
        <section className="updates" aria-labelledby="updates-title">
          <div className="updates__head">
            <h2 id="updates-title">
              What's new <span className="mono small muted">({updates.length})</span>
            </h2>
            <button type="button" className="linkish mono small" onClick={markAllRead}>
              Mark all as read
            </button>
          </div>
          <ul>
            {updates.map((u) => (
              <li key={u.id}>
                <Link to={`/claims/${u.id}`} className="updates__row">
                  <span className={`stamp stamp--inline stamp--${u.status}`}>{u.status}</span>
                  <strong>{u.itemTitle}</strong>
                  <p className="small muted">
                    {u.text} <span className="mono">· {u.id}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {claims === null ? (
        <p className="mono muted">Opening the drawer…</p>
      ) : claims.length === 0 ? (
        <div className="empty">
          <h2>No claims yet.</h2>
          <p className="muted">Find your item on the register and press “This is mine”.</p>
          <Link to="/items" className="btn btn--ink">Browse the register</Link>
        </div>
      ) : (
        <ul className="claims">
          {claims.map((c) => (
            <li key={c.id} className={`claim-row${unseen.has(c.id) ? " claim-row--new" : ""}`}>
              <div>
                <p className="mono small muted">
                  {c.id} · filed {formatDate(c.submittedAt.slice(0, 10))}
                  {unseen.has(c.id) && <span className="new-flag mono">New</span>}
                </p>
                <h3>
                  <Link to={`/claims/${c.id}`}>{c.itemTitle}</Link> <span className="mono small muted">{c.ref}</span>
                </h3>
                <p className="muted small">
                  {STATUS_TEXT[c.status]}
                  {c.status === "rejected" && c.reason ? ` “${c.reason}”` : ""}
                </p>
              </div>
              <span className={`stamp stamp--inline stamp--${c.status}`}>{c.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
