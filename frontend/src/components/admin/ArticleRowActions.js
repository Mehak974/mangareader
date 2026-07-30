"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Row-level actions for an article in the admin list: edit link + delete.
 * Delete asks for confirmation, calls the API, then refreshes the list.
 */
export default function ArticleRowActions({ id, slug, status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("Delete this article permanently? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not delete the article.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Network error. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="admin-row-actions">
      {status === "PUBLISHED" && (
        <a
          className="admin-row-link"
          href={`/blog/${slug}`}
          target="_blank"
          rel="noreferrer"
          title="View"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </a>
      )}
      <a className="admin-row-link" href={`/admin/articles/${id}/edit`} title="Edit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        <span style={{ marginLeft: "4px" }}>Edit</span>
      </a>
      <button
        className="admin-row-link admin-row-danger"
        onClick={handleDelete}
        disabled={busy}
        title="Delete"
        style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        <span>{busy ? "…" : "Delete"}</span>
      </button>
    </div>
  );
}
