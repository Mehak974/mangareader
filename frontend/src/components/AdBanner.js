"use client";
import React from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";

export default function AdBanner({ type = "horizontal" }) {
  const { currentUser } = useApp();

  // If user is VIP, hide the ads entirely!
  if (currentUser?.is_vip) {
    return null;
  }

  const isVertical = type === "vertical";

  return (
    <div
      className={`ad-container ${type}`}
      style={{
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.05))",
        border: "1px solid var(--border)",
        borderRadius: "var(--r)",
        padding: "16px 24px",
        margin: "24px 0",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
        backdropFilter: "blur(10px)",
        gap: 16,
      }}
    >
      {/* Decorative background glow */}
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "var(--accent)",
          filter: "blur(40px)",
          opacity: 0.15,
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, flexDirection: isVertical ? "column" : "row", textAlign: isVertical ? "center" : "left" }}>
        <div
          style={{
            background: "var(--accent-bg)",
            color: "var(--accent)",
            fontSize: 20,
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ⚡
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
            Sponsor Advertisement
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Unlock High-Speed Scraping & Zero Ads
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
            Support Manga Reader and get instant premium features.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, flexDirection: isVertical ? "column" : "row", width: isVertical ? "100%" : "auto" }}>
        <Link
          href="/support"
          className="btn btn-s"
          style={{
            fontSize: 12,
            padding: "8px 16px",
            borderColor: "var(--border)",
            background: "none",
            color: "var(--text2)",
            textAlign: "center",
            width: isVertical ? "100%" : "auto",
          }}
        >
          More Info
        </Link>
        <button
          onClick={() => {
            alert("Upgrade to VIP in settings or ask an admin to enable VIP for you!");
          }}
          className="btn btn-p"
          style={{
            fontSize: 12,
            padding: "8px 16px",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            color: "#fff",
            border: "none",
            boxShadow: "0 4px 12px var(--accent-border)",
            width: isVertical ? "100%" : "auto",
          }}
        >
          Go VIP
        </button>
      </div>
    </div>
  );
}
