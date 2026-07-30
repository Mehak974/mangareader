"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";

function initials(name = "") {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function timeAgo(d) {
  const mins = Math.floor((Date.now() - new Date(d)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

/**
 * Discussion thread for a manga (pass mangaId) or an article (pass articleId).
 * Reads/writes /api/comments. Posting requires auth; the section prompts a
 * guest to sign in via the existing sheet.
 */
export default function CommentSection({ mangaId, articleId }) {
  const { isLoggedIn, user, setSigninSheetOpen } = useApp();
  const isMod = user?.role === "EDITOR" || user?.role === "ADMIN";

  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);

  const query = articleId ? `articleId=${articleId}` : `mangaId=${mangaId}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?${query}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.comments) {
        setComments(data.comments.items || []);
        setTotal(data.comments.total || 0);
      }
    } catch {
      // leave existing state; a transient fetch failure isn't fatal
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const post = async (text, parentId) => {
    setError("");
    if (!text.trim()) return;
    setPosting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          body: text,
          ...(articleId ? { articleId } : { mangaId }),
          ...(parentId ? { parentId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not post your comment.");
        return;
      }
      setBody("");
      setReplyBody("");
      setReplyTo(null);
      await load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) await load();
    } catch {
      /* ignore */
    }
  };

  const canManage = (c) => isMod || c.user?.id === user?.id;

  const renderComment = (c, isReply = false) => (
    <div key={c.id} className={`cmt ${isReply ? "cmt-reply" : ""}`}>
      <div className="cmt-avatar">{initials(c.user?.displayName)}</div>
      <div className="cmt-main">
        <div className="cmt-head">
          <span className="cmt-author">{c.user?.displayName || "User"}</span>
          {(c.user?.role === "EDITOR" || c.user?.role === "ADMIN") && (
            <span className="cmt-badge">Staff</span>
          )}
          <span className="cmt-time">{timeAgo(c.createdAt)}</span>
        </div>
        <div className="cmt-body">{c.body}</div>
        <div className="cmt-actions">
          {!isReply && isLoggedIn && (
            <button
              className="cmt-action"
              onClick={() => {
                setReplyTo(replyTo === c.id ? null : c.id);
                setReplyBody("");
              }}
            >
              Reply
            </button>
          )}
          {canManage(c) && (
            <button className="cmt-action cmt-danger" onClick={() => remove(c.id)}>
              Delete
            </button>
          )}
        </div>

        {replyTo === c.id && (
          <div className="cmt-reply-form">
            <textarea
              className="cmt-input"
              rows={2}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write a reply…"
            />
            <div className="cmt-form-actions">
              <button
                className="btn btn-p cmt-post"
                disabled={posting || !replyBody.trim()}
                onClick={() => post(replyBody, c.id)}
              >
                {posting ? "Posting…" : "Reply"}
              </button>
              <button className="btn btn-s" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {c.replies?.length > 0 && (
          <div className="cmt-replies">{c.replies.map((r) => renderComment(r, true))}</div>
        )}
      </div>
    </div>
  );

  return (
    <section className="cmt-section" aria-label="Discussion">
      <h3 className="cmt-title">
        Discussion <span className="cmt-count">({total})</span>
      </h3>

      {isLoggedIn ? (
        <div className="cmt-new">
          <textarea
            className="cmt-input"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts…"
            maxLength={4000}
          />
          {error && <p className="cmt-error">{error}</p>}
          <div className="cmt-form-actions">
            <button
              className="btn btn-p cmt-post"
              disabled={posting || !body.trim()}
              onClick={() => post(body, null)}
            >
              {posting ? "Posting…" : "Post comment"}
            </button>
          </div>
        </div>
      ) : (
        <div className="cmt-signin">
          <span>Sign in to join the discussion.</span>
          <button className="btn btn-p" onClick={() => setSigninSheetOpen(true)}>
            Sign in
          </button>
        </div>
      )}

      {loading ? (
        <p className="cmt-empty">Loading discussion…</p>
      ) : comments.length === 0 ? (
        <p className="cmt-empty">No comments yet. Be the first to share your thoughts.</p>
      ) : (
        <div className="cmt-list">{comments.map((c) => renderComment(c))}</div>
      )}
    </section>
  );
}
