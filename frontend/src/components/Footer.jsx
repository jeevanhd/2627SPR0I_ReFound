import { Link } from "react-router-dom";
import { resetDemoData } from "../services/mockDb.js";

export default function Footer() {
  function handleReset() {
    if (window.confirm("Clear all demo accounts, claims and logged items in this browser?")) {
      resetDemoData();
      window.location.assign("/");
    }
  }

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p className="footer__brand">
          Re<em>found</em> <span className="mono">— the campus lost &amp; found register</span>
        </p>
        <nav className="footer__links mono small" aria-label="Footer">
          <Link to="/help">Help</Link>
          <Link to="/privacy">Privacy</Link>
          {import.meta.env.DEV && (
            <button type="button" className="footer__reset" onClick={handleReset}>
              Reset demo data
            </button>
          )}
        </nav>
      </div>
    </footer>
  );
}
