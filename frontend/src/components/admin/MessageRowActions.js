"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Ordered lifecycle so the "advance" button knows the next step.
const NEXT = { NEW: "IN_PROGRESS", IN_PROGRESS: "RESOLVED" };
const NEXT_LABEL = { NEW: "Start", IN_PROGRESS: "Resolve" };

/**
 * Row actions for a contact message: advance status through the lifecycle,
 * mark as spam, and delete. Each mutation calls the API then refreshes the list.
 */
export default function MessageRowActions({ id, status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const patchStatus = async (next) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not update the message.");
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      window.alert("Network error. Please try again.");
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this message permanently?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not delete the message.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Network error. Please try again.");
      setBusy(false);
    }
  };

  const next = NEXT[status];

  return (
    <div className="admin-row-actions">
      {next && (
        <button className="admin-row-link" onClick={() => patchStatus(next)} disabled={busy}>
          {NEXT_LABEL[status]}
        </button>
      )}
      {status !== "SPAM" && (
        <button className="admin-row-link" onClick={() => patchStatus("SPAM")} disabled={busy}>
          Spam
        </button>
      )}
      {status !== "NEW" && (
        <button className="admin-row-link" onClick={() => patchStatus("NEW")} disabled={busy}>
          Reopen
        </button>
      )}
      <button className="admin-row-link admin-row-danger" onClick={handleDelete} disabled={busy}>
        {busy ? "…" : "Delete"}
      </button>
    </div>
  );
}
