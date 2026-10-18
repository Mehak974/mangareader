"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LegalNav from "@/components/LegalNav";
import Footer from "@/components/Footer";
import { useApp } from "@/context/AppContext";

export default function MessagesPage() {
  const router = useRouter();
  const { user } = useApp();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [threads, setThreads] = useState([]);
  const [searched, setSearched] = useState(false);

  const search = async (emailToSearch) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/messages/thread?email=${encodeURIComponent(emailToSearch.trim().toLowerCase())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No messages found for this email.");
        setThreads([]);
      } else {
        setThreads(data.threads || []);
      }
    } catch {
      setError("Network error. Please try again.");
      setThreads([]);
    }
    setSearched(true);
    setLoading(false);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const qEmail = new URLSearchParams(window.location.search).get("email");
      const target = qEmail || user?.email;
      if (target && !searched) {
        setEmail(target);
        search(target);
      }
    }
  }, [user?.email, searched]);

  const onSubmit = (e) => {
    e.preventDefault();
    search(email);
  };

  return (
    <>
      <div className="legal-page">
        <div className="legal-container" style={{ maxWidth: 800 }}>
        <LegalNav />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
          <h1 style={{ margin: 0 }}>Support Messages</h1>
          <button className="btn btn-s" onClick={() => router.push("/contact")} style={{ fontSize: 13 }}>
            + New Message
          </button>
        </div>
        <p className="legal-subtitle">
          View your messages, responses from MangaReader Support, and reply directly.
        </p>

        <form onSubmit={onSubmit} style={{ marginBottom: 28, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="form-input"
            style={{ flex: "1 1 220px", minHeight: 44, fontSize: 15 }}
          />
          <button type="submit" className="btn btn-p" disabled={loading} style={{ minHeight: 44, padding: "0 20px" }}>
            {loading ? "Loading…" : "Find Messages"}
          </button>
        </form>

        {error && <p className="form-error">⚠️ {error}</p>}

        {searched && threads.length === 0 && !error && (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: "40px 0" }}>
            <p style={{ fontSize: 16, marginBottom: 12 }}>No messages found for <b>{email}</b></p>
            <button className="btn btn-p" onClick={() => router.push("/contact")}>
              Send a Support Message
            </button>
          </div>
        )}

        {threads.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {threads.map((t) => {
              const replyList = Array.isArray(t.replies) ? t.replies : [];
              const replyCount = replyList.length;
              const hasAdminReply = replyList.some((r) => r.sender === "admin");
              const lastReply = replyCount > 0 ? replyList[replyList.length - 1] : null;

              return (
                <div
                  key={t.id}
                  onClick={() => router.push(`/messages/${t.id}?email=${encodeURIComponent(email.trim().toLowerCase())}`)}
                  style={{
                    background: "var(--bg2)",
                    border: hasAdminReply ? "1px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 14,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: hasAdminReply ? "0 2px 12px rgba(168,85,247,0.15)" : "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = hasAdminReply ? "var(--accent)" : "var(--border)")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 200px" }}>
                      <div style={{ fontWeight: 600, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {t.subject || "No Subject"}
                        {hasAdminReply && (
                          <span style={{ fontSize: 10, background: "var(--accent)", color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                            SUPPORT REPLIED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
                        {new Date(t.createdAt).toLocaleString()} · {(t.type || "CONTACT").replace("_", " ")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {replyCount > 0 && (
                        <span className="admin-badge admin-badge-published" style={{ fontSize: 11 }}>
                          {replyCount} {replyCount === 1 ? "reply" : "replies"}
                        </span>
                      )}
                      <span className={`admin-badge admin-badge-${(t.status || "NEW").toLowerCase()}`} style={{ fontSize: 11 }}>
                        {(t.status || "NEW").replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {t.message}
                  </div>
                  {lastReply && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--text3)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Last response by <b>{lastReply.sender === "admin" ? "MangaReader Support" : "You"}</b>:</span>
                      <span>{new Date(lastReply.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
      <Footer />
    </>
  );
}
