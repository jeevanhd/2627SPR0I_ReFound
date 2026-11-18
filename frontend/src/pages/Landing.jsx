import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { colorFor, latestItems } from "../services/itemsService.js";

const FEATURES = [
  { no: "01", title: "One register, searchable", text: "No more paper books or group-chat guesswork. Every found item lives in one list you can search." },
  { no: "02", title: "Private by design", text: "Serial numbers, contents and marks stay with staff. The public only sees what's safe to show." },
  { no: "03", title: "Handed back, on record", text: "Items go back only after an approved claim and an ID check — and every handover is logged." },
];

const STEPS = [
  { title: "Tagged", text: "A desk volunteer logs the item and gives it a reference code." },
  { title: "Searched", text: "You look it up by keyword, category or where you lost it." },
  { title: "Claimed", text: "You describe something only the owner would know. Staff-only." },
  { title: "Checked", text: "The help desk verifies your claim and your student ID." },
  { title: "Returned", text: "You collect it. The handover is stamped into the record." },
];

export default function Landing() {
  const { user } = useAuth();
  // The newest items on the real register. If the API is down or the rack is empty, the
  // hero simply shows no tags and the ticker is hidden.
  const [latest, setLatest] = useState([]);
  useEffect(() => {
    latestItems(8).then(setLatest).catch(() => setLatest([]));
  }, []);
  const tags = latest.slice(0, 3);
  const ticker = latest.map((i) => `${i.ref} · ${i.title} · ${i.location}`);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <p className="eyebrow mono">Campus Lost &amp; Found Register</p>
            <h1>
              Lost something
              <br />
              on campus? <em>Find it</em> <mark>here.</mark>
            </h1>
            <p className="lead">
              Refound is the help desk's register of everything handed in. Check what's been found, claim what's yours,
              and pick it up — no queue, no guesswork.
            </p>
            <div className="hero__actions">
              {user ? (
                <Link to="/welcome" className="btn btn--stamp btn--lg">
                  Go to your desk →
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="btn btn--stamp btn--lg">
                    Get a student account →
                  </Link>
                  <Link to="/items" className="btn btn--ghost btn--lg">
                    Browse the register
                  </Link>
                </>
              )}
            </div>
            <p className="note mono">Staff &amp; desk volunteers: log in with the account your supervisor issued.</p>
          </div>

          <div className="rack" aria-label="Newest found items">
            <span className="rack__rail" aria-hidden="true" />
            {tags.map((t, i) => (
              <Link key={t.ref} to={`/items/${t.ref}`} className={`tag tag--${colorFor(t.category)} tag--link`} style={{ "--i": i }}>
                <span className="tag__hole" aria-hidden="true" />
                <p className="tag__ref mono">{t.ref}</p>
                <h3 className="tag__item">{t.title}</h3>
                <p className="tag__where mono">↳ {t.location}</p>
                <span className="stamp" aria-hidden="true">
                  Found
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {ticker.length > 0 && (
        <div className="ticker" aria-label="Recently found">
          <div className="ticker__track">
            {[...ticker, ...ticker].map((t, i) => (
              <span key={i} className="mono" aria-hidden={i >= ticker.length}>
                ✱ {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <section className="section">
        <div className="container">
          <h2 className="section__title">
            Why the help desk <em>switched</em>
          </h2>
          <div className="cards">
            {FEATURES.map((f) => (
              <article key={f.no} className="index-card">
                <span className="index-card__tape" aria-hidden="true" />
                <p className="index-card__no mono">Card {f.no}</p>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--ink">
        <div className="container">
          <h2 className="section__title">
            From <em>lost</em> to <em>returned</em> in five stubs
          </h2>
          <ol className="stubs">
            {STEPS.map((s, i) => (
              <li key={s.title} className="stub">
                <p className="stub__no mono">Step {String(i + 1).padStart(2, "0")}</p>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {!user && (
        <section className="section">
          <div className="container">
            <div className="notice">
              <span className="notice__pin" aria-hidden="true" />
              <p className="mono notice__kicker">Notice · Posted by the help desk</p>
              <h2>
                Lost something <mark>today?</mark>
              </h2>
              <p>Make an account now, so you can claim it the minute it's handed in.</p>
              <Link to="/signup" className="btn btn--stamp btn--lg">
                Sign up — it's free →
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
