"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ArticleRowActions from "@/components/admin/ArticleRowActions";

const STATUS_CLASS = {
  DRAFT: "badge-draft",
  SCHEDULED: "badge-scheduled",
  PUBLISHED: "badge-published",
  ARCHIVED: "badge-archived",
};

function fmt(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminArticlesClient({ items }) {
  const router = useRouter();
  const [selected, setSelected] = useState(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleBulkAction = async (action) => {
    if (selected.size === 0) return;
    if (action === "DELETE" && !confirm("Are you sure you want to delete these articles?")) return;

    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/admin/articles/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to bulk update");
      }
    } catch (err) {
      alert("An error occurred");
    }
    setIsBulkLoading(false);
  };

  if (items.length === 0) {
    return <div className="admin-empty">No articles found in this category.</div>;
  }

  return (
    <>
      {selected.size > 0 && (
        <div style={{ background: "var(--bg2)", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
          <span style={{ fontWeight: 500 }}>{selected.size} selected</span>
          <button className="btn btn-s" onClick={() => handleBulkAction("PUBLISH")} disabled={isBulkLoading}>Publish</button>
          <button className="btn btn-s" onClick={() => handleBulkAction("DRAFT")} disabled={isBulkLoading}>Draft</button>
          <button className="btn btn-s" onClick={() => handleBulkAction("SCHEDULE")} disabled={isBulkLoading}>Schedule</button>
          <button className="btn" style={{ background: "#dc2626", color: "white" }} onClick={() => handleBulkAction("DELETE")} disabled={isBulkLoading}>Delete</button>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input 
                  type="checkbox" 
                  checked={selected.size === items.length && items.length > 0} 
                  onChange={toggleSelectAll} 
                />
              </th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Published</th>
              <th>Views</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className={selected.has(a.id) ? "selected-row" : ""}>
                <td>
                  <input 
                    type="checkbox" 
                    checked={selected.has(a.id)} 
                    onChange={() => toggleSelect(a.id)} 
                  />
                </td>
                <td>
                  <Link href={`/admin/articles/${a.id}/edit`} className="admin-table-link">
                    {a.title}
                  </Link>
                  {a.byline?.name && <div className="admin-table-sub">by {a.byline.name}</div>}
                </td>
                <td>{a.category?.name || a.contentType}</td>
                <td>
                  <span className={`admin-badge ${STATUS_CLASS[a.status] || ""}`}>{a.status}</span>
                </td>
                <td>{a.status === "SCHEDULED" ? fmt(a.scheduledFor) : fmt(a.publishedAt)}</td>
                <td>{a.viewCount}</td>
                <td>
                  <ArticleRowActions id={a.id} title={a.title} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
