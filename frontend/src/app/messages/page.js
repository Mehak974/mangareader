"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import LegalNav from "@/components/LegalNav";
import Footer from "@/components/Footer";

export default function MessagesPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [threads, setThreads] = useState([]);
  const [searched, setSearched] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/messages/thread?email=${encodeURIComponent(email.trim().toLowerCase())}`);
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

  return (
    <div className="legal-page">
      <div className="legal-container" style={{ maxWidth: 800 }}>
        <LegalNav />
        <h1>Your Messages</h1>
        <p className="legal-subtitle">
          Enter the email you used to contact us to view your conversation history.
        </p>

        <form onSubmit={search} style={{ marginBottom: 32, display: "flex", gap: 8 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="form-input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-p" disabled={loading}>
            {loading ? "Loading…" : "View Messages"}
          </button>
        </form>

        {error && <p className="form-error">⚠️ {error}</p>}

        {searched && threads.length === 0 && !error && (
          <p style={{ textAlign: "center", color: "var(--text3)", padding: "40px 0" }}>
            No messages found for this email.
          </p>
        )}

        {threads.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {threads.map((t) => {
              const replyCount = Array.isArray(t.replies) ? t.replies.length : 0;
              const lastReply = replyCount > 0 ? t.replies[t.replies.length - 1] : null;
              return (
                <div
                  key={t.id}
                  onClick={() => router.push(`/messages/${t.id}?email=${encodeURIComponent(email.trim().toLowerCase())}`)}
                  style={{
                    background: "var(--bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 16,
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>
                        {t.subject || "No Subject"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                        {new Date(t.createdAt).toLocaleString()} · {t.type.replace("_", " ")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {replyCount > 0 && (
                        <span className="admin-badge admin-badge-published" style={{ fontSize: 11 }}>
                          {replyCount} reply{replyCount > 1 ? "ies" : "y"}
                        </span>
                      )}
                      <span className={`admin-badge admin-badge-${t.status.toLowerCase()}`} style={{ fontSize: 11 }}>
                        {t.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {t.message}
                  </div>
                  {lastReply && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text3)" }}>
                      Last reply: {new Date(lastReply.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
