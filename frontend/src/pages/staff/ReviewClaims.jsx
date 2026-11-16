import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CaseFile from "../../components/CaseFile.jsx";
import { listClaims } from "../../services/staffService.js";

const TABS = [
  { key: "pending", label: "To review", match: (c) => c.status === "pending" },
  { key: "approved", label: "Waiting for pickup", match: (c) => c.status === "approved" && !c.handedOverAt },
  { key: "returned", label: "Returned", match: (c) => Boolean(c.handedOverAt) },
  { key: "rejected", label: "Rejected", match: (c) => c.status === "rejected" },
  { key: "withdrawn", label: "Withdrawn", match: (c) => c.status === "withdrawn" },
];

export default function ReviewClaims() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get("tab")) ?? TABS[0];
  const [claims, setClaims] = useState(null);

  const load = useCallback(() => listClaims().then(setClaims), []);
  useEffect(() => {
    load();
  }, [load]);

  const visible = claims?.filter(tab.match) ?? [];

  return (
    <div className="container register">
      <Link to="/staff" className="back mono">← Back to the desk</Link>
      <header className="register__head">
        <p className="eyebrow mono">Claims · staff only</p>
        <h1>
          Check every claim against <em>the record</em>
        </h1>
        <p className="muted">Compare what the student says with what the desk logged. Approve only if it matches.</p>
      </header>

      <div className="chips tabs" role="tablist" aria-label="Claim status">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab.key === t.key}
            className={`chip${tab.key === t.key ? " is-active" : ""}`}
            onClick={() => setParams({ tab: t.key }, { replace: true })}
          >
            {t.label}
            {claims && <span className="chip__count">{claims.filter(t.match).length}</span>}
          </button>
        ))}
      </div>

      {claims === null ? (
        <p className="mono muted">Pulling the folders…</p>
      ) : visible.length === 0 ? (
        <div className="empty">
          <h2>Nothing here.</h2>
          <p className="muted">
            {tab.key === "pending"
              ? "No claims are waiting. When a student claims an item, it lands here."
              : "No claims in this pile yet."}
          </p>
        </div>
      ) : (
        <div className="casefiles">
          {visible.map((c) => (
            <CaseFile key={c.id} claim={c} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}
