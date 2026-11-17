// Auth against the real API.
//
// The exported functions are the same ones the screens already call, so no page
// changed when the mock was replaced. The token comes back from the API and is
// held by api/client.js; only the public profile is kept here.

import { api, setToken } from "../api/client.js";

const SESSION_KEY = "refound.session";

/** Register a student. Resolves with the new user's public profile. */
export async function signup({ name, studentId, email, password }) {
  const { user, token } = await api("/api/auth/signup", {
    method: "POST",
    body: { name, studentId, email, password },
  });
  setToken(token);
  return user;
}

/** Log in as a student or staff member. Resolves with the user's public profile. */
export async function login({ email, password, role }) {
  const { user, token } = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

  // The API decides the role. A student account cannot come in through the staff tab.
  if (role === "staff" && user.role === "student") {
    setToken(null);
    throw new Error("Staff accounts are created by the help desk. Check your email or contact your supervisor.");
  }

  setToken(token);
  return user;
}

export function saveSession(user) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  setToken(null);
}
