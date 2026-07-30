"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import Link from "next/link";
import Footer from "@/components/Footer";

export default function Login() {
  const router = useRouter();
  const { doLogin } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await doLogin({ email, password });
    setLoading(false);
    if (res.ok) {
      router.push("/");
    } else {
      setError(res.error || "Sign in failed.");
    }
  };



  return (
    <div>
      <div className="auth-page">
        <div className="auth-card">
          <h1>Welcome back</h1>
          <p className="auth-sub">Sign in to continue your manga journey.</p>

          <form onSubmit={handleSubmit}>
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
              <label style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Password</span>
                <a style={{ fontSize: "12px", color: "var(--accent)", cursor: "pointer" }}>
                  Forgot?
                </a>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: "40px" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--fg-dim)",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {error && (
              <p style={{ color: "#ef4444", fontSize: "13px", margin: "4px 0 0" }}>{error}</p>
            )}
            <button className="btn btn-p btn-block" style={{ marginTop: "4px" }} type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <p className="auth-footer-text">
            No account? <Link href="/signup">Create one free →</Link>
          </p>
        </div>
      </div>
      <footer className="footer">
        <div className="footer-bottom">
          <span>© 2026 MangaReader.</span>
          <span>
            <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
