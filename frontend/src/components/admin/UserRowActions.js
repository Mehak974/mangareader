"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES = ["USER", "EDITOR", "ADMIN"];

/**
 * Row actions for a user account: change role and ban/unban with a reason.
 * The acting admin cannot change their own role or ban themselves, so those
 * controls are disabled when `isSelf` is true (the API enforces this too).
 */
export default function UserRowActions({ id, role, banned, isSelf }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const patch = async (payload, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not update the user.");
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

  const changeRole = (e) => {
    const next = e.target.value;
    if (next === role) return;
    patch({ role: next });
  };

  const toggleBan = () => {
    if (banned) {
      patch({ banned: false });
    } else {
      const reason = window.prompt("Reason for banning this user? (optional)");
      if (reason === null) return; // cancelled
      patch({ banned: true, bannedReason: reason });
    }
  };

  return (
    <div className="admin-row-actions">
      <select
        className="admin-select admin-inline-select"
        value={role}
        onChange={changeRole}
        disabled={busy || isSelf}
        aria-label="Role"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        className={`admin-row-link ${banned ? "" : "admin-row-danger"}`}
        onClick={toggleBan}
        disabled={busy || isSelf}
      >
        {banned ? "Unban" : "Ban"}
      </button>
    </div>
  );
}
