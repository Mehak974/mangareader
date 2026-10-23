'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Routes where ads must NEVER fire.
const EXCLUDED_PATHS = ['/aads', '/aads300', '/mangaread-sticky', '/mangaread-300', '/admin', '/login', '/signup'];

// ── Multi-Domain Network Configurations ─────────────────────────────
interface DomainAdConfig {
  hilltopPop: string;
  adsterraPop: string;
  adsterraSocialBar: string;
}

const DOMAIN_ADS: Record<string, DomainAdConfig> = {
  'mangareader.pro': {
    hilltopPop: '//purple-text.com/cVDF9c6.bC2T5tlRS/WjQQ9bNgzLMgyWM/DBUByhOAS-0e3/MgzFIBwgNWTEM/zZ',
    adsterraPop: 'https://pl30844032.profitableratecpmnetwork.com/90/5d/47/905d4791e244975132854b89993a6975.js',
    adsterraSocialBar: 'https://pl31917680.profitableratecpmnetwork.com/81/54/91/815491afa1ed9cdee8235b34c6f2cf6b.js',
  },
  'mangaread.pro': {
    hilltopPop: '//purple-text.com/cjDK9y6.bF2a5eluSWW/Qt9tNezsMiykNCTZUTzXMly_0-3AMFzmIL1ZN/TRMI3c',
    adsterraPop: 'https://abscloud.org/1/7b7d010eb7fd655ac5200b25dff46189',
    adsterraSocialBar: 'https://bauval.org/14/bbbcaaedb9462b6e29aa7a475bc1cdfc',
  },
  'manireader.online': {
    hilltopPop: '//purple-text.com/czDm9B6.be2V5BlhS/WVQN9LN/zTQt0CNYD/QF2/MlSB0L3/NZDbQ/0JNoDbYy1L',
    adsterraPop: 'https://abscloud.org/1/17fa2a0abb1619ea7086df42c7fa7d40',
    adsterraSocialBar: 'https://bauval.org/14/a4d5830ab740fb42a37d9777427ee81e',
  },
};

function getActiveAdConfig(): DomainAdConfig {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    for (const [domain, cfg] of Object.entries(DOMAIN_ADS)) {
      if (h.includes(domain)) return cfg;
    }
  }
  return DOMAIN_ADS['mangareader.pro'];
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
  s.src = getActiveAdConfig().hilltopPop;
  s.async = true;
  s.referrerPolicy = 'no-referrer-when-downgrade';
  document.head.appendChild(s);
  return s;
};

const injectAdsterra = (): HTMLScriptElement => {
  const s = document.createElement('script');
  (s as any).settings = {};
  s.src = getActiveAdConfig().adsterraPop;
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
const failedStages = new Set<number>();

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
      'script[src*="pl30844032"]',
      'script[src*="abscloud.org"]',
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
    // If it clearly belongs to Adsterra popunder, reject it
    if (
      urlStr.includes('pl30844032') || stackStr.includes('pl30844032') ||
      urlStr.includes('abscloud.org') || stackStr.includes('abscloud.org')
    ) return false;
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

    const openedUrl = String(args[0] || '');
    const callStack = new Error().stack || '';

    // Whitelist Social Bar clicks: Direct clicks on Social Bar in-page elements should open without popunder restrictions
    if (
      callStack.includes('815491afa1ed9cdee8235b34c6f2cf6b') || callStack.includes('pl31917680') ||
      callStack.includes('bauval.org') || callStack.includes('bbbcaaedb9462b6e') || callStack.includes('a4d5830ab740fb42')
    ) {
      return originalOpen.apply(window, args as any);
    }

    // 4. Verify that this call actually belongs to the active network (blocks Hilltop 60s ghost timers)
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
    const cfg = getActiveAdConfig();

    // 1. Block ads on excluded routes
    if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) {
      if (activeNode) {
        try { activeNode.remove(); } catch {}
        activeNode = null;
      }
      const sb = document.querySelector('script[src*="815491afa1ed9cdee8235b34c6f2cf6b"], script[src*="bauval.org"]');
      if (sb) {
        try { sb.remove(); } catch {}
      }
      return;
    }

    // 2. Mount Social Bar (In-Page Push) once per session
    if (typeof document !== 'undefined' && !document.querySelector('script[src*="815491afa1ed9cdee8235b34c6f2cf6b"], script[src*="bauval.org"]')) {
      const sb = document.createElement('script');
      sb.src = cfg.adsterraSocialBar;
      sb.async = true;
      document.head.appendChild(sb);
    }

    const scheduleInject = (delayMs: number, targetStage: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      while (targetStage < NETWORKS.length && failedStages.has(targetStage)) {
        targetStage++;
      }
      if (targetStage >= NETWORKS.length) return;

      timeoutRef.current = setTimeout(() => {
        // Unlock guard for this specific network's turn
        currentStageLocked = false;

        while (targetStage < NETWORKS.length && failedStages.has(targetStage)) {
          targetStage++;
        }
        if (targetStage >= NETWORKS.length) return;

        const network = NETWORKS[targetStage];
        if (network && !activeNode) {
          startCapturing();
          activeNode = network.inject();
          activeNode.onerror = () => {
            failedStages.add(targetStage);
            purgeCurrentNetworkArtifacts();
            activeNode = null;
            const nextStage = targetStage + 1;
            localStorage.setItem(STORAGE_STAGE, nextStage.toString());
            if (nextStage < NETWORKS.length) {
              scheduleInject(500, nextStage);
            }
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
        scheduleInject(STAGE_INTERVAL_MS, nextStage);
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

    // Skip any stages that failed or were blocked by client/adblocker
    while (stage < NETWORKS.length && failedStages.has(stage)) {
      stage++;
    }

    // If we've completed or skipped all networks in the waterfall, stop!
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


