import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import Logo from "./Logo.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const isStaff = user?.role === "staff" || user?.role === "supervisor";

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
    links.push({ to: "/welcome", label: "Home" }, { to: "/claims", label: "My claims", end: false });
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
            <NavLink key={l.to} to={l.to} end={l.end} className="nav__link">
              {l.label}
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
