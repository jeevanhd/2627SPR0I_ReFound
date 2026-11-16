import { Link, useLocation } from "react-router-dom";

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="container detail">
      <div className="empty empty--tall">
        <p className="stamp stamp--big" aria-hidden="true">Not on file</p>
        <p className="mono huge">404</p>
        <h1 className="empty__title">This page isn't on the rack.</h1>
        <p className="muted">
          Nothing lives at <span className="mono">{pathname}</span>. It may have moved, or the link has a typo.
        </p>
        <div className="hero__actions hero__actions--center">
          <Link to="/" className="btn btn--ink">Go home</Link>
          <Link to="/items" className="btn btn--ghost">Search the register</Link>
        </div>
      </div>
    </div>
  );
}
