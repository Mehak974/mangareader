"use client";
import React from "react";

export default function Loader() {
  return (
    <div className="loader-wrap">
      <div className="spinner"></div>
    </div>
  );
}

// Compact inline spinner used in smaller contexts (e.g. manga detail page)
export function MiniLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "40px" }}>
      <div className="spinner" style={{ width: "28px", height: "28px", borderWidth: "3px" }}></div>
    </div>
  );
}
