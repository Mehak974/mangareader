"use client";

import React, { use, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LegalNav from "@/components/LegalNav";
import Footer from "@/components/Footer";
import { useApp } from "@/context/AppContext";

export default function MessageThreadPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = use(params);
  const { user } = useApp();

  const urlEmail = searchParams.get("email")?.trim().toLowerCase() || "";
  const [email, setEmail] = useState(urlEmail);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!email && user?.email) {
      setEmail(user.email.trim().toLowerCase());
    }
  }, [user?.email, email]);

  const fetchThread = useCallback(async (emailToUse) => {
    const targetEmail = (emailToUse || email || user?.email || "").trim().toLowerCase();
    if (!targetEmail) {
      setError("Please provide your email to view this conversation.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/messages/thread/${id}?email=${encodeURIComponent(targetEmail)}`);
      const data = await res.json().catch(() => ({}));
      if (data.thread) {
        setThread(data.thread);
        setError("");
      } else {
        setError(data.error || "Conversation not found.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id, email, user?.email]);

  useEffect(() => {
    const targetEmail = urlEmail || user?.email?.trim().toLowerCase();
    if (targetEmail) {
      fetchThread(targetEmail);
    } else {
      setLoading(false);
    }
  }, [urlEmail, user?.email, fetchThread]);

  const sendReply = async () => {
    const activeEmail = (email || user?.email || "").trim().toLowerCase();
    if (!replyText.trim() || !activeEmail) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/thread/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: activeEmail, text: replyText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send reply.");
        setSending(false);
        return;
      }
      setThread(data.thread);
      setReplyText("");
      setSending(false);
    } catch {
      setError("Network error. Please try again.");
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="legal-page">
        <div className="legal-container" style={{ textAlign: "center", padding: "60px 0" }}>
          <LegalNav />
          <p>Loading conversation…</p>
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="legal-page">
        <div className="legal-container" style={{ textAlign: "center", padding: "60px 0", maxWidth: 500 }}>
          <LegalNav />
          <h2>View Conversation</h2>
          <p style={{ color: "var(--text2)", marginBottom: 20 }}>
            Enter the email address used when sending this message:
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) fetchThread(email.trim());
            }}
            style={{ display: "flex", gap: 8, marginBottom: 16 }}
          >
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
              {loading ? "Verifying…" : "View"}
            </button>
          </form>
          {error && <p style={{ color: "var(--red)", fontSize: 13 }}>⚠️ {error}</p>}
          <button className="btn btn-s" onClick={() => router.push("/messages")} style={{ marginTop: 12 }}>
            ← All Messages
          </button>
        </div>
      </div>
    );
  }

  const replies = Array.isArray(thread.replies) ? thread.replies : [];

  return (
    <>
      <div className="legal-page">
        <div className="legal-container" style={{ maxWidth: 720 }}>
        <LegalNav />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button
            onClick={() => router.push(`/messages${email ? `?email=${encodeURIComponent(email)}` : ""}`)}
            style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 14, padding: 0 }}
          >
            ← Back to All Messages
          </button>
          <button
            onClick={() => fetchThread(email)}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text2)", cursor: "pointer", fontSize: 12, padding: "4px 10px" }}
          >
            ↻ Refresh
          </button>
        </div>

        <h1 style={{ fontSize: 24, marginBottom: 8 }}>{thread.subject || "Support Request"}</h1>
        <p className="legal-subtitle" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
          <span>{new Date(thread.createdAt).toLocaleString()}</span>
          <span>·</span>
          <span>{(thread.type || "CONTACT").replace("_", " ")}</span>
          <span>·</span>
          <span className={`admin-badge admin-badge-${(thread.status || "NEW").toLowerCase()}`} style={{ fontSize: 11 }}>
            {(thread.status || "NEW").replace("_", " ")}
          </span>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "20px 0" }}>
          {/* Original message */}
          <div
            style={{
              background: "var(--bg2)",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "1px solid var(--border)",
              maxWidth: "92%",
              alignSelf: "flex-start",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--text2)" }}>
              👤 You (Original Message) · {new Date(thread.createdAt).toLocaleString()}
            </div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>{thread.message}</div>
          </div>

          {/* Replies */}
          {replies.map((r) => {
            const isAdmin = r.sender === "admin";
            return (
              <div
                key={r.id}
                style={{
                  background: isAdmin ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "var(--bg3)",
                  color: isAdmin ? "#fff" : "var(--text)",
                  padding: "14px 16px",
                  borderRadius: "16px",
                  borderBottomRightRadius: isAdmin ? "4px" : "16px",
                  borderBottomLeftRadius: !isAdmin ? "4px" : "16px",
                  alignSelf: isAdmin ? "flex-end" : "flex-start",
                  maxWidth: "92%",
                  boxShadow: isAdmin ? "0 4px 15px rgba(168,85,247,0.25)" : "none",
                  border: isAdmin ? "none" : "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 6, fontWeight: 600 }}>
                  {isAdmin ? "🛡️ MangaReader Support" : "👤 You"} · {new Date(r.createdAt).toLocaleString()}
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>{r.text}</div>
              </div>
            );
          })}
        </div>

        {/* Reply input */}
        <div style={{ marginTop: 24, background: "var(--bg2)", padding: 14, borderRadius: 12, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text2)" }}>
            Reply to Support
          </div>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply here…"
            rows={3}
            style={{
              width: "100%",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              color: "var(--text)",
              fontSize: 16, // 16px prevents iOS Safari auto-zoom on input focus
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              className="btn btn-p"
              onClick={sendReply}
              disabled={sending || !replyText.trim()}
              style={{ minHeight: 44, padding: "0 22px", fontSize: 14, fontWeight: 600 }}
            >
              {sending ? "Sending…" : "Send Reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
    <Footer />
  </>
);
}
