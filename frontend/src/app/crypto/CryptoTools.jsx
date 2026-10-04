/**
 * Client-side widgets for /crypto.
 *
 * Split out of page.js so the page itself stays a server component. Every
 * widget degrades cleanly: the market board falls back to a "feed
 * unavailable" state instead of rendering stale numbers, and the calculators
 * are pure arithmetic on local state — no network, no accounts, no wallet
 * connections, nothing ever leaves the browser.
 */
"use client";

import { useEffect, useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/* formatting helpers                                                  */
/* ------------------------------------------------------------------ */

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatUsd(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value >= 1000 ? usdFmt.format(value) : `$${value.toFixed(2)}`;
}

function formatPct(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function clampNumber(raw, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  const parsed = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/* ------------------------------------------------------------------ */
/* market board                                                        */
/* ------------------------------------------------------------------ */

const TRACKED_COINS = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  { id: "solana", name: "Solana", symbol: "SOL" },
  { id: "binancecoin", name: "BNB", symbol: "BNB" },
  { id: "ripple", name: "XRP", symbol: "XRP" },
  { id: "cardano", name: "Cardano", symbol: "ADA" },
  { id: "dogecoin", name: "Dogecoin", symbol: "DOGE" },
  { id: "avalanche-2", name: "Avalanche", symbol: "AVAX" },
  { id: "chainlink", name: "Chainlink", symbol: "LINK" },
  { id: "polkadot", name: "Polkadot", symbol: "DOT" },
];

const REFRESH_MS = 60_000;

function Sparkline({ prices }) {
  if (!Array.isArray(prices) || prices.length < 2) return null;

  const w = 120;
  const h = 30;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const rising = prices[prices.length - 1] >= prices[0];
  const points = prices
    .map((p, i) => `${((i / (prices.length - 1)) * w).toFixed(2)},${(h - ((p - min) / span) * h).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      style={{ display: "block", width: "100%", maxWidth: `${w}px` }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={rising ? "var(--green)" : "var(--red)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MarketBoard() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      const ids = TRACKED_COINS.map((c) => c.id).join(",");
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`;

      try {
        const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (!Array.isArray(data) || data.length === 0) throw new Error("empty payload");
        setRows(data);
        setUpdatedAt(new Date());
        setStatus("ok");
      } catch {
        if (cancelled) return;
        setStatus("error");
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="crypto-widget">
      <div className="crypto-widget-hd">
        <h3>Market snapshot</h3>
        <span className="crypto-widget-meta">
          {status === "ok" && updatedAt
            ? `Live · updated ${updatedAt.toLocaleTimeString()}`
            : status === "error"
              ? "Feed unavailable"
              : "Loading live data…"}
        </span>
      </div>

      {status === "error" && (
        <p className="crypto-note">
          The market feed is not responding, so prices are left blank rather than stale. Everything
          else on this page works without it.
        </p>
      )}

      <div className="crypto-table-wrap">
        <table className="crypto-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Price (USD)</th>
              <th>24h</th>
              <th>Market cap</th>
              <th>7-day trend</th>
            </tr>
          </thead>
          <tbody>
            {(rows.length ? rows : TRACKED_COINS.map((c) => ({ ...c, current_price: null }))).map((coin) => {
              const change = coin.price_change_percentage_24h;
              const rising = typeof change === "number" && change >= 0;
              return (
                <tr key={coin.id}>
                  <td>
                    <strong>{coin.name ?? coin.symbol}</strong>{" "}
                    <span style={{ color: "var(--text3)", fontSize: "12px" }}>{String(coin.symbol).toUpperCase()}</span>
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(coin.current_price)}</td>
                  <td
                    style={{
                      color: typeof change !== "number" ? "var(--text3)" : rising ? "var(--green)" : "var(--red)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatPct(change)}
                  </td>
                  <td style={{ color: "var(--text2)" }}>
                    {typeof coin.market_cap === "number" ? `$${compactFmt.format(coin.market_cap)}` : "—"}
                  </td>
                  <td style={{ minWidth: "120px" }}>
                    <Sparkline prices={coin.sparkline_in_7d?.price} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="crypto-note">
        Prices are pulled client-side from the public CoinGecko markets endpoint, refresh every 60
        seconds, and are here for reference. Not a quote, not a recommendation.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* growth planner                                                      */
/* ------------------------------------------------------------------ */

export function GrowthPlanner() {
  const [lumpSum, setLumpSum] = useState("1000");
  const [monthly, setMonthly] = useState("100");
  const [years, setYears] = useState("5");
  const [annualPct, setAnnualPct] = useState("18");

  const result = useMemo(() => {
    const principal = clampNumber(lumpSum, { max: 1e9 });
    const perMonth = clampNumber(monthly, { max: 1e8 });
    const horizon = Math.round(clampNumber(years, { max: 60 }));
    const annual = clampNumber(annualPct, { max: 1000 }) / 100;
    const monthlyRate = Math.pow(1 + annual, 1 / 12) - 1;

    const schedule = [];
    let value = principal;
    let invested = principal;

    for (let year = 1; year <= horizon; year += 1) {
      for (let month = 0; month < 12; month += 1) {
        value = (value + perMonth) * (1 + monthlyRate);
        invested += perMonth;
      }
      schedule.push({ year, invested, value });
    }

    return {
      schedule,
      finalValue: value,
      totalInvested: invested,
      gain: value - invested,
      multiple: invested > 0 ? value / invested : 0,
      // Rule of 72: how many years a 1% gain compounds into a 100% gain.
      doubleYears: annual > 0 ? 72 / (annual * 100) : Infinity,
    };
  }, [lumpSum, monthly, years, annualPct]);

  return (
    <div className="crypto-widget">
      <div className="crypto-widget-hd">
        <h3>Position growth planner</h3>
        <span className="crypto-widget-meta">compounds monthly, locally computed</span>
      </div>

      <div className="crypto-inputs">
        <label>
          Starting amount (USD)
          <input
            className="crypto-input"
            inputMode="numeric"
            value={lumpSum}
            onChange={(e) => setLumpSum(e.target.value)}
          />
        </label>
        <label>
          Added every month (USD)
          <input
            className="crypto-input"
            inputMode="numeric"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
        </label>
        <label>
          Time horizon (years)
          <input
            className="crypto-input"
            inputMode="numeric"
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
        </label>
        <label>
          Annual return (%)
          <input
            className="crypto-input"
            inputMode="numeric"
            value={annualPct}
            onChange={(e) => setAnnualPct(e.target.value)}
          />
        </label>
      </div>

      <div className="crypto-stats">
        <div className="crypto-stat">
          <span>Projected value</span>
          <strong>{usdFmt.format(result.finalValue)}</strong>
        </div>
        <div className="crypto-stat">
          <span>Total contributed</span>
          <strong>{usdFmt.format(result.totalInvested)}</strong>
        </div>
        <div className="crypto-stat">
          <span>Modeled gain</span>
          <strong style={{ color: result.gain >= 0 ? "var(--green)" : "var(--red)" }}>
            {usdFmt.format(result.gain)}
          </strong>
        </div>
        <div className="crypto-stat">
          <span>Return multiple</span>
          <strong>{result.multiple.toFixed(2)}×</strong>
        </div>
      </div>

      <p className="crypto-note">
        At that rate the money roughly doubles every {Number.isFinite(result.doubleYears) ? result.doubleYears.toFixed(1) : "—"} years
        (Rule of 72). Real returns do not arrive on a smooth curve like this one. The compounding
        works in both directions.
      </p>

      <div className="crypto-table-wrap">
        <table className="crypto-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Contributed</th>
              <th>Value</th>
              <th>Gain</th>
            </tr>
          </thead>
          <tbody>
            {result.schedule.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{usdFmt.format(row.invested)}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{usdFmt.format(row.value)}</td>
                <td
                  style={{
                    color: row.value - row.invested >= 0 ? "var(--green)" : "var(--red)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {usdFmt.format(row.value - row.invested)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* halving countdown                                                   */
/* ------------------------------------------------------------------ */

const HALVING_INTERVAL = 210_000;
const LAST_HALVING_BLOCK = 840_000;
const LAST_HALVING_MS = Date.UTC(2024, 3, 20, 19, 9);
const BLOCK_MS = 10 * 60 * 1000;
const BLOCKS_PER_DAY = (24 * 60 * 60 * 1000) / BLOCK_MS;
const MAX_SUPPLY = 21_000_000;

function estimateHeight(now) {
  const elapsed = Math.max(0, now - LAST_HALVING_MS);
  return LAST_HALVING_BLOCK + Math.floor(elapsed / BLOCK_MS);
}

function minedSupply(height) {
  const fullEpochs = Math.floor(height / HALVING_INTERVAL);
  let total = 0;
  let subsidy = 50;
  for (let i = 0; i < fullEpochs && i < 64; i += 1) {
    total += HALVING_INTERVAL * subsidy;
    subsidy /= 2;
  }
  // Blocks in the current, partially-mined epoch still receive the full subsidy.
  const partial = height - fullEpochs * HALVING_INTERVAL;
  return Math.min(MAX_SUPPLY, total + partial * subsidy);
}

function countdownParts(targetMs, nowMs) {
  if (!Number.isFinite(targetMs)) return null;
  const diff = targetMs - nowMs;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    done: false,
  };
}

export function HalvingCountdown() {
  const [now, setNow] = useState(() => Date.now());
  const [height, setHeight] = useState(null);
  const [heightSource, setHeightSource] = useState("estimate");

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadHeight() {
      try {
        const res = await fetch("https://mempool.space/api/blocks/tip/height", {
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const height = await res.json();
        if (cancelled) return;
        if (typeof height !== "number") throw new Error("unexpected payload");
        setHeight(height);
        setHeightSource("live");
      } catch {
        if (!cancelled) setHeight(estimateHeight(Date.now()));
      }
    }

    loadHeight();
    const timer = setInterval(loadHeight, 5 * 60_000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  const stats = useMemo(() => {
    const currentHeight = height ?? estimateHeight(now);
    const nextBlock = Math.ceil(currentHeight / HALVING_INTERVAL) * HALVING_INTERVAL + HALVING_INTERVAL;
    const blocksLeft = Math.max(0, nextBlock - currentHeight);
    const etaMs = now + blocksLeft * BLOCK_MS;
    const mined = minedSupply(Math.floor(currentHeight));
    return {
      currentHeight,
      nextBlock,
      blocksLeft,
      countdown: countdownParts(etaMs, now),
      mined,
      percent: (mined / MAX_SUPPLY) * 100,
      remaining: MAX_SUPPLY - mined,
    };
  }, [height, now]);

  const c = stats.countdown;

  return (
    <div className="crypto-widget">
      <div className="crypto-widget-hd">
        <h3>Bitcoin supply &amp; next halving</h3>
        <span className="crypto-widget-meta">
          block {stats.currentHeight.toLocaleString("en-US")} · {heightSource === "live" ? "live chain tip" : "estimated from block time"}
        </span>
      </div>

      <div className="crypto-stats">
        <div className="crypto-stat">
          <span>Next halving block</span>
          <strong>{stats.nextBlock.toLocaleString("en-US")}</strong>
        </div>
        <div className="crypto-stat">
          <span>Blocks remaining</span>
          <strong>~{stats.blocksLeft.toLocaleString("en-US")}</strong>
        </div>
        <div className="crypto-stat">
          <span>Mined so far</span>
          <strong>{compactFmt.format(stats.mined)} BTC</strong>
        </div>
        <div className="crypto-stat">
          <span>Still unmined</span>
          <strong>{compactFmt.format(stats.remaining)} BTC</strong>
        </div>
      </div>

      <div className="crypto-progress" role="img" aria-label={`${stats.percent.toFixed(1)} percent of the 21 million supply has been mined`}>
        <div className="crypto-progress-fill" style={{ width: `${stats.percent.toFixed(2)}%` }} />
      </div>
      <p className="crypto-note">
        {stats.percent.toFixed(1)}% of the fixed 21,000,000 BTC supply has been mined. Roughly 97%
        of it already exists, and the last coins are not expected until well after 2100.
      </p>

      {c?.done ? (
        <p className="crypto-note">The next halving block has been reached — refresh for the new epoch.</p>
      ) : (
        <p className="crypto-countdown">
          <span>{c.days.toLocaleString("en-US")}d</span>
          <span>{String(c.hours).padStart(2, "0")}h</span>
          <span>{String(c.minutes).padStart(2, "0")}m</span>
          <span>{String(c.seconds).padStart(2, "0")}s</span>
        </p>
      )}

      <p className="crypto-note">
        Each halving cuts the block subsidy for new miners in half. The last one took it from 6.25
        to 3.125 BTC. Issuance halves roughly every 210,000 blocks, which works out to about four
        years. This countdown assumes a steady 10-minute block, so treat the date as an estimate.
        Real halvings drift with network hashrate.
      </p>
    </div>
  );
}
