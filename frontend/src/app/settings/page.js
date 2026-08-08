"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { ALL_GENRES } from "@/data/mockData";
import Footer from "@/components/Footer";

export default function Settings() {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState("appearance");

  const {
    isDark,
    toggleDark,
    accentColors,
    setAccent,
    isIncognito,
    toggleIncognito,
    isNSFW,
    toggleNSFW,
    userInterests,
    setUserInterests,
    hiddenGenres,
    unhideGenre,
    clearHistory,
    doSignout,
    compactCards,
    setCompactCards,
    reduceMotion,
    setReduceMotion,
    readingDirection,
    setReadingDirection,
    pageFit,
    setPageFit,
    autoAdvance,
    setAutoAdvance,
    preloadPages,
    setPreloadPages,
    savePosition,
    setSavePosition,
  } = useApp();

  const accentSwatches = [
    { c1: "#FFB300", c2: "#FFCA28", label: "Gold" },
    { c1: "#3b82f6", c2: "#60a5fa", label: "Blue" },
    { c1: "#10b981", c2: "#34d399", label: "Green" },
    { c1: "#f59e0b", c2: "#fbbf24", label: "Orange" },
    { c1: "#ef4444", c2: "#f87171", label: "Red" },
  ];

  const handleInterestToggle = (g) => {
    setUserInterests((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const handleSignOut = () => {
    doSignout();
    router.push("/");
  };

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  React.useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsStandalone(true);
    }
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    } else {
      alert("To install the app, tap the Share icon on your browser and select 'Add to Home Screen'.");
    }
  };

  return (
    <div>
      <div className="section" style={{ paddingBottom: "16px" }}>
        <h1 className="s-title">Settings</h1>
      </div>

      <div className="settings-layout" id="settings-wrap" style={{ marginBottom: "24px" }}>
        {/* Settings Tab Sidebar */}
        <div className="settings-sidebar">
          <button
            className={`s-nav-item ${activePanel === "appearance" ? "active" : ""}`}
            onClick={() => setActivePanel("appearance")}
          >
            🎨 Appearance
          </button>
          <button
            className={`s-nav-item ${activePanel === "reading" ? "active" : ""}`}
            onClick={() => setActivePanel("reading")}
          >
            📖 Reading
          </button>
          <button
            className={`s-nav-item ${activePanel === "content" ? "active" : ""}`}
            onClick={() => setActivePanel("content")}
          >
            🔍 Content
          </button>
          <button
            className={`s-nav-item ${activePanel === "privacy" ? "active" : ""}`}
            onClick={() => setActivePanel("privacy")}
          >
            🔒 Privacy
          </button>
          <button
            className={`s-nav-item ${activePanel === "notifications" ? "active" : ""}`}
            onClick={() => setActivePanel("notifications")}
          >
            🔔 Notifications
          </button>
          <button
            className={`s-nav-item ${activePanel === "account" ? "active" : ""}`}
            onClick={() => setActivePanel("account")}
          >
            👤 Account
          </button>
        </div>

        {/* Settings Panels Content */}
        <div className="settings-content">
          {/* Appearance Panel */}
          {activePanel === "appearance" && (
            <div className="s-panel active">
              <div className="s-panel-title">Appearance</div>
              <div className="s-panel-sub">Customise how MangaReader looks.</div>
              
              {!isStandalone && (
                <div className="setting-row">
                  <div className="s-label">
                    <h4>Install App</h4>
                    <p>Add MangaReader to your home screen</p>
                  </div>
                  <button
                    onClick={handleInstallClick}
                    className="btn btn-primary"
                    style={{ fontSize: "13px", padding: "6px 14px" }}
                  >
                    Install App
                  </button>
                </div>
              )}

              <div className="setting-row">
                <div className="s-label">
                  <h4>Dark mode</h4>
                  <p>Switch between dark and light theme</p>
                </div>
                <div
                  className={`tog ${isDark ? "on" : ""}`}
                  onClick={() => toggleDark()}
                />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Accent colour</h4>
                  <p>Choose your highlight colour</p>
                </div>
                <div style={{ display: "flex", gap: "8px" }} id="accent-swatches">
                  {accentSwatches.map((color, idx) => {
                    const isSelected = accentColors.c1 === color.c1;
                    return (
                      <div
                        key={idx}
                        onClick={() => setAccent(color.c1, color.c2)}
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          background: color.c1,
                          cursor: "pointer",
                          transition: "transform .15s",
                          border: isSelected ? "2px solid #fff" : "none",
                          boxShadow: isSelected ? `0 0 0 2px ${color.c1}` : "none",
                        }}
                        title={color.label}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Compact cards</h4>
                  <p>Show more titles per row</p>
                </div>
                <div className={`tog ${compactCards ? "on" : ""}`} onClick={() => setCompactCards(!compactCards)} />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Reduce motion</h4>
                  <p>Disable animations</p>
                </div>
                <div className={`tog ${reduceMotion ? "on" : ""}`} onClick={() => setReduceMotion(!reduceMotion)} />
              </div>
            </div>
          )}

          {/* Reading Panel */}
          {activePanel === "reading" && (
            <div className="s-panel active">
              <div className="s-panel-title">Reading</div>
              <div className="s-panel-sub">Control your reading experience.</div>
              <div className="setting-row">
                <div className="s-label">
                  <h4>Reading direction</h4>
                  <p>Manga (RTL) or webtoon (vertical)</p>
                </div>
                <select className="s-select" value={readingDirection} onChange={(e) => setReadingDirection(e.target.value)}>
                  <option>Right to left</option>
                  <option>Left to right</option>
                  <option>Vertical scroll</option>
                </select>
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Page fit</h4>
                  <p>How pages scale to your screen</p>
                </div>
                <select className="s-select" value={pageFit} onChange={(e) => setPageFit(e.target.value)}>
                  <option>Fit width</option>
                  <option>Fit height</option>
                  <option>Original size</option>
                </select>
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Auto-advance chapters</h4>
                  <p>Skip to next chapter at end</p>
                </div>
                <div className={`tog ${autoAdvance ? "on" : ""}`} onClick={() => setAutoAdvance(!autoAdvance)} />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Preload pages</h4>
                  <p>Load next page in background</p>
                </div>
                <div className={`tog ${preloadPages ? "on" : ""}`} onClick={() => setPreloadPages(!preloadPages)} />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Save reading position</h4>
                  <p>Resume from where you stopped</p>
                </div>
                <div className={`tog ${savePosition ? "on" : ""}`} onClick={() => setSavePosition(!savePosition)} />
              </div>
            </div>
          )}

          {/* Content Filters Panel */}
          {activePanel === "content" && (
            <div className="s-panel active">
              <div className="s-panel-title">Content Filters</div>
              <div className="s-panel-sub">Control what appears in your feed.</div>
              <div className="setting-row">
                <div className="s-label">
                  <h4>
                    NSFW Content <span className="nsfw-badge">18+</span>
                  </h4>
                  <p>Show mature/adult content. Age verification required.</p>
                </div>
                <div
                  className={`tog ${isNSFW ? "on" : ""}`}
                  onClick={() => {
                    if (!isNSFW) {
                      const ok = confirm(
                        "You must be 18+ to enable NSFW content. Do you confirm you are 18 or older?"
                      );
                      if (ok) toggleNSFW(true);
                    } else {
                      toggleNSFW(false);
                    }
                  }}
                />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Incognito Mode</h4>
                  <p>Reading history won't be saved while active</p>
                </div>
                <div
                  className={`tog ${isIncognito ? "on" : ""}`}
                  onClick={toggleIncognito}
                />
              </div>

              <div className="setting-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
                <div className="s-label">
                  <h4>Your Interests</h4>
                  <p>We use these to personalise recommendations.</p>
                </div>
                <div className="interest-grid">
                  {ALL_GENRES.map((g) => {
                    const active = userInterests.includes(g);
                    return (
                      <div
                        key={g}
                        className={`int-chip ${active ? "on" : ""}`}
                        onClick={() => handleInterestToggle(g)}
                      >
                        {g}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="setting-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
                <div className="s-label">
                  <h4>Hidden Genres</h4>
                  <p>Manga in these genres are blurred in your feed. Click a genre to unhide.</p>
                </div>
                <div className="hidden-genre-list">
                  {hiddenGenres.length ? (
                    hiddenGenres.map((g) => (
                      <div key={g} className="hg-chip" onClick={() => unhideGenre(g)}>
                        <span>{g}</span>
                        <span className="remove">✕</span>
                      </div>
                    ))
                  ) : (
                    <span style={{ fontSize: "12px", color: "var(--text3)" }}>
                      No hidden genres. Right-click any card to hide a genre.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Privacy Panel */}
          {activePanel === "privacy" && (
            <div className="s-panel active">
              <div className="s-panel-title">Privacy</div>
              <div className="s-panel-sub">Control your data and reading privacy.</div>
              <div className="setting-row">
                <div className="s-label">
                  <h4>Public reading history</h4>
                  <p>Let others see what you're reading</p>
                </div>
                <div className="tog" onClick={(e) => e.target.classList.toggle("on")} />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Personalised recommendations</h4>
                  <p>Use reading history to improve suggestions</p>
                </div>
                <div className="tog on" onClick={(e) => e.target.classList.toggle("on")} />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Analytics</h4>
                  <p>Help improve the app with anonymous data</p>
                </div>
                <div className="tog on" onClick={(e) => e.target.classList.toggle("on")} />
              </div>

              <div className="setting-row">
                <div className="s-label" style={{ color: "var(--red)" }}>
                  <h4>Delete reading history</h4>
                  <p style={{ color: "var(--text3)" }}>Permanently removes all history</p>
                </div>
                <button
                  style={{
                    background: "none",
                    border: "1px solid var(--red)",
                    color: "var(--red)",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                  onClick={() => {
                    clearHistory();
                    alert("Reading history deleted!");
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Notifications Panel */}
          {activePanel === "notifications" && (
            <div className="s-panel active">
              <div className="s-panel-title">Notifications</div>
              <div className="s-panel-sub">Choose what you hear about.</div>
              <div className="setting-row">
                <div className="s-label">
                  <h4>New chapter alerts</h4>
                  <p>When a new chapter drops for your manga</p>
                </div>
                <div className="tog on" onClick={(e) => e.target.classList.toggle("on")} />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Weekly digest</h4>
                  <p>Top releases and trending titles</p>
                </div>
                <div className="tog" onClick={(e) => e.target.classList.toggle("on")} />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>New series recommendations</h4>
                  <p>Picks based on your reading history</p>
                </div>
                <div className="tog on" onClick={(e) => e.target.classList.toggle("on")} />
              </div>
            </div>
          )}

          {/* Account Panel */}
          {activePanel === "account" && (
            <div className="s-panel active">
              <div className="s-panel-title">Account</div>
              <div className="s-panel-sub">Manage your profile and data.</div>
              <div className="setting-row">
                <div className="s-label">
                  <h4>Display name</h4>
                </div>
                <input className="s-input" defaultValue="Tsukasa" />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Email</h4>
                </div>
                <input className="s-input" defaultValue="tsukasa@example.com" type="email" />
              </div>

              <div className="setting-row">
                <div className="s-label">
                  <h4>Language</h4>
                </div>
                <select className="s-select" defaultValue="English">
                  <option>English</option>
                  <option>日本語</option>
                  <option>Español</option>
                  <option>Français</option>
                </select>
              </div>

              <div className="setting-row">
                <div className="s-label" style={{ color: "var(--red)" }}>
                  <h4>Sign out</h4>
                </div>
                <button
                  className="btn btn-s"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
