/**
 * api.js — central API helper
 *
 * Use API_BASE for client-side fetch calls to the Express scraper backend.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_SCRAPER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

let csrfToken = null;

export async function fetchApi(endpoint, options = {}) {
  // Fetch CSRF token if not loaded
  if (!csrfToken && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
    try {
      const res = await fetch(`${API_BASE}/api/csrf-token`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        csrfToken = data.csrfToken;
      }
    } catch (err) {
      console.warn("Failed to fetch CSRF token", err);
    }
  }

  const headers = new Headers(options.headers || {});
  if (csrfToken && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  // Include credentials for CSRF cookies
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });
}
