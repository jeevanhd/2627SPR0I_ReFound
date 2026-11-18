import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { colorFor, formatDate, getMyClaim, markClaimsSeen, withdrawClaim } from "../services/itemsService.js";

const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

function buildSteps(claim) {
  if (claim.status === "withdrawn") {
    return [
      { key: "filed", title: "Claim filed", text: "Your answers went to the help desk.", at: claim.submittedAt, state: "done" },
      { key: "withdrawn", title: "Withdrawn by you", text: "The desk won't review this claim.", at: claim.withdrawnAt, state: "bad" },
    ];
  }
  const rejected = claim.status === "rejected";
  const approved = claim.status === "approved" || claim.status === "returned";
  const returned = claim.status === "returned";
  return [
    { key: "filed", title: "Claim filed", text: "Your answers went to the help desk.", at: claim.submittedAt, state: "done" },
    {
      key: "review",
      title: rejected ? "Not approved" : "Checked by staff",
      text: rejected
        ? claim.reason ?? "Staff couldn't match your answers to the item."
        : approved
          ? "Your answers matched the desk's record."
          : "Staff are comparing your answers with what they logged.",
      at: claim.reviewedAt,
      state: rejected ? "bad" : approved ? "done" : "current",
    },
    {
      key: "pickup",
      title: "Ready for pickup",
      text: "Bring your student ID to the help desk.",
      at: approved ? claim.reviewedAt : null,
      state: rejected ? "skipped" : returned ? "done" : approved ? "current" : "todo",
    },
    {
      key: "returned",
      title: "Back with you",
      text: "Handed over after an ID check.",
      at: claim.handedOverAt,
      state: rejected ? "skipped" : returned ? "done" : "todo",
    },
  ];
}

export default function ClaimDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [claim, setClaim] = useState(null);
  const [missing, setMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyClaim(id)
      .then((c) => {
        setClaim(c);
        if (c.unread) markClaimsSeen([c.id]).catch(() => {}); // opening the claim clears its notification
      })
      .catch(() => setMissing(true));
  }, [id, user.email]);

  async function handleWithdraw() {
    setBusy(true);
    setError("");
    try {
      await withdrawClaim(claim.id);
      setClaim(await getMyClaim(claim.id));
      setConfirming(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="container detail">
        <div className="empty">
          <p className="stamp stamp--big" aria-hidden="true">Not on file</p>
          <h2>We can't find claim {id}.</h2>
          <p className="muted">It may belong to another account.</p>
          <Link to="/claims" className="btn btn--ink">Back to my claims</Link>
        </div>
      </div>
    );
  }

  if (!claim) return <div className="container detail"><p className="mono muted">Opening claim {id}…</p></div>;

  const steps = buildSteps(claim);
  const ready = claim.status === "approved";

  return (
    <div className="container detail">
      <Link to="/claims" className="back mono">← All my claims</Link>

      <header className="register__head">
        <p className="eyebrow mono">Claim {claim.id}</p>
        <h1>
          {claim.status === "returned" ? (
            <>Case <em>closed.</em></>
          ) : claim.status === "rejected" ? (
            <>Not <em>approved.</em></>
          ) : claim.status === "withdrawn" ? (
            <><em>Withdrawn.</em></>
          ) : ready ? (
            <>Ready for <em>pickup.</em></>
          ) : (
            <>Being <em>checked.</em></>
          )}
        </h1>
      </header>

      {ready && (
        <div className="pickup">
          <p className="mono pickup__kicker">Bring to the help desk</p>
          <ul>
            <li>Your <strong>student ID card</strong></li>
            <li>
              Your claim number: <span className="mono ref-big">{claim.id}</span>
            </li>
          </ul>
          <p className="small">Staff check your ID before handing anything over.</p>
        </div>
      )}

      {claim.status === "rejected" && (
        <div className="reason" role="note">
          <p className="reason__label mono">Why the desk said no</p>
          <p>{claim.reason ?? "Staff couldn't match your answers to the item."}</p>
        </div>
      )}

      <div className="claimview">
        <ol className="timeline">
          {steps.map((s) => (
            <li key={s.key} className={`timeline__step timeline__step--${s.state}`}>
              <span className="timeline__dot" aria-hidden="true" />
              <div>
                <h3>{s.title}</h3>
                <p className="small muted">{s.state === "skipped" ? "—" : s.text}</p>
                {s.at && s.state !== "todo" && <p className="mono small">{when(s.at)}</p>}
              </div>
            </li>
          ))}
        </ol>

        <aside className="claimview__side">
          {claim.item && (
            <Link
              to={`/items/${claim.item.ref}`}
              className={`tag tag--${colorFor(claim.item.category)} tag--card`}
              style={{ "--i": 1 }}
            >
              <span className="tag__hole" aria-hidden="true" />
              <p className="tag__ref mono">{claim.item.ref}</p>
              <h3 className="tag__item">{claim.item.title}</h3>
              <p className="tag__where mono">↳ {claim.item.location}</p>
              <p className="tag__date mono">Found {formatDate(claim.item.foundOn)}</p>
            </Link>
          )}

          <section className="yours">
            <h4 className="mono">What you told the desk</h4>
            <p className="quote">“{claim.description}”</p>
            <p className="quote quote--key">
              <span className="mono small">Only the owner would know:</span> “{claim.identifying}”
            </p>
            {(claim.lostOn || claim.lostWhere) && (
              <p className="small muted">
                Lost {claim.lostOn ? formatDate(claim.lostOn) : "—"}
                {claim.lostWhere ? ` · ${claim.lostWhere}` : ""}
              </p>
            )}
            <p className="mono small muted">Only you and the help desk can see this.</p>
          </section>
        </aside>
      </div>

      {claim.status === "pending" && (
        <section className="withdraw">
          <h4>Found it somewhere else?</h4>
          <p className="small muted">
            You can withdraw this claim while it's waiting for review. The desk will stop checking it.
          </p>
          {error && <div className="alert alert--error" role="alert">{error}</div>}
          {!confirming ? (
            <button type="button" className="btn btn--ghost" onClick={() => setConfirming(true)}>
              Withdraw this claim
            </button>
          ) : (
            <div className="withdraw__row">
              <button type="button" className="btn btn--stamp" disabled={busy} onClick={handleWithdraw}>
                {busy ? "Withdrawing…" : "Yes, withdraw it"}
              </button>
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setConfirming(false)}>
                Keep my claim
              </button>
            </div>
          )}
        </section>
      )}

      {claim.status === "withdrawn" && claim.item?.status === "available" && (
        <p className="note mono">
          Changed your mind? The item is still on the rack — <Link to={`/items/${claim.item.ref}/claim`}>claim it again</Link>.
        </p>
      )}

      {claim.status === "rejected" && (
        <p className="note mono">
          Think this is a mistake? Visit the help desk with your student ID and quote {claim.id}.{" "}
          <Link to="/help">How claims work</Link>
        </p>
      )}
    </div>
  );
}
