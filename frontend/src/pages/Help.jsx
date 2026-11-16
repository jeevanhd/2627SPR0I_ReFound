import { Link } from "react-router-dom";

const STEPS = [
  { title: "Search the register", text: "Look it up by keyword, category or where you lost it. New items appear as soon as the desk logs them." },
  { title: "Open it and press “This is mine”", text: "You'll need a student account. It takes a minute." },
  { title: "Answer two questions", text: "Describe the item, and tell us something only the owner would know. Only the help desk reads this." },
  { title: "Wait for the check", text: "Staff compare your answers with what they logged. Your claim page shows where it's at." },
  { title: "Collect it", text: "Once approved, bring your student ID and your claim number to the help desk." },
];

const FAQ = [
  {
    id: "not-listed",
    q: "My item isn't on the register.",
    a: "It may not have been handed in yet. Items appear the moment the desk logs them, so check back. Refound doesn't take lost-item reports in this version — the register only lists things that were found.",
  },
  {
    id: "what-to-bring",
    q: "What do I need to bring to collect it?",
    a: "Your student ID card and your claim number (it looks like CL-123456). Staff check that the ID matches the account that made the claim before handing anything over.",
  },
  {
    id: "who-sees",
    q: "Who can see what I write in a claim?",
    a: "Only the help desk staff reviewing it. Your answers never appear on the public register, and they aren't copied into the audit log.",
  },
  {
    id: "rejected",
    q: "My claim was not approved. What now?",
    a: "Open the claim from My claims — staff always write a short reason. If another student's claim was approved first, yours is closed automatically. If you're sure it's yours, visit the help desk in person with your student ID and quote your claim number.",
  },
  {
    id: "withdraw",
    q: "I found my item somewhere else. Can I cancel my claim?",
    a: "Yes, while it's still waiting for review. Open the claim and press “Withdraw this claim”. If you change your mind and the item is still on the rack, you can claim it again.",
  },
  {
    id: "updates",
    q: "How will I know when something changes?",
    a: "A red number appears next to My claims when a claim is approved, rejected or handed back. Open the claim to clear it.",
  },
  {
    id: "reserved",
    q: "The item says “Reserved”.",
    a: "Staff approved a claim for it and it's waiting to be collected. If you believe it's yours, talk to the help desk.",
  },
  {
    id: "kept",
    q: "How long are records kept?",
    a: "Records stay on file even after an item is returned or goes unclaimed, so the desk can answer questions later. Ask the help desk how long physical items are held.",
  },
  {
    id: "password",
    q: "I forgot my password.",
    a: "Visit the help desk with your student ID and they'll help you get back into your account.",
  },
  {
    id: "staff",
    q: "I volunteer at the desk. How do I get an account?",
    a: "Staff accounts are created by a supervisor — you can't sign up for one. Ask your supervisor, then use the Staff / Volunteer tab on the log-in page.",
  },
];

export default function Help() {
  return (
    <div className="container prose-page">
      <header className="register__head">
        <p className="eyebrow mono">Help</p>
        <h1>
          Getting your things <em>back</em>
        </h1>
        <p className="muted">Five steps, from “I lost it” to “it's back in my bag”.</p>
      </header>

      <ol className="stubs stubs--light">
        {STEPS.map((s, i) => (
          <li key={s.title} className="stub">
            <p className="stub__no mono">Step {String(i + 1).padStart(2, "0")}</p>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>

      <div className="hero__actions">
        <Link to="/items" className="btn btn--stamp">Search the register →</Link>
        <Link to="/privacy" className="btn btn--ghost">How we handle your details</Link>
      </div>

      <section className="faq">
        <h2>Questions</h2>
        {FAQ.map((f) => (
          <details key={f.id} id={f.id} className="faq__item">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
