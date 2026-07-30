"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { API_BASE } from "@/utils/api";

export default function MaintenanceGuard({ children }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  // Skip maintenance overlay on admin page
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    fetch(`${API_BASE}/api/settings/maintenance`)
      .then((r) => r.json())
      .then((data) => setMaintenanceMode(data.maintenanceMode === true))
      .catch(() => {});

    // Poll every 60s in case admin toggles it
    const interval = setInterval(() => {
      fetch(`${API_BASE}/api/settings/maintenance`)
        .then((r) => r.json())
        .then((data) => setMaintenanceMode(data.maintenanceMode === true))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const showOverlay = maintenanceMode && !isAdmin && !dismissed;

  return (
    <>
      {children}
      {showOverlay && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(18px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--rxl)",
              padding: "40px 36px",
              textAlign: "center",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative gradient glow */}
            <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 200, height: 200, borderRadius: "50%", background: "var(--accent)", filter: "blur(80px)", opacity: 0.15, pointerEvents: "none" }} />

            <div style={{ fontSize: 52, marginBottom: 16 }}>🛠️</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10, fontFamily: "var(--serif)" }}>
              Under Maintenance
            </h2>
            <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
              We&apos;re making some improvements to Manga Reader. We&apos;ll be back shortly. Thank you for your patience!
            </p>
            <div
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
                borderRadius: "var(--r)",
                padding: "12px 16px",
                fontSize: 13,
                color: "var(--accent)",
                marginBottom: 28,
                fontWeight: 500,
              }}
            >
              ⏱️ Estimated downtime: A few minutes
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-p"
                style={{ fontSize: 13 }}
              >
                Try Again
              </button>
              <a
                href="/admin"
                className="btn btn-s"
                style={{ fontSize: 13 }}
              >
                Admin Login
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
