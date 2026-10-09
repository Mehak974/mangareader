'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Routes where ads (popunder & in-page push) must never fire.
// Strictly blocks /aads and admin routes.
const EXCLUDED_PATHS = ['/aads', '/admin', '/login', '/signup'];

// ── Hilltop Ads (served from purple-text.com) ────────────────────────────────
const HILLTOP_POPUNDER_SRC = 'https://purple-text.com/c.DB9/6Cbj2W5VlOSkW-QR9/NAzQM/y/MnDiUkyTOXS/0B3SMNzDIAw-NxTgMszu';
const HILLTOP_INPAGE_PUSH_BASE = 'https://purple-text.com/bJX.VfsbdBG/lw0DYMWRcx/qeZm/9/uCZFUalAkhPSTPc/1NMBDUI/5pNMzhMqt/NmzSUswzMXj/k/3/NTwn';

// Hilltop internal counter storage keys and singleton property
const HILLTOP_STORAGE_KEYS = ['kadPD', 'kadPIP', 'kadPM', 'kadPP'];
const HILLTOP_GLOBAL_FLAG = 'bdd651';

let popunderInjected = false;
let popunderNode: HTMLScriptElement | null = null;
let inpagePushNode: HTMLScriptElement | null = null;

function removePopunder() {
  if (popunderNode) {
    try { popunderNode.remove(); } catch { /* already gone */ }
    popunderNode = null;
  }
  popunderInjected = false;
}

function removeInPagePush() {
  if (inpagePushNode) {
    try { inpagePushNode.remove(); } catch { /* already gone */ }
    inpagePushNode = null;
  }
  if (typeof document !== 'undefined') {
    try {
      // Remove all previously appended in-page push scripts
      document.querySelectorAll('script[src*="purple-text.com/bJX"]').forEach((s) => s.remove());

      // If document.body has scroll-lock or ad classes injected by Hilltop, clean them up
      if (document.body) {
        document.body.classList.remove('▭__block-scroll', '▭_swiping');
        for (const cls of Array.from(document.body.classList)) {
          if (cls.includes('▭') || cls.includes('kadP') || cls.includes('block-scroll')) {
            document.body.classList.remove(cls);
          }
        }
      }

      // Remove ONLY ad DIV containers — NEVER remove document.body, html, or main wrappers!
      const pushEls = document.querySelectorAll(
        'div[class="▭"], div[class^="▭ "], div[class*=" ▭ "], div[class*=" ▭"], div[class*="__push"], div[class*="inpage-push"], div[id*="inpage-push"]'
      );
      pushEls.forEach((el) => {
        if (el === document.body || el === document.documentElement || el.tagName === 'BODY' || el.tagName === 'HTML') {
          return;
        }
        el.remove();
      });
    } catch {}
  }
}

function resetHilltopFrequencyCounters() {
  if (typeof window === 'undefined') return;
  // Clear in-memory singleton guard so the script can re-run on SPA navigation
  try {
    (window as any)[HILLTOP_GLOBAL_FLAG] = undefined;
    (window as any)[HILLTOP_GLOBAL_FLAG] = false;
    delete (window as any)[HILLTOP_GLOBAL_FLAG];
  } catch {}

  // Clear localStorage and sessionStorage frequency caps so in-page push triggers on every page
  try {
    HILLTOP_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (/kad/i.test(k) || /hilltop/i.test(k) || /bdd651/i.test(k))) {
        localStorage.removeItem(k);
      }
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && (/kad/i.test(k) || /hilltop/i.test(k) || /bdd651/i.test(k))) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {}
}

export default function AdScriptLoader() {
  const pathname = usePathname();

  useEffect(() => {
    const isExcluded = EXCLUDED_PATHS.some((p) => pathname.startsWith(p));

    if (isExcluded) {
      removePopunder();
      removeInPagePush();
      return;
    }

    // 1. Popunder: injected once across eligible pages
    if (!popunderInjected) {
      popunderInjected = true;
      const injectPopunder = () => {
        const s = document.createElement('script');
        s.src = HILLTOP_POPUNDER_SRC;
        s.async = true;
        s.referrerPolicy = 'no-referrer-when-downgrade';
        s.onerror = () => {
          removePopunder();
        };
        document.head.appendChild(s);
        popunderNode = s;
      };

      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(injectPopunder);
      } else {
        setTimeout(injectPopunder, 100);
      }
    }

    // 2. In-Page Push: clean old state and load a fresh in-page push on every navigation
    removeInPagePush();
    resetHilltopFrequencyCounters();

    const injectInPagePush = () => {
      if (EXCLUDED_PATHS.some((p) => window.location.pathname.startsWith(p))) return;

      removeInPagePush();
      resetHilltopFrequencyCounters();

      const s = document.createElement('script');
      (s as any).settings = {};
      // Cache-buster parameter forces fresh execution per page navigation
      s.src = `${HILLTOP_INPAGE_PUSH_BASE}?_r=${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      s.onerror = () => {
        removeInPagePush();
      };

      document.head.appendChild(s);
      inpagePushNode = s;
    };

    // Ensure close button clicks dismiss immediately without opening ad redirect tabs
    const handleCloseTrigger = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const closeBtn = target.closest('[class*="__close"], [class*="close"]');
      if (closeBtn) {
        // Target strictly the notification card element, never body or html
        const pushItem = closeBtn.closest('div[class*="__push"]') as HTMLElement | null;
        if (!pushItem || pushItem === document.body || pushItem.tagName === 'BODY') return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Dismiss immediately on click or touchend
        if (e.type === 'click' || e.type === 'touchend') {
          pushItem.style.transition = 'max-height 0.2s ease, opacity 0.2s ease, transform 0.2s ease';
          pushItem.style.maxHeight = '0px';
          pushItem.style.opacity = '0';
          pushItem.style.transform = 'translateY(-100%)';
          setTimeout(() => {
            pushItem.remove();
            const containers = document.querySelectorAll('div[class*="▭"]');
            containers.forEach((c) => {
              if (c === document.body || c === document.documentElement || c.tagName === 'BODY' || c.tagName === 'HTML') return;
              if (!c.querySelector('[class*="__push"]')) c.remove();
            });
            if (document.body) {
              document.body.classList.remove('▭__block-scroll', '▭_swiping');
            }
          }, 200);

          // Reset frequency counters immediately
          resetHilltopFrequencyCounters();

          // After user cancels, automatically trigger another in-page push after 2.5s
          if (cancelReinjectTimer) clearTimeout(cancelReinjectTimer);
          cancelReinjectTimer = setTimeout(() => {
            injectInPagePush();
          }, 2500);
        }
      }
    };

    let cancelReinjectTimer: NodeJS.Timeout | null = null;

    const handlePopState = () => {
      if (cancelReinjectTimer) clearTimeout(cancelReinjectTimer);
      injectInPagePush();
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('pointerdown', handleCloseTrigger, true);
    document.addEventListener('mousedown', handleCloseTrigger, true);
    document.addEventListener('click', handleCloseTrigger, true);
    document.addEventListener('touchend', handleCloseTrigger, true);

    const timer = setTimeout(injectInPagePush, 250);

    return () => {
      clearTimeout(timer);
      if (cancelReinjectTimer) clearTimeout(cancelReinjectTimer);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('pointerdown', handleCloseTrigger, true);
      document.removeEventListener('mousedown', handleCloseTrigger, true);
      document.removeEventListener('click', handleCloseTrigger, true);
      document.removeEventListener('touchend', handleCloseTrigger, true);
    };
  }, [pathname]);

  return null;
}
