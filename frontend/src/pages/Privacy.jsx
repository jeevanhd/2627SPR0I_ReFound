import { Link } from "react-router-dom";

const TIERS = [
  {
    who: "Everyone",
    tone: "marker",
    sees: [
      "Item name, category and a general description",
      "Where and when it was found",
      "Its reference code and whether it's reserved",
    ],
    never: "Serial numbers, contents, marks, or anything that identifies the owner.",
  },
  {
    who: "You (signed in)",
    tone: "sky",
    sees: ["Your profile: name, student ID, email", "Your own claims, their status, and the answers you gave"],
    never: "Other students' claims or answers.",
  },
  {
    who: "Help desk staff",
    tone: "rose",
    sees: [
      "Private ownership details they logged for each item",
      "Claim answers, so they can check who the owner is",
      "Your name, student ID and email when you make a claim",
    ],
    never: "Your password — it's stored scrambled (hashed) and nobody can read it.",
  },
  {
    who: "Supervisors",
    tone: "ink",
    sees: ["Everything staff see", "The audit log: who logged, approved, rejected or handed over what, and when"],
    never: "Claim answers in the audit log — it records that a claim happened, not what it said.",
  },
];

export default function Privacy() {
  return (
    <div className="container prose-page">
      <header className="register__head">
        <p className="eyebrow mono">Privacy notice · draft</p>
        <h1>
          Who sees <em>what</em>
        </h1>
        <p className="muted">
          Refound shows enough for you to recognise your things, and keeps back what would let someone else claim them.
        </p>
      </header>

      <div className="tiers">
        {TIERS.map((t) => (
          <section key={t.who} className={`tier tier--${t.tone}`}>
            <h2>{t.who}</h2>
            <p className="mono small tier__label">Can see</p>
            <ul>
              {t.sees.map((s) => <li key={s}>{s}</li>)}
            </ul>
            <p className="mono small tier__label">Never</p>
            <p className="tier__never">{t.never}</p>
          </section>
        ))}
      </div>

      <section className="faq">
        <h2>How it's kept</h2>
        <p>
          <strong>Separate storage.</strong> Public item details and private ownership details are stored separately,
          and public pages only ever read the public part.
        </p>
        <p>
          <strong>Handover needs an ID check.</strong> Staff can't hand an item over without an approved claim and a
          recorded check of the student's ID.
        </p>
        <p>
          <strong>Records stay on file.</strong> Items, claims and handovers are kept after an item is returned or goes
          unclaimed, so the desk can answer questions later.
        </p>
        <p>
          <strong>Questions or corrections?</strong> Visit the help desk with your student ID.
        </p>
        <p className="note mono">
          This notice is a draft and is waiting for approval by campus administration.
        </p>
      </section>

      <Link to="/help" className="mono small">← Back to help</Link>
    </div>
  );
}
