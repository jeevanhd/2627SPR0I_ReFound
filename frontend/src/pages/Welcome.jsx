import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import ItemTag from "../components/ItemTag.jsx";
import { getMyClaims, latestItems } from "../services/itemsService.js";

// Student home after login. Staff go straight to their desk.
export default function Welcome() {
  const { user } = useAuth();
  const [claims, setClaims] = useState(null);
  const [latest, setLatest] = useState([]);
  const isStudent = user.role === "student";

  useEffect(() => {
    if (!isStudent) return;
    getMyClaims(user.email).then(setClaims);
    latestItems(4).then(setLatest);
  }, [isStudent, user.email]);

  if (!isStudent) return <Navigate to="/staff" replace />;

  const ready = claims?.filter((c) => c.status === "approved") ?? [];
  const count = (s) => claims?.filter((c) => c.status === s).length ?? 0;

  return (
    <div className="container welcome">
      <div className="home__top">
        <div>
          <span className="badge">Student</span>
          <h1>
            Hi, <em>{user.name.split(" ")[0]}.</em>
          </h1>
          <p className="muted">Here's where your claims stand, and what's just been handed in.</p>
        </div>

        <div className="idcard" aria-label="Your details">
          <p className="idcard__head mono">Campus · Refound</p>
          <p className="idcard__name">{user.name}</p>
          <dl className="idcard__rows mono">
            <div><dt>Student ID</dt><dd>{user.studentId || "—"}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
          </dl>
          <p className="idcard__note small">Staff match this ID at handover.</p>
        </div>
      </div>

      {ready.map((c) => (
        <Link key={c.id} to={`/claims/${c.id}`} className="pickup pickup--link">
          <p className="mono pickup__kicker">Ready for pickup</p>
          <p className="pickup__title">
            <strong>{c.itemTitle}</strong> — bring your student ID and quote <span className="mono ref-big">{c.id}</span>
          </p>
        </Link>
      ))}

      <section className="home__section">
        <div className="home__section-head">
          <h2>Your claims</h2>
          <Link to="/claims" className="mono small">See all →</Link>
        </div>
        {claims === null ? (
          <p className="mono muted">Opening the drawer…</p>
        ) : claims.length === 0 ? (
          <p className="muted">
            No claims yet. Found your item on the register? Open it and press “This is mine”.
          </p>
        ) : (
          <div className="minicounts">
            <span className="minicount"><b>{count("pending")}</b> being checked</span>
            <span className="minicount minicount--sky"><b>{count("approved")}</b> ready for pickup</span>
            <span className="minicount minicount--rose"><b>{count("returned")}</b> returned</span>
            <span className="minicount minicount--stamp"><b>{count("rejected")}</b> not approved</span>
          </div>
        )}
      </section>

      <section className="home__section">
        <div className="home__section-head">
          <h2>Just handed in</h2>
          <Link to="/items" className="mono small">Search the register →</Link>
        </div>
        <div className="tag-grid">
          {latest.map((item, i) => (
            <ItemTag key={item.ref} item={item} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
