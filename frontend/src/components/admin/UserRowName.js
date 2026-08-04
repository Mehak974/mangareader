"use client";

import { useState } from "react";

export default function UserRowName({ user, isSelf }) {
  const [open, setOpen] = useState(false);

  const history = Array.isArray(user.readingHistory) ? user.readingHistory : [];
  const mangaTitles = history.slice(0, 10).map(h => h.t);

  return (
    <>
      <div 
        className="cell-strong" 
        style={{ cursor: "pointer", textDecoration: "underline" }} 
        onClick={() => setOpen(true)}
      >
        {user.displayName}
        {isSelf && <span className="admin-table-sub"> (you)</span>}
      </div>
      <div className="admin-table-sub">{user.email}</div>

      {open && (
        <div className="admin-modal-overlay" onClick={() => setOpen(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <h3>{user.displayName}'s Reading Activity</h3>
            <p><strong>Recently Read Manga:</strong></p>
            {mangaTitles.length > 0 ? (
              <ul style={{ paddingLeft: "20px" }}>
                {mangaTitles.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <p>No reading history found.</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button className="admin-btn" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
