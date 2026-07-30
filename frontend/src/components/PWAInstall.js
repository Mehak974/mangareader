"use client";
import { useState, useEffect } from "react";

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed recently
    const dismissed = localStorage.getItem("pwa_dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after 3s instead of 30s so users actually see it
      setTimeout(() => setShow(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
    if (outcome === "accepted") localStorage.setItem("pwa_installed", "1");
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("pwa_dismissed", String(Date.now()));
  };

  if (!show || !deferredPrompt) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "20px", // moved up to avoid MobileNav
      left: "10%",
      transform: "translateX(-50%)",
      background: "rgba(30, 30, 30, 0.9)",
      backdropFilter: "blur(12px)",
      border: "1px solid var(--border)",
      borderRadius: "16px",
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: "16px",
      boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
      zIndex: 9999,
      width: "90%",
      maxWidth: "400px",
      animation: "fadeUp 0.5s ease-out forwards"
    }}>
      <div style={{ background: "var(--primary)", padding: "12px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
        📱
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: "1.1rem", color: "#fff", fontWeight: "bold" }}>Add to Home Screen</h4>
        <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text2)" }}>Install MangaReader for a faster, full-screen app experience.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={install}
          style={{ background: "var(--primary)", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem" }}
        >
          Install
        </button>
        <button
          onClick={dismiss}
          style={{ background: "transparent", color: "var(--text2)", border: "none", padding: "4px", cursor: "pointer", fontSize: "0.85rem" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
