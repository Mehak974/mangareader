/**
 * api.js — central API helper
 *
 * Use API_BASE for client-side fetch calls to the Express scraper backend.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_SCRAPER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

export function proxyImage(url, width = null, quality = null) {
  if (!url || url.startsWith('/') || url.includes('/api/proxy-image')) return url;
  
  let target = `${API_BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
  if (width) target += `&w=${width}`;
  if (quality) target += `&q=${quality}`;
  return target;
}

let csrfToken = null;

export async function fetchHomeSection(sectionKey) {
  const res = await fetch(`${API_BASE}/api/home/sections/${encodeURIComponent(sectionKey)}`, {
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch home section ${sectionKey}: ${res.status} - ${text}`);
  }
  return res.json();
}

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
