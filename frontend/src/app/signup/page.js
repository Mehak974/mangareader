"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { ALL_GENRES } from "@/data/mockData";
import Link from "next/link";

export default function Signup() {
  const router = useRouter();
  const { doSignup, userInterests, setUserInterests } = useApp();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getStrength = (v) => {
    if (!v) return { score: 0, label: "Enter a password", color: "" };
    const hasUpper = /[A-Z]/.test(v);
    const hasNum = /[0-9]/.test(v);
    const hasSpecial = /[^a-zA-Z0-9]/.test(v);

    if (v.length >= 12 && hasUpper && hasNum && hasSpecial) {
      return { score: 4, label: "Strong ✓", color: "#10b981" };
    }
    if (v.length >= 8 && (hasUpper || hasNum)) {
      return { score: 3, label: "Good", color: "#3b82f6" };
    }
    if (v.length >= 6) {
      return { score: 2, label: "Fair", color: "#f59e0b" };
    }
    return { score: 1, label: "Too short", color: "#ef4444" };
  };

  const strength = getStrength(password);

  const toggleInterest = (genre) => {
    setUserInterests((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!terms) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    const res = await doSignup({ email, password, displayName: name });
    setLoading(false);
    if (res.ok) {
      router.push("/");
    } else {
      setError(res.error || "Could not create your account.");
    }
  };



  return (
    <div>
      <div className="auth-page">
        <div className="auth-card">
          <h1>Create account</h1>
          <p className="auth-sub">Join free and start reading instantly.</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Display name</label>
              <input
                className="form-input"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="strength-bar">
                <div
                  className="strength-fill"
                  style={{
                    width: `${strength.score * 25}%`,
                    background: strength.color,
                  }}
                ></div>
              </div>
              <p className="form-hint">{strength.label}</p>
            </div>

            <div className="interest-section">
              <h4>
                Your interests <span style={{ color: "var(--text3)", fontWeight: 400 }}>(pick 3+)</span>
              </h4>
              <p>We'll show you manga you'll actually like.</p>
              <div className="interest-grid">
                {ALL_GENRES.map((g) => {
                  const hasInterest = userInterests.includes(g);
                  return (
                    <div
                      key={g}
                      className={`int-chip ${hasInterest ? "on" : ""}`}
                      onClick={() => toggleInterest(g)}
                    >
                      {g}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="terms-check">
              <input
                type="checkbox"
                id="terms-check"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              <label htmlFor="terms-check">
                I agree to the <Link href="/terms">Terms of Service</Link> and{" "}
                <Link href="/privacy">Privacy Policy</Link>
              </label>
            </div>

            {error && (
              <p style={{ color: "#ef4444", fontSize: "13px", margin: "4px 0 0" }}>{error}</p>
            )}
            <button className="btn btn-p btn-block" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
          <p className="auth-footer-text">
            Already have an account? <Link href="/login">Sign in →</Link>
          </p>
        </div>
      </div>
      <footer className="footer">
        <div className="footer-bottom">
          <span>© 2026 MangaReader.</span>
        </div>
      </footer>
    </div>
  );
}
