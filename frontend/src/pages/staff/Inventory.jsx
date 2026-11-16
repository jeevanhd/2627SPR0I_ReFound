import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatDate } from "../../services/itemsService.js";
import { LONG_UNCLAIMED_DAYS, listInventory } from "../../services/staffService.js";

const FILTERS = [
  { key: "", label: "Everything", match: () => true },
  { key: "available", label: "On the rack", match: (i) => i.status === "available" },
  { key: "claimed", label: "Reserved", match: (i) => i.status === "claimed" },
  { key: "handed_over", label: "Returned", match: (i) => i.status === "handed_over" },
  {
    key: "long",
    label: `Unclaimed ${LONG_UNCLAIMED_DAYS}+ days`,
    match: (i) => i.status === "available" && i.daysOnRack >= LONG_UNCLAIMED_DAYS,
  },
];

const STATUS_LABEL = { available: "On rack", claimed: "Reserved", handed_over: "Returned" };

export default function Inventory() {
  const [params, setParams] = useSearchParams();
  const filterKey = params.get("status") ?? "";
  const q = params.get("q") ?? "";
  const [items, setItems] = useState(null);

  useEffect(() => {
    listInventory().then(setItems);
  }, []);

  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter(filter.match).filter((i) =>
      !needle ? true : `${i.ref} ${i.title} ${i.category} ${i.location}`.toLowerCase().includes(needle)
    );
  }, [items, filter, q]);

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div className="container register">
      <Link to="/staff" className="back mono">← Back to the desk</Link>
      <header className="register__head desk__head">
        <div>
          <p className="eyebrow mono">Inventory · staff only</p>
          <h1>
            Every record, <em>kept</em>
          </h1>
          <p className="muted">All items the desk has ever logged — including ones already returned.</p>
        </div>
        <Link to="/staff/items/new" className="btn btn--stamp btn--lg">+ Log a found item</Link>
      </header>

      <form className="searchstrip" role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="invq" className="searchstrip__label mono">Find</label>
        <input
          id="invq"
          type="search"
          placeholder="Reference, item, category or place"
          value={q}
          onChange={(e) => setParam("q", e.target.value)}
          autoComplete="off"
        />
      </form>

      <div className="chips" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f.key || "all"}
            type="button"
            aria-pressed={filter.key === f.key}
            className={`chip${filter.key === f.key ? " is-active" : ""}`}
            onClick={() => setParam("status", f.key)}
          >
            {f.label}
            {items && <span className="chip__count">{items.filter(f.match).length}</span>}
          </button>
        ))}
      </div>

      {items === null ? (
        <p className="mono muted">Counting the shelves…</p>
      ) : visible.length === 0 ? (
        <div className="empty">
          <h2>No records match.</h2>
          <p className="muted">Try another filter or search.</p>
        </div>
      ) : (
        <div className="inventory" role="table" aria-label="Item records">
          <div className="inventory__row inventory__row--head mono" role="row">
            <span role="columnheader">Ref</span>
            <span role="columnheader">Item</span>
            <span role="columnheader">Found</span>
            <span role="columnheader">Claims</span>
            <span role="columnheader">Status</span>
          </div>
          {visible.map((i) => (
            <Link key={i.ref} to={`/staff/items/${i.ref}`} className="inventory__row" role="row">
              <span className="mono" role="cell">{i.ref}</span>
              <span role="cell">
                <strong>{i.title}</strong>
                <span className="muted small"> · {i.category} · {i.location}</span>
                {i.privateNote && <span className="lock" title="Has a staff-only note"> 🔒</span>}
              </span>
              <span className="small" role="cell">
                {formatDate(i.foundOn)}
                <span className={`mono small${i.status === "available" && i.daysOnRack >= LONG_UNCLAIMED_DAYS ? " aging" : " muted"}`}>
                  {" "}· {i.daysOnRack}d
                </span>
              </span>
              <span className="mono small" role="cell">
                {i.claimsCount}
                {i.pendingCount > 0 && <span className="pending-dot"> {i.pendingCount} new</span>}
              </span>
              <span role="cell">
                <span className={`stamp stamp--inline stamp--${i.status}`}>{STATUS_LABEL[i.status]}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
