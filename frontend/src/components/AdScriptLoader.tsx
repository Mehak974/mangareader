'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Routes where ads must NEVER fire.
const EXCLUDED_PATHS = ['/aads', '/aads300', '/mangaread-sticky', '/mangaread-300', '/admin', '/login', '/signup'];

// ── Network Configurations ─────────────────────────────────────────
const HILLTOP_SRC_MAIN = '//purple-text.com/cVDF9c6.bC2T5tlRS/WjQQ9bNgzLMgyWM/DBUByhOAS-0e3/MgzFIBwgNWTEM/zZ';
const HILLTOP_SRC_READ = '//purple-text.com/cyDP9.6nbb2R5-lxS/WBQU9ONdzVMNyENjTgU/zAMXyy0J3nMczdIh1INwTuMl3F';
const ADSTERRA_SRC     = 'https://pl30844032.profitableratecpmnetwork.com/90/5d/47/905d4791e244975132854b89993a6975.js';

function getHilltopSrc(): string {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (h.includes('mangaread.pro')) return HILLTOP_SRC_READ;
  }
  return HILLTOP_SRC_MAIN;
}

// ── Waterfall Schedule (Sequential 4-Pop Cycle) ─────────────────────
// Pop 1: Hilltop  -->  Pop 2: Adsterra  -->  Pop 3: Hilltop  -->  Pop 4: Adsterra
const STAGE_INTERVAL_MS = 50 * 1000; // 50 seconds gap between pops
const CYCLE_RESET_MS    = 4 * 60 * 60 * 1000; // 4-hour session reset (monetizes returning readers without session dilution)

const STORAGE_LAST_POP = 'manga_waterfall_last_pop';
const STORAGE_STAGE    = 'manga_waterfall_stage';

interface AdNetworkConfig {
  name: string;
  inject: () => HTMLScriptElement;
}

const injectHilltop = (): HTMLScriptElement => {
  const s = document.createElement('script');
  (s as any).settings = {};
  s.src = getHilltopSrc();
  s.async = true;
  s.referrerPolicy = 'no-referrer-when-downgrade';
  document.head.appendChild(s);
  return s;
};

const injectAdsterra = (): HTMLScriptElement => {
  const s = document.createElement('script');
  (s as any).settings = {};
  s.src = ADSTERRA_SRC;
  s.async = true;
  s.referrerPolicy = 'no-referrer-when-downgrade';
  document.head.appendChild(s);
  return s;
};

const NETWORKS: AdNetworkConfig[] = [
  { name: 'Hilltop',  inject: injectHilltop },
  { name: 'Adsterra', inject: injectAdsterra },
  { name: 'Hilltop',  inject: injectHilltop },
  { name: 'Adsterra', inject: injectAdsterra },
];

let activeNode: HTMLScriptElement | null = null;
let currentStageLocked = false;
let guardInstalled = false;

// ── Listener Capturing & Purging ───────────────────────────────────
// Captures all event listeners attached by an ad network during its turn,
// then purges them completely once its pop fires so old 60s timers are killed.
type CapturedListener = { target: EventTarget; type: string; listener: any; options?: any };
let capturedListeners: CapturedListener[] = [];
let isCapturing = false;

function startCapturing() {
  if (typeof window === 'undefined' || isCapturing) return;
  isCapturing = true;
  capturedListeners = [];

  const winAdd = window.addEventListener;
  const docAdd = document.addEventListener;

  window.addEventListener = function (type: string, listener: any, options?: any) {
    if (isCapturing && ['click', 'mousedown', 'mouseup', 'pointerdown'].includes(type)) {
      capturedListeners.push({ target: window, type, listener, options });
    }
    return winAdd.call(this, type, listener, options);
  };

  document.addEventListener = function (type: string, listener: any, options?: any) {
    if (isCapturing && ['click', 'mousedown', 'mouseup', 'pointerdown'].includes(type)) {
      capturedListeners.push({ target: document, type, listener, options });
    }
    return docAdd.call(this, type, listener, options);
  };
}

function purgeCurrentNetworkArtifacts() {
  isCapturing = false;

  // 1. Detach all in-memory event listeners registered during this stage
  for (const item of capturedListeners) {
    try {
      item.target.removeEventListener(item.type, item.listener, item.options);
    } catch {}
  }
  capturedListeners = [];

  // 2. Remove all ad network script tags from document head and body
  if (typeof document !== 'undefined') {
    const selectors = [
      'script[src*="purple-text"]',
      'script[src*="untimely-promotion"]',
      'script[src*="quizzical-topic"]',
      'script[src*="elderly-craft"]',
      'script[src*="profitableratecpmnetwork"]',
    ];
    document.querySelectorAll(selectors.join(',')).forEach((el) => {
      try { el.remove(); } catch {}
    });
  }
}

// ── Network Caller Signature Verification ───────────────────────────
// Verifies that the script calling window.open actually belongs to the active stage
function isCallerMatchingStage(targetStage: number, url: string, stack: string): boolean {
  const target = NETWORKS[targetStage]?.name;
  if (!target) return false;

  const urlStr = (url || '').toLowerCase();
  const stackStr = (stack || '').toLowerCase();

  if (target === 'Hilltop') {
    // If it clearly belongs to Adsterra, reject it
    if (urlStr.includes('profitableratecpmnetwork') || stackStr.includes('profitableratecpmnetwork')) return false;
    return true;
  }

  if (target === 'Adsterra') {
    // Reject rogue Hilltop ghost timers trying to hijack Adsterra's slot
    if (
      urlStr.includes('purple-text') ||
      urlStr.includes('untimely-promotion') ||
      urlStr.includes('quizzical-topic') ||
      stackStr.includes('purple-text') ||
      stackStr.includes('untimely-promotion')
    ) {
      return false;
    }
    return true;
  }

  return true;
}

// ── Anti-Hijack Guard ──────────────────────────────────────────────
function installAntiHijackGuard(onPopFired: () => void) {
  if (guardInstalled || typeof window === 'undefined') return;
  guardInstalled = true;

  const originalOpen = window.open;

  window.open = function (...args: any[]) {
    const lastPop = Number(localStorage.getItem(STORAGE_LAST_POP) || 0);
    const now = Date.now();

    // 1. If 24 hours passed, reset cycle to 0
    if (lastPop && now - lastPop > CYCLE_RESET_MS) {
      localStorage.setItem(STORAGE_STAGE, '0');
      currentStageLocked = false;
    }

    const currentStage = Number(localStorage.getItem(STORAGE_STAGE) || 0);

    // 2. HARD LOCK: If all networks have completed for this 24-hour cycle, BLOCK EVERYTHING!
    if (currentStage >= NETWORKS.length) {
      console.warn(`[AdGuard] Blocked popunder: All ${NETWORKS.length} networks already completed for this 24-hour cycle`);
      return null;
    }

    // 3. If cooldown is active or current stage has already fired, BLOCK IT!
    if (currentStageLocked || (lastPop && now - lastPop < STAGE_INTERVAL_MS)) {
      console.warn('[AdGuard] Blocked unauthorized popunder attempt during cooldown');
      return null;
    }

    // 4. Verify that this call actually belongs to the active network (blocks Hilltop 60s ghost timers)
    const openedUrl = String(args[0] || '');
    const callStack = new Error().stack || '';
    if (!isCallerMatchingStage(currentStage, openedUrl, callStack)) {
      console.warn(`[AdGuard] Blocked rogue ghost popunder from a previous network. Expected: ${NETWORKS[currentStage]?.name}`);
      return null;
    }

    // Allowed pop: Let it open and lock the stage
    currentStageLocked = true;
    console.log(`[AdGuard] Authorized popunder opened for Stage ${currentStage + 1}/${NETWORKS.length} (${NETWORKS[currentStage]?.name}). Advancing waterfall.`);
    onPopFired();
    return originalOpen.apply(window, args as any);
  };
}

export default function AdScriptLoader() {
  const pathname = usePathname();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Block ads on excluded routes
    if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) {
      if (activeNode) {
        try { activeNode.remove(); } catch {}
        activeNode = null;
      }
      return;
    }

    const scheduleInject = (delayMs: number, targetStage: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (targetStage >= NETWORKS.length) return;

      timeoutRef.current = setTimeout(() => {
        // Unlock guard for this specific network's turn
        currentStageLocked = false;

        const network = NETWORKS[targetStage];
        if (network && !activeNode) {
          console.log(`[AdWaterfall] Loading Stage ${targetStage + 1}/${NETWORKS.length}: ${network.name}`);
          startCapturing();
          activeNode = network.inject();
          activeNode.onerror = () => {
            console.error(`[AdWaterfall] Failed to load ${network.name}`);
            purgeCurrentNetworkArtifacts();
            activeNode = null;
          };
        }
      }, Math.max(delayMs, 100));
    };

    // 2. Install Anti-Hijack Guard
    installAntiHijackGuard(() => {
      const now = Date.now();
      localStorage.setItem(STORAGE_LAST_POP, now.toString());

      const currentStage = Number(localStorage.getItem(STORAGE_STAGE) || 0);
      const nextStage = currentStage + 1;
      localStorage.setItem(STORAGE_STAGE, nextStage.toString());

      // Purge all listeners and scripts associated with this stage immediately
      purgeCurrentNetworkArtifacts();
      activeNode = null;

      // Automatically queue the next network after the 75s interval
      if (nextStage < NETWORKS.length) {
        console.log(`[AdWaterfall] Scheduling next network (${NETWORKS[nextStage].name}) in ${STAGE_INTERVAL_MS / 1000}s`);
        scheduleInject(STAGE_INTERVAL_MS, nextStage);
      } else {
        console.log('[AdWaterfall] All networks completed for this 24-hour cycle.');
      }
    });

    // 3. Determine Waterfall Stage
    const lastPop = Number(localStorage.getItem(STORAGE_LAST_POP) || 0);
    const now = Date.now();
    let stage = Number(localStorage.getItem(STORAGE_STAGE) || 0);

    // If whole cycle completed and reset time passed, reset to 0
    if (lastPop && now - lastPop > CYCLE_RESET_MS) {
      stage = 0;
      localStorage.setItem(STORAGE_STAGE, '0');
    }

    // If we've completed all networks in the waterfall (Hilltop, Adsterra, Monetag), stop!
    if (stage >= NETWORKS.length) {
      return;
    }

    // 4. Check Cooldown between stages (60-90s)
    const timeSinceLast = now - lastPop;
    const remainingCooldown = STAGE_INTERVAL_MS - timeSinceLast;

    if (lastPop === 0 || remainingCooldown <= 0) {
      // Ready for current stage pop on interaction/idle
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => scheduleInject(0, stage));
      } else {
        scheduleInject(200, stage);
      }
    } else {
      // Still in cooldown: Wait for cooldown before loading next network
      scheduleInject(remainingCooldown, stage);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pathname]);

  return null;
}


