import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CaseFile from "../../components/CaseFile.jsx";
import { colorFor, formatDate } from "../../services/itemsService.js";
import { getStaffItem } from "../../services/staffService.js";

const STATUS_TEXT = {
  available: "On the rack — open for claims.",
  claimed: "Reserved — a claim was approved. Waiting for the owner to collect.",
  handed_over: "Returned to its owner. The record stays on file.",
};

export default function StaffItem() {
  const { ref } = useParams();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(
    () =>
      getStaffItem(ref)
        .then(setData)
        .catch(() => setMissing(true)),
    [ref]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (missing) {
    return (
      <div className="container detail">
        <div className="empty">
          <p className="stamp stamp--big" aria-hidden="true">Not on file</p>
          <h2>No record with reference {ref}.</h2>
          <Link to="/staff/items" className="btn btn--ink">Back to inventory</Link>
        </div>
      </div>
    );
  }

  if (!data) return <div className="container detail"><p className="mono muted">Pulling record {ref}…</p></div>;

  const { item, claims } = data;

  return (
    <div className="container detail">
      <Link to="/staff/items" className="back mono">← Inventory</Link>

      <div className="detail__grid">
        <div className={`tag tag--${colorFor(item.category)} tag--hero`} style={{ "--i": 0 }}>
          <span className="tag__hole" aria-hidden="true" />
          <p className="tag__ref mono">{item.ref}</p>
          <h1 className="tag__item">{item.title}</h1>
          <p className="tag__where mono">↳ {item.location}</p>
          <span className={`stamp stamp--${item.status}`} aria-hidden="true">
            {item.status === "handed_over" ? "Returned" : item.status === "claimed" ? "Reserved" : "Found"}
          </span>
        </div>

        <div className="detail__info">
          <dl className="facts">
            <div><dt className="mono">Reference</dt><dd className="mono">{item.ref}</dd></div>
            <div><dt className="mono">Category</dt><dd>{item.category}</dd></div>
            <div><dt className="mono">Found at</dt><dd>{item.location}</dd></div>
            <div><dt className="mono">Found on</dt><dd>{formatDate(item.foundOn)} · {item.daysOnRack}d ago</dd></div>
          </dl>

          <p className="note mono">{STATUS_TEXT[item.status]}</p>

          <p className="detail__desc">{item.description}</p>

          <section className="private-box">
            <h4 className="mono">Staff only · ownership details</h4>
            {item.privateNote ? (
              <p className="quote quote--record">{item.privateNote}</p>
            ) : (
              <p className="small muted">No private note was logged. Check the item itself when comparing claims.</p>
            )}
          </section>

          <Link to={`/items/${item.ref}`} className="mono small">See the public page →</Link>
        </div>
      </div>

      <section className="home__section">
        <div className="home__section-head">
          <h2>
            Claims on this item <span className="mono small muted">({claims.length})</span>
          </h2>
        </div>
        {claims.length === 0 ? (
          <p className="muted">No one has claimed this item yet.</p>
        ) : (
          <div className="casefiles">
            {claims.map((c) => (
              <CaseFile key={c.id} claim={c} onChange={load} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
