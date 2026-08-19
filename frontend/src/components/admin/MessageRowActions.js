"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const NEXT = { NEW: "IN_PROGRESS", IN_PROGRESS: "RESOLVED" };
const NEXT_LABEL = { NEW: "Start", IN_PROGRESS: "Resolve" };

export default function MessageRowActions({ id, status, message }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const patchStatus = async (next) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not update the message.");
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      window.alert("Network error. Please try again.");
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this message permanently?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not delete the message.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Network error. Please try again.");
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/messages/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: replyText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not send reply.");
        setSending(false);
        return;
      }
      setReplyText("");
      router.refresh();
      setSending(false);
    } catch {
      window.alert("Network error. Please try again.");
      setSending(false);
    }
  };

  const replies = Array.isArray(message?.replies) ? message.replies : [];
  const replyCount = replies.length;

  return (
    <>
      <div className="admin-row-actions">
        <button className="admin-row-link" onClick={() => setViewing(true)}>
          View {replyCount > 0 ? `(${replyCount})` : ""}
        </button>
        {NEXT[status] && (
          <button className="admin-row-link" onClick={() => patchStatus(NEXT[status])} disabled={busy}>
            {NEXT_LABEL[status]}
          </button>
        )}
        {status !== "SPAM" && (
          <button className="admin-row-link" onClick={() => patchStatus("SPAM")} disabled={busy}>
            Spam
          </button>
        )}
        {status !== "NEW" && (
          <button className="admin-row-link" onClick={() => patchStatus("NEW")} disabled={busy}>
            Reopen
          </button>
        )}
        <button className="admin-row-link admin-row-danger" onClick={handleDelete} disabled={busy}>
          {busy ? "…" : "Delete"}
        </button>
      </div>

      {viewing && (
        <div className="admin-modal-overlay" onClick={() => setViewing(false)}>
          <div className="admin-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, width: "90%" }}>
            <h3>{message.subject || "No Subject"}</h3>
            <div style={{ marginBottom: 16, color: "var(--text3)", fontSize: 13 }}>
              From: <b>{message.name}</b> ({message.email}) · {new Date(message.createdAt).toLocaleString()}
            </div>

            <div style={{ background: "var(--bg2)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <p style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>{message.message}</p>
            </div>

            {replies.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text2)" }}>Conversation</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {replies.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        background: r.sender === "admin" ? "var(--accent)" : "var(--bg3)",
                        color: r.sender === "admin" ? "#fff" : "var(--text)",
                        padding: "10px 14px",
                        borderRadius: 12,
                        maxWidth: "85%",
                        alignSelf: r.sender === "admin" ? "flex-end" : "flex-start",
                      }}
                    >
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
                        {r.sender === "admin" ? "You" : message.name} · {new Date(r.createdAt).toLocaleString()}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{r.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
                style={{
                  flex: 1,
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 10,
                  color: "var(--text)",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="admin-btn" onClick={() => setViewing(false)}>Close</button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
              >
                {sending ? "Sending…" : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
