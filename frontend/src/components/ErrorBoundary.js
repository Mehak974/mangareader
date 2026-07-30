"use client";

import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: "center", padding: "100px 20px", color: "#fff", background: "#000" }}>
          <h2>Something went wrong</h2>
          <p style={{ marginTop: "12px", color: "var(--red)" }}>{this.state.error?.message || "Unknown error"}</p>
          <button className="btn btn-p" style={{ marginTop: "20px" }} onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}