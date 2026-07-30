"use client";

import React, { useState } from "react";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSuccess("");
    setError("");
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSuccess(data.message || "Thanks for subscribing!");
      setEmail("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="footer-news">
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          disabled={submitting}
        />
        <button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "..." : "Join"}
        </button>
      </div>
      {success && (
        <p style={{ color: "var(--green, #16a34a)", fontSize: "13px", marginTop: "8px" }}>{success}</p>
      )}
      {error && (
        <p style={{ color: "var(--red, #dc2626)", fontSize: "13px", marginTop: "8px" }}>{error}</p>
      )}
    </>
  );
}
