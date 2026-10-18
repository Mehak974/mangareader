"use client";

import dynamic from "next/dynamic";

const LibraryContent = dynamic(() => import("@/components/LibraryContent"), {
  ssr: false,
  loading: () => (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px 16px 80px" }}>
      <h1 style={{ fontSize: "26px", fontWeight: 800, marginBottom: "18px", color: "var(--text, #e8deff)" }}>
        Library
      </h1>
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text3)" }}>
        Loading library...
      </div>
    </div>
  ),
});

export default function Library() {
  return <LibraryContent />;
}
