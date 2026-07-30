"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Row action for a newsletter subscriber: delete (unsubscribe). Confirms,
 * calls the API, then refreshes the list.
 */
export default function NewsletterRowActions({ id, email }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${email} from the newsletter?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/newsletter/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not remove the subscriber.");
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
      <button className="admin-row-link admin-row-danger" onClick={handleDelete} disabled={busy}>
        {busy ? "…" : "Remove"}
      </button>
    </div>
  );
}
