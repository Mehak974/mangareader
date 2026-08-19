"use client";

import React, { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LegalNav from "@/components/LegalNav";
import Footer from "@/components/Footer";

export default function MessageThreadPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = use(params);
  const email = searchParams.get("email")?.trim().toLowerCase() || "";

  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useState(() => {
    if (!email) {
      setError("Email is required to view this message.");
      setLoading(false);
      return;
    }
    fetch(`/api/messages/thread/${id}?email=${encodeURIComponent(email)}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (data.thread) {
          setThread(data.thread);
        } else {
          setError(data.error || "Thread not found.");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Network error. Please try again.");
        setLoading(false);
      });
  }, [id, email]);

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/thread/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, text: replyText.trim() }),
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
        <div className="legal-container" style={{ textAlign: "center", padding: "60px 0" }}>
          <LegalNav />
          <p style={{ color: "var(--red)" }}>{error || "Thread not found."}</p>
          <button className="btn btn-p" onClick={() => router.push("/messages")} style={{ marginTop: 16 }}>
            Back to Messages
          </button>
        </div>
      </div>
    );
  }

  const replies = Array.isArray(thread.replies) ? thread.replies : [];

  return (
    <div className="legal-page">
      <div className="legal-container" style={{ maxWidth: 700 }}>
        <LegalNav />
        <button
          onClick={() => router.push("/messages")}
          style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 14, marginBottom: 12, padding: 0 }}
        >
          ← Back to Messages
        </button>
        <h1>{thread.subject || "Message Thread"}</h1>
        <p className="legal-subtitle">
          {new Date(thread.createdAt).toLocaleString()} · {thread.type.replace("_", " ")} ·{" "}
          <span className={`admin-badge admin-badge-${thread.status.toLowerCase()}`} style={{ fontSize: 11 }}>
            {thread.status.replace("_", " ")}
          </span>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "24px 0" }}>
          <div
            style={{
              background: "var(--bg2)",
              padding: 16,
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text2)" }}>
              You · {new Date(thread.createdAt).toLocaleString()}
            </div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{thread.message}</div>
          </div>

          {replies.map((r) => (
            <div
              key={r.id}
              style={{
                background: r.sender === "admin" ? "var(--accent)" : "var(--bg3)",
                color: r.sender === "admin" ? "#fff" : "var(--text)",
                padding: 16,
                borderRadius: 12,
                alignSelf: r.sender === "admin" ? "flex-end" : "flex-start",
                maxWidth: "100%",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                {r.sender === "admin" ? "MangaReader Support" : "You"} · {new Date(r.createdAt).toLocaleString()}
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.text}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            rows={3}
            style={{
              flex: 1,
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              color: "var(--text)",
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn btn-p" onClick={sendReply} disabled={sending || !replyText.trim()}>
            {sending ? "Sending…" : "Send Reply"}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
