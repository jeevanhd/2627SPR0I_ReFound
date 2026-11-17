// Thin wrapper around fetch for the ReFound API.
//
// VITE_API_URL lets the same build point at a local API or a deployed one. The
// JWT lives in sessionStorage beside the session, and every request carries it —
// what the caller may do is decided by the API, never by the browser.

const BASE_URL = (import.meta.env?.VITE_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const TOKEN_KEY = "refound.token";

export const apiBaseUrl = () => BASE_URL;

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable — the session lasts for this page load only
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  const hasBody = body !== undefined;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(hasBody ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // fetch only rejects when the request never reached the server.
    throw new Error(`Cannot reach the API at ${BASE_URL}. Is the backend running?`);
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.error ?? `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}
