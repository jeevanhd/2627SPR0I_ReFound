import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import Logo from "./Logo.jsx";
import { CLAIMS_CHANGED } from "../services/events.js";
import { getClaimUpdates } from "../services/itemsService.js";

/** Number of claim outcomes the signed-in student hasn't seen yet. */
function useUnseenCount(user, pathname) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (user?.role !== "student") {
      setCount(0);
      return undefined;
    }
    let active = true;
    const refresh = () =>
      getClaimUpdates()
        .then((updates) => active && setCount(updates.length))
        .catch(() => active && setCount(0));
    refresh();
    // Staff decide claims elsewhere, so also re-check when the tab regains focus and every minute.
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener(CLAIMS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(CLAIMS_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [user, pathname]);
  return count;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const isStaff = user?.role === "staff" || user?.role === "supervisor";
  const unseen = useUnseenCount(user, pathname);

  // Close the mobile menu whenever the page changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function handleLogout() {
    logout();
    navigate("/");
  }

  const links = [{ to: "/items", label: "Register" }];
  if (user?.role === "student") {
    links.push({ to: "/welcome", label: "Home" }, { to: "/claims", label: "My claims", end: false, badge: unseen });
  }
  if (isStaff) {
    links.push(
      { to: "/staff", label: "Desk", end: true },
      { to: "/staff/items", label: "Items" },
      { to: "/staff/claims", label: "Claims" }
    );
    if (user.role === "supervisor") links.push({ to: "/staff/logbook", label: "Logbook" });
  }

  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link to={isStaff ? "/staff" : "/"} className="brand" aria-label="Refound home">
          <Logo />
          <span className="brand__name">
            Re<em>found</em>
          </span>
          <span className="brand__desk">{isStaff ? (user.role === "supervisor" ? "Supervisor" : "Staff desk") : "Desk No. 04"}</span>
        </Link>

        <button
          type="button"
          className="nav__toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          <span className="nav__toggle-text">{open ? "Close" : "Menu"}</span>
        </button>

        <nav id="main-nav" className={`nav__links${open ? " is-open" : ""}`} aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={`nav__link${l.badge ? " nav__link--badge" : ""}`}>
              {l.label}
              {l.badge > 0 && (
                <span className="badge" aria-label={`${l.badge} new update${l.badge === 1 ? "" : "s"}`}>
                  {l.badge}
                </span>
              )}
            </NavLink>
          ))}
          {user ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
              Log out
            </button>
          ) : (
            <>
              <NavLink to="/login" className="nav__link">
                Log in
              </NavLink>
              <Link to="/signup" className="btn btn--ink btn--sm">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
