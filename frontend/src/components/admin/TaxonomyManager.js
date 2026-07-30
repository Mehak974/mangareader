"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Manage editorial taxonomy in one screen: create categories (name +
 * description) and tags (name), and delete either. Every mutation calls the
 * admin API then refreshes the server-rendered lists.
 */
export default function TaxonomyManager({ categories, tags }) {
  const router = useRouter();
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [tagName, setTagName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async (url, body) => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setError(data.error || "Could not save.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setBusy(false);
      setError("Network error. Please try again.");
      return false;
    }
  };

  const remove = async (url, label) => {
    if (!window.confirm(`Delete ${label}? Articles keep their content but lose this link.`)) return;
    setBusy(true);
    try {
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Could not delete.");
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

  const addCategory = async (e) => {
    e.preventDefault();
    const ok = await post("/api/admin/categories", {
      name: catName,
      description: catDesc || undefined,
    });
    if (ok) {
      setCatName("");
      setCatDesc("");
    }
  };

  const addTag = async (e) => {
    e.preventDefault();
    const ok = await post("/api/admin/tags", { name: tagName });
    if (ok) setTagName("");
  };

  return (
    <div>
      {error && <p className="admin-error" role="alert">{error}</p>}

      <div className="admin-panel-grid">
        {/* Categories */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Categories</h2>
          </div>

          <form className="admin-inline-form" onSubmit={addCategory}>
            <label className="admin-field">
              <span>Name</span>
              <input
                className="admin-input"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Guides"
                required
              />
            </label>
            <label className="admin-field">
              <span>Description <em>(optional)</em></span>
              <input
                className="admin-input"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                maxLength={300}
              />
            </label>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
              Add category
            </button>
          </form>

          {categories.length === 0 ? (
            <div className="admin-empty">No categories yet.</div>
          ) : (
            <ul className="admin-list">
              {categories.map((c) => (
                <li key={c.id} className="admin-list-row">
                  <span className="admin-list-main">
                    {c.name}
                    <span className="admin-table-sub"> /{c.slug}</span>
                  </span>
                  <span className="admin-list-meta">{c._count.articles} article{c._count.articles === 1 ? "" : "s"}</span>
                  <button
                    className="admin-row-link admin-row-danger"
                    onClick={() => remove(`/api/admin/categories/${c.id}`, `category "${c.name}"`)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tags */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Tags</h2>
          </div>

          <form className="admin-inline-form" onSubmit={addTag}>
            <label className="admin-field">
              <span>Name</span>
              <input
                className="admin-input"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="shonen"
                required
              />
            </label>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
              Add tag
            </button>
          </form>

          {tags.length === 0 ? (
            <div className="admin-empty">No tags yet.</div>
          ) : (
            <ul className="admin-list">
              {tags.map((t) => (
                <li key={t.id} className="admin-list-row">
                  <span className="admin-list-main">
                    {t.name}
                    <span className="admin-table-sub"> /{t.slug}</span>
                  </span>
                  <span className="admin-list-meta">{t._count.articles} article{t._count.articles === 1 ? "" : "s"}</span>
                  <button
                    className="admin-row-link admin-row-danger"
                    onClick={() => remove(`/api/admin/tags/${t.id}`, `tag "${t.name}"`)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
