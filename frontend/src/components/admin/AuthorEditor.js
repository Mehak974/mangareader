"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Social networks we surface as dedicated fields. Any extra keys already stored
// on the author are preserved and shown as generic rows.
const SOCIAL_FIELDS = [
  ["twitter", "Twitter / X"],
  ["mastodon", "Mastodon"],
  ["website", "Website"],
  ["instagram", "Instagram"],
];

/**
 * Create/edit form for an editorial author persona. `initial` is null for new
 * authors or a full record for edits. Posts to /api/admin/authors (POST) or
 * /api/admin/authors/[id] (PUT) and redirects to the list on success.
 */
export default function AuthorEditor({ initial }) {
  const router = useRouter();
  const isEdit = !!initial;
  const initialSocial = initial?.socialLinks || {};

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    bio: initial?.bio ?? "",
    avatarUrl: initial?.avatarUrl ?? "",
    credentials: initial?.credentials ?? "",
  });
  const [social, setSocial] = useState(() => {
    const base = {};
    for (const [key] of SOCIAL_FIELDS) base[key] = initialSocial[key] ?? "";
    return base;
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setS = (k) => (e) => setSocial((s) => ({ ...s, [k]: e.target.value }));

  const buildPayload = () => {
    // Preserve any social keys that aren't among our dedicated fields.
    const socialLinks = { ...initialSocial };
    for (const [key] of SOCIAL_FIELDS) {
      const val = social[key].trim();
      if (val) socialLinks[key] = val;
      else delete socialLinks[key];
    }
    return {
      name: form.name,
      slug: form.slug || undefined,
      bio: form.bio || undefined,
      avatarUrl: form.avatarUrl || undefined,
      credentials: form.credentials || undefined,
      socialLinks: Object.keys(socialLinks).length ? socialLinks : undefined,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const url = isEdit ? `/api/admin/authors/${initial.id}` : "/api/admin/authors";
    const method = isEdit ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) {
        setError(data.error || "Could not save the author.");
        return;
      }
      router.push("/admin/authors");
      router.refresh();
    } catch {
      setSaving(false);
      setError("Network error. Please try again.");
    }
  };

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-field">
        <label htmlFor="author-name">Name</label>
        <input
          id="author-name"
          className="admin-input"
          value={form.name}
          onChange={set("name")}
          required
        />
      </div>

      <div className="admin-field">
        <label htmlFor="author-slug">Slug</label>
        <input
          id="author-slug"
          className="admin-input"
          value={form.slug}
          onChange={set("slug")}
          placeholder="auto — generated from name"
        />
        <p className="admin-field-hint">Optional. Leave blank to derive from the name.</p>
      </div>

      <div className="admin-field">
        <label htmlFor="author-credentials">Credentials</label>
        <input
          id="author-credentials"
          className="admin-input"
          value={form.credentials}
          onChange={set("credentials")}
          placeholder="e.g. Manga critic since 2010"
          maxLength={300}
        />
        <p className="admin-field-hint">Shown for E-E-A-T (experience / expertise).</p>
      </div>

      <div className="admin-field">
        <label htmlFor="author-bio">Bio</label>
        <textarea
          id="author-bio"
          className="admin-textarea"
          rows={5}
          value={form.bio}
          onChange={set("bio")}
          maxLength={2000}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="author-avatar">Avatar URL</label>
        <input
          id="author-avatar"
          className="admin-input"
          value={form.avatarUrl}
          onChange={set("avatarUrl")}
          placeholder="https://…"
        />
      </div>

      <fieldset className="admin-fieldset">
        <legend>Social links</legend>
        <div className="admin-form-row">
          {SOCIAL_FIELDS.map(([key, label]) => (
            <div className="admin-field" key={key}>
              <label htmlFor={`author-${key}`}>{label}</label>
              <input
                id={`author-${key}`}
                className="admin-input"
                value={social[key]}
                onChange={setS(key)}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="admin-msg error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create author"}
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() => router.push("/admin/authors")}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
