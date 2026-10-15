"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BROADCAST_ID = "v2026_chat_admin_release";
const BANNER_STORAGE_KEY = `mr_broadcast_banner_${BROADCAST_ID}`;
const MODAL_STORAGE_KEY = `mr_broadcast_modal_${BROADCAST_ID}`;

export default function FeatureBroadcast() {
  const pathname = usePathname();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Check if current page is reader mode (we don't distract readers during chapter reading)
  const isReaderPage = pathname?.startsWith("/reader/");

  // Initialize and check local storage
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Global event listener so any button (Sidebar, Footer, etc.) can open the broadcast modal
    const handleOpenBroadcast = () => {
      setModalOpen(true);
    };
    window.addEventListener("open-feature-broadcast", handleOpenBroadcast);

    // Check if dismissed
    const bannerDismissed = localStorage.getItem(BANNER_STORAGE_KEY);
    const modalSeen = localStorage.getItem(MODAL_STORAGE_KEY);

    if (!bannerDismissed) {
      setBannerVisible(true);
    }

    // Auto-open modal on first visit after a pleasant 1.2s delay (only if not seen before and not on reader/admin)
    let autoModalTimer;
    if (!modalSeen && !pathname?.startsWith("/reader/") && !pathname?.startsWith("/admin")) {
      autoModalTimer = setTimeout(() => {
        setModalOpen(true);
      }, 1200);
    }

    return () => {
      window.removeEventListener("open-feature-broadcast", handleOpenBroadcast);
      if (autoModalTimer) clearTimeout(autoModalTimer);
    };
  }, [pathname]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  // Close modal on Escape
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && modalOpen) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  const handleDismissBanner = (e) => {
    e?.stopPropagation();
    setBannerVisible(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(BANNER_STORAGE_KEY, "1");
    }
  };

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(MODAL_STORAGE_KEY, "1");
    }
  };

  if (isReaderPage) return null;

  return (
    <>
      {/* ── TOP BROADCAST ANNOUNCEMENT BAR ── */}
      {bannerVisible && (
        <aside
          role="region"
          aria-label="Direct Admin Support Announcement"
          style={{
            position: "sticky",
            top: "var(--nav-h, 58px)",
            zIndex: 998,
            width: "100%",
            background: "linear-gradient(90deg, rgba(28, 14, 52, 0.98), rgba(18, 10, 36, 0.98))",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(168, 85, 247, 0.35)",
            color: "var(--text, #e8deff)",
            fontSize: "13px",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <div
            onClick={handleOpenModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flex: 1,
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                color: "#ffffff",
                padding: "3px 9px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(168,85,247,0.4)",
              }}
            >
              💬 New Feature
            </span>

            <p
              style={{
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontWeight: 500,
                color: "var(--text, #f3e8ff)",
              }}
            >
              <strong style={{ color: "#ffffff" }}>Chat with Admin is now live:</strong> Report problems, share feedback, or ask anything directly!
            </p>

            <span
              style={{
                color: "var(--accent2, #c084fc)",
                fontWeight: 600,
                fontSize: "12px",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                marginLeft: "4px",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Learn more →
            </span>
          </div>

          <button
            onClick={handleDismissBanner}
            aria-label="Dismiss announcement"
            title="Dismiss announcement"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text2, rgba(232, 222, 255, 0.7))",
              cursor: "pointer",
              padding: "6px",
              marginLeft: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              transition: "background 0.2s, color 0.2s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text2, rgba(232, 222, 255, 0.7))")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </aside>
      )}

      {/* ── BROADCAST MODAL ── */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="broadcast-title"
          onClick={handleCloseModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(6, 3, 14, 0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            className="broadcast-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "540px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "linear-gradient(180deg, #170d2d 0%, #0d061a 100%)",
              border: "1px solid rgba(168, 85, 247, 0.4)",
              borderRadius: "20px",
              padding: "32px 28px",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.2)",
              color: "var(--text, #e8deff)",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {/* Ambient Purple Top Glow */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "15%",
                right: "15%",
                height: "2px",
                background: "linear-gradient(90deg, transparent, #c084fc, #a855f7, transparent)",
                pointerEvents: "none",
              }}
            />

            {/* Close Button */}
            <button
              onClick={handleCloseModal}
              aria-label="Close announcement"
              style={{
                position: "absolute",
                top: "18px",
                right: "18px",
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "var(--text2, rgba(232, 222, 255, 0.8))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.16)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.color = "var(--text2, rgba(232, 222, 255, 0.8))";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Header Icon, Badge & Title */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: "58px",
                  height: "58px",
                  margin: "0 auto 16px auto",
                  borderRadius: "18px",
                  background: "linear-gradient(135deg, #a855f7, #6b21a8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  boxShadow: "0 8px 24px rgba(168, 85, 247, 0.4)",
                }}
              >
                💬
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(168, 85, 247, 0.15)",
                  border: "1px solid rgba(168, 85, 247, 0.35)",
                  borderRadius: "20px",
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#d8b4fe",
                  marginBottom: "10px",
                  letterSpacing: "0.5px",
                }}
              >
                <span>✨</span> NOW AVAILABLE
              </div>

              <h2
                id="broadcast-title"
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                  color: "#ffffff",
                  lineHeight: 1.25,
                  margin: "0 0 10px 0",
                  fontFamily: "var(--serif, inherit)",
                }}
              >
                Direct Support & Chat with Admin
              </h2>

              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "var(--text2, rgba(232, 222, 255, 0.8))",
                  margin: "0 auto",
                  maxWidth: "460px",
                }}
              >
                We have officially launched direct communication between readers and our administration team. Your reading experience is our highest priority.
              </p>
            </div>

            {/* Feature Points Box */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(168, 85, 247, 0.25)",
                borderRadius: "16px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "rgba(168, 85, 247, 0.18)",
                    color: "var(--accent2, #c084fc)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  1
                </div>
                <div>
                  <h4 style={{ margin: "0 0 3px 0", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
                    Report Problems & Broken Chapters
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--text2, rgba(232, 222, 255, 0.7))" }}>
                    Encountered missing pages, slow loading, bad translations, or site bugs? Let us know immediately so our team can resolve it.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "rgba(168, 85, 247, 0.18)",
                    color: "var(--accent2, #c084fc)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  2
                </div>
                <div>
                  <h4 style={{ margin: "0 0 3px 0", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
                    Share Feedback & Feature Requests
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--text2, rgba(232, 222, 255, 0.7))" }}>
                    Have suggestions for layout improvements, new tools, or manga titles you'd love to see added? We build MangaReader around your ideas.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "rgba(168, 85, 247, 0.18)",
                    color: "var(--accent2, #c084fc)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  3
                </div>
                <div>
                  <h4 style={{ margin: "0 0 3px 0", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
                    Read Admin Replies in Your Inbox
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--text2, rgba(232, 222, 255, 0.7))" }}>
                    Track your conversations and read replies directly in your personal <strong>Support Messages</strong> inbox. You can reply back anytime to continue the thread.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <Link
                href="/contact"
                onClick={handleCloseModal}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  width: "100%",
                  background: "var(--accent, #a855f7)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "14px",
                  padding: "13px 20px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  boxShadow: "0 4px 16px rgba(168, 85, 247, 0.4)",
                  transition: "transform 0.1s, opacity 0.2s",
                }}
              >
                💬 Chat with Admin Now →
              </Link>

              <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                <Link
                  href="/messages"
                  onClick={handleCloseModal}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    color: "var(--text, #e8deff)",
                    fontWeight: 600,
                    fontSize: "13px",
                    padding: "11px 16px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  📬 View Messages Inbox
                </Link>

                <button
                  onClick={handleCloseModal}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    color: "var(--text3, rgba(232, 222, 255, 0.6))",
                    fontWeight: 600,
                    fontSize: "13px",
                    padding: "11px 16px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text3, rgba(232, 222, 255, 0.6))")}
                >
                  Got It, Thanks!
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
