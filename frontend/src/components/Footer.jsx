import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p className="footer__brand">
          Re<em>found</em> <span className="mono">— the campus lost &amp; found register</span>
        </p>
        <nav className="footer__links mono small" aria-label="Footer">
          <Link to="/help">Help</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
