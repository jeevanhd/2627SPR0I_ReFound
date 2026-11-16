import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Welcome from "./pages/Welcome.jsx";
import Browse from "./pages/Browse.jsx";
import ItemDetail from "./pages/ItemDetail.jsx";
import Claim from "./pages/Claim.jsx";
import MyClaims from "./pages/MyClaims.jsx";
import ClaimDetail from "./pages/ClaimDetail.jsx";
import Help from "./pages/Help.jsx";
import Privacy from "./pages/Privacy.jsx";
import NotFound from "./pages/NotFound.jsx";
import StaffDesk from "./pages/staff/StaffDesk.jsx";
import Inventory from "./pages/staff/Inventory.jsx";
import StaffItem from "./pages/staff/StaffItem.jsx";
import RegisterItem from "./pages/staff/RegisterItem.jsx";
import ReviewClaims from "./pages/staff/ReviewClaims.jsx";
import Logbook from "./pages/staff/Logbook.jsx";

const STAFF = ["staff", "supervisor"];

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

const guard = (element, role) => <ProtectedRoute role={role}>{element}</ProtectedRoute>;

export default function App() {
  const { pathname } = useLocation();

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to content</a>
      <ScrollToTop />
      <Navbar />
      <main className="main" id="main">
        <ErrorBoundary key={pathname}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/items" element={<Browse />} />
            <Route path="/items/:ref" element={<ItemDetail />} />
            <Route path="/help" element={<Help />} />
            <Route path="/privacy" element={<Privacy />} />

            {/* Students */}
            <Route path="/welcome" element={guard(<Welcome />)} />
            <Route path="/items/:ref/claim" element={guard(<Claim />, "student")} />
            <Route path="/claims" element={guard(<MyClaims />, "student")} />
            <Route path="/claims/:id" element={guard(<ClaimDetail />, "student")} />

            {/* Staff and supervisors */}
            <Route path="/staff" element={guard(<StaffDesk />, STAFF)} />
            <Route path="/staff/items" element={guard(<Inventory />, STAFF)} />
            <Route path="/staff/items/new" element={guard(<RegisterItem />, STAFF)} />
            <Route path="/staff/items/:ref" element={guard(<StaffItem />, STAFF)} />
            <Route path="/staff/claims" element={guard(<ReviewClaims />, STAFF)} />
            <Route path="/staff/logbook" element={guard(<Logbook />, "supervisor")} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
