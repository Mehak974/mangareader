"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Row actions for an editorial author: edit link + delete. Delete warns when
 * the persona is still attached to articles (their byline becomes "none").
 */
export default function AuthorRowActions({ id, count }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    const warn =
      count > 0
        ? `This author is the byline on ${count} article${count === 1 ? "" : "s"}. Deleting will leave those without a byline. Continue?`
        : "Delete this author permanently?";
    if (!window.confirm(warn)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/authors/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not delete the author.");
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
      <a className="admin-row-link" href={`/admin/authors/${id}/edit`}>
        Edit
      </a>
      <button
        className="admin-row-link admin-row-danger"
        onClick={handleDelete}
        disabled={busy}
      >
        {busy ? "…" : "Delete"}
      </button>
    </div>
  );
}
