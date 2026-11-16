import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "../services/itemsService.js";
import { REJECT_REASONS, recordHandover, reviewClaim } from "../services/staffService.js";

// One claim as a manila case file: claimant, their answers, the private record, and actions.
export default function CaseFile({ claim, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [idChecked, setIdChecked] = useState(false);
  const [idNote, setIdNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const { item, claimant, answers } = claim;

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const stampText = claim.handedOverAt ? "returned" : claim.status;

  return (
    <article className="casefile" id={claim.id}>
      <div className="casefile__tab mono">{claim.id}</div>
      <header className="casefile__head">
        <div>
          <p className="mono small muted">
            Filed {formatDate(claim.submittedAt)} · item <Link to={`/staff/items/${item.ref}`}>{item.ref}</Link>
          </p>
          <h3>{item.title}</h3>
        </div>
        <span className={`stamp stamp--inline stamp--${stampText}`}>{stampText}</span>
      </header>

      <div className="casefile__grid">
        <section className="casefile__col">
          <h4 className="mono">Claimant</h4>
          <dl className="kv">
            <dt>Name</dt><dd>{claimant.name}</dd>
            <dt>Student ID</dt><dd className="mono">{claimant.studentId ?? "—"}</dd>
            <dt>Email</dt><dd className="mono small">{claimant.email}</dd>
          </dl>
        </section>

        <section className="casefile__col">
          <h4 className="mono">They say</h4>
          <p className="quote">“{answers.description}”</p>
          <p className="quote quote--key">
            <span className="mono small">Only the owner would know:</span> “{answers.identifying}”
          </p>
          {(answers.lostOn || answers.lostWhere) && (
            <p className="small muted">
              Lost {answers.lostOn ? formatDate(answers.lostOn) : "—"}
              {answers.lostWhere ? ` · ${answers.lostWhere}` : ""}
            </p>
          )}
        </section>

        <section className="casefile__col casefile__col--record">
          <h4 className="mono">The desk logged</h4>
          <p className="small">
            {item.category} · {item.location}
            {item.foundOn ? ` · ${formatDate(item.foundOn)}` : ""}
          </p>
          {item.privateNote ? (
            <p className="quote quote--record">{item.privateNote}</p>
          ) : (
            <p className="small muted">No private note was logged for this item. Check the item itself.</p>
          )}
        </section>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      {claim.status === "pending" && !rejecting && (
        <footer className="casefile__actions">
          {claim.otherPending > 0 && (
            <p className="competing mono">
              {claim.otherPending} other claim{claim.otherPending === 1 ? " is" : "s are"} waiting on this item.
              Approving this one closes {claim.otherPending === 1 ? "it" : "them"} and tells{" "}
              {claim.otherPending === 1 ? "that student" : "those students"} why.
            </p>
          )}
          <button
            type="button"
            className="btn btn--ink"
            disabled={busy || (item.status && item.status !== "available")}
            onClick={() => run(() => reviewClaim(claim.id, "approved"))}
          >
            ✓ Approve
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setRejecting(true)}>
            ✗ Reject…
          </button>
        </footer>
      )}

      {claim.status === "pending" && rejecting && (
        <footer className="casefile__actions">
          <form
            className="reject-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => reviewClaim(claim.id, "rejected", reason));
            }}
          >
            <label htmlFor={`reason-${claim.id}`} className="mono small">
              Why are you rejecting it? <span className="muted">The student will see this.</span>
            </label>
            <div className="reason-picks">
              {REJECT_REASONS.map((r) => (
                <button key={r} type="button" className="reason-pick" onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
            <textarea
              id={`reason-${claim.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Keep it kind and don't reveal the private details of the item."
              maxLength={240}
            />
            <div className="reject-form__row">
              <button type="submit" className="btn btn--stamp" disabled={busy || reason.trim().length < 5}>
                Reject with this reason
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => {
                  setRejecting(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </footer>
      )}

      {claim.status === "rejected" && claim.reason && (
        <div className="reason">
          <p className="reason__label mono">{claim.autoClosed ? "Closed automatically" : "Reason given to the student"}</p>
          <p>{claim.reason}</p>
        </div>
      )}

      {claim.status === "withdrawn" && (
        <p className="casefile__closed mono small">
          Withdrawn by the student{claim.withdrawnAt ? ` on ${formatDate(claim.withdrawnAt)}` : ""}. Nothing to do.
        </p>
      )}

      {claim.status === "approved" && !claim.handedOverAt && (
        <footer className="casefile__actions casefile__handover">
          <label className="check">
            <input type="checkbox" checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} />
            <span>
              I checked their student ID card in person and it matches{" "}
              <strong className="mono">{claimant.studentId ?? claimant.name}</strong>.
            </span>
          </label>
          <input
            className="inline-input"
            type="text"
            placeholder="Note (optional), e.g. “ID card checked, collected 3pm”"
            value={idNote}
            onChange={(e) => setIdNote(e.target.value)}
            aria-label="Handover note"
          />
          <button
            type="button"
            className="btn btn--stamp"
            disabled={busy || !idChecked}
            onClick={() => run(() => recordHandover(claim.id, { identityChecked: idChecked, identityNote: idNote }))}
          >
            Record handover
          </button>
        </footer>
      )}

      {claim.handedOverAt && (
        <p className="casefile__closed mono small">Handed over {formatDate(claim.handedOverAt)}. Case closed.</p>
      )}
    </article>
  );
}
