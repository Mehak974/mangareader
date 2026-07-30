"use client";
import { useState, useEffect } from "react";
import { X, PlusSquare } from "lucide-react";

export default function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Wait a bit before showing to not overwhelm the user
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "var(--bg2)",
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
      <div style={{ background: "var(--primary)", padding: "10px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PlusSquare size={24} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: "1rem", color: "var(--text)" }}>Add to Home Screen</h4>
        <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text2)" }}>Install MangaReader for a faster, full-screen app experience.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <button 
          onClick={handleInstall}
          style={{ background: "var(--primary)", color: "white", border: "none", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem" }}
        >
          Install
        </button>
        <button 
          onClick={() => setShowPrompt(false)}
          style={{ background: "transparent", color: "var(--text2)", border: "none", padding: "4px", cursor: "pointer", fontSize: "0.8rem" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
