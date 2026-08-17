/**
 * clientProxy.js — fetch external URLs from the browser with multi-proxy fallback.
 */

const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
  (url) => `https://jsonp.afeld.me/?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.betterfly.workers.dev/${encodeURIComponent(url)}`,
  (url) => `https://proxy.cors.sh/${encodeURIComponent(url)}`,
  (url) => `https://cors-proxy.vercel.app/${encodeURIComponent(url)}`,
  (url) => `https://api.corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://cors-anywhere.herokuapp.com/${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.vercel.app/${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
];

const PROXY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

export async function clientFetch(url, options = {}, attempt = 0) {
  const controller = new AbortController();
  const timeout = options.timeout || 15000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...PROXY_HEADERS, ...(options.headers || {}) },
      signal: controller.signal,
      mode: 'cors',
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error(`Request timed out: ${url}`);
    for (let i = 0; i < CORS_PROXIES.length; i++) {
      try {
        const proxyUrl = CORS_PROXIES[i](url);
        const proxyController = new AbortController();
        const proxyTimer = setTimeout(() => proxyController.abort(), timeout);
        const res = await fetch(proxyUrl, {
          ...options,
          headers: { ...PROXY_HEADERS, ...(options.headers || {}) },
          signal: proxyController.signal,
          mode: 'cors',
        });
        clearTimeout(proxyTimer);
        if (res.ok) return res;
      } catch (_) {
        continue;
      }
    }
    throw err;
  }
}

export async function clientFetchHTML(url, extraHeaders = {}) {
  const res = await clientFetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      ...extraHeaders,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

export async function clientFetchJSON(url, extraHeaders = {}) {
  const res = await clientFetch(url, {
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      ...extraHeaders,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}
