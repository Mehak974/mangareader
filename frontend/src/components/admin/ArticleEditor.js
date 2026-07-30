"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const CONTENT_TYPES = ["BLOG", "REVIEW", "GUIDE", "RECOMMENDATION", "EDITORIAL", "NEWS"];
const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"];

/**
 * Create/edit form for editorial articles. `initial` is null for new posts or a
 * full article record for edits. Posts to /api/admin/articles (POST) or
 * /api/admin/articles/[id] (PATCH) and redirects to the list on success.
 */
export default function ArticleEditor({ initial, categories = [], authors = [] }) {
  const router = useRouter();
  const isEdit = !!initial;

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    excerpt: initial?.excerpt ?? "",
    body: initial?.body ?? "",
    coverImage: initial?.coverImage ?? "",
    contentType: initial?.contentType ?? "BLOG",
    status: initial?.status ?? "DRAFT",
    categoryId: initial?.categoryId ?? "",
    bylineId: initial?.bylineId ?? "",
    tagSlugs: (initial?.tags ?? []).map((t) => t.slug).join(", "),
    scheduledFor: initial?.scheduledFor
      ? new Date(initial.scheduledFor).toISOString().slice(0, 16)
      : "",
    seoTitle: initial?.seoTitle ?? "",
    seoDescription: initial?.seoDescription ?? "",
    canonicalUrl: initial?.canonicalUrl ?? "",
    ogImage: initial?.ogImage ?? "",
    relatedMangaIds: (initial?.relatedMangaIds ?? []).join(", "),
  });

  // Review sub-form (only relevant when contentType === REVIEW).
  const [review, setReview] = useState({
    mangaId: initial?.review?.mangaId ?? "",
    storyScore: initial?.review?.storyScore ?? "",
    charactersScore: initial?.review?.charactersScore ?? "",
    artworkScore: initial?.review?.artworkScore ?? "",
    worldScore: initial?.review?.worldScore ?? "",
    pacingScore: initial?.review?.pacingScore ?? "",
    overallScore: initial?.review?.overallScore ?? "",
    strengths: (initial?.review?.strengths ?? []).join("\n"),
    weaknesses: (initial?.review?.weaknesses ?? []).join("\n"),
    verdict: initial?.review?.verdict ?? "",
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setR = (k) => (e) => setReview((r) => ({ ...r, [k]: e.target.value }));

  const buildPayload = () => {
    const csv = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
    const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
    const num = (v) => (v === "" || v === null ? null : Number(v));

    const payload = {
      title: form.title,
      slug: form.slug || undefined,
      excerpt: form.excerpt || undefined,
      body: form.body,
      coverImage: form.coverImage || undefined,
      contentType: form.contentType,
      status: form.status,
      categoryId: form.categoryId || undefined,
      bylineId: form.bylineId || undefined,
      tagSlugs: csv(form.tagSlugs),
      scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : undefined,
      seoTitle: form.seoTitle || undefined,
      seoDescription: form.seoDescription || undefined,
      canonicalUrl: form.canonicalUrl || undefined,
      ogImage: form.ogImage || undefined,
      relatedMangaIds: csv(form.relatedMangaIds),
    };
    if (form.contentType === "REVIEW") {
      payload.review = {
        mangaId: review.mangaId || undefined,
        storyScore: num(review.storyScore),
        charactersScore: num(review.charactersScore),
        artworkScore: num(review.artworkScore),
        worldScore: num(review.worldScore),
        pacingScore: num(review.pacingScore),
        overallScore: num(review.overallScore),
        strengths: lines(review.strengths),
        weaknesses: lines(review.weaknesses),
        verdict: review.verdict || undefined,
      };
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const url = isEdit ? `/api/admin/articles/${initial.id}` : "/api/admin/articles";
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
        setError(data.error || "Could not save the article.");
        return;
      }
      router.push("/admin/articles");
      router.refresh();
    } catch {
      setSaving(false);
      setError("Network error. Please try again.");
    }
  };

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-form-grid">
        <div className="admin-form-main">
          <label className="admin-field">
            <span>Title</span>
            <input className="admin-input" value={form.title} onChange={set("title")} required />
          </label>

          <label className="admin-field">
            <span>Slug <em>(optional — generated from title)</em></span>
            <input className="admin-input" value={form.slug} onChange={set("slug")} placeholder="auto" />
          </label>

          <label className="admin-field">
            <span>Excerpt</span>
            <textarea className="admin-input" rows={2} value={form.excerpt} onChange={set("excerpt")} maxLength={300} />
          </label>

          <label className="admin-field">
            <span>Body <em>(Markdown)</em></span>
            <textarea className="admin-input admin-mono" rows={20} value={form.body} onChange={set("body")} required />
          </label>

          {form.contentType === "REVIEW" && (
            <fieldset className="admin-fieldset">
              <legend>Review scores &amp; verdict</legend>
              <label className="admin-field">
                <span>Manga ID <em>(scraper id this review targets)</em></span>
                <input className="admin-input" value={review.mangaId} onChange={setR("mangaId")} />
              </label>
              <div className="admin-score-grid">
                {[
                  ["storyScore", "Story"],
                  ["charactersScore", "Characters"],
                  ["artworkScore", "Artwork"],
                  ["worldScore", "World"],
                  ["pacingScore", "Pacing"],
                  ["overallScore", "Overall"],
                ].map(([k, label]) => (
                  <label key={k} className="admin-field">
                    <span>{label} <em>(0–100)</em></span>
                    <input
                      className="admin-input"
                      type="number"
                      min={0}
                      max={100}
                      value={review[k]}
                      onChange={setR(k)}
                    />
                  </label>
                ))}
              </div>
              <label className="admin-field">
                <span>Strengths <em>(one per line)</em></span>
                <textarea className="admin-input" rows={3} value={review.strengths} onChange={setR("strengths")} />
              </label>
              <label className="admin-field">
                <span>Weaknesses <em>(one per line)</em></span>
                <textarea className="admin-input" rows={3} value={review.weaknesses} onChange={setR("weaknesses")} />
              </label>
              <label className="admin-field">
                <span>Verdict</span>
                <textarea className="admin-input" rows={2} value={review.verdict} onChange={setR("verdict")} />
              </label>
            </fieldset>
          )}
        </div>

        <aside className="admin-form-side">
          <label className="admin-field">
            <span>Type</span>
            <select className="admin-input" value={form.contentType} onChange={set("contentType")}>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Status</span>
            <select className="admin-input" value={form.status} onChange={set("status")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          {form.status === "SCHEDULED" && (
            <label className="admin-field">
              <span>Publish at</span>
              <input className="admin-input" type="datetime-local" value={form.scheduledFor} onChange={set("scheduledFor")} />
            </label>
          )}

          <label className="admin-field">
            <span>Category</span>
            <select className="admin-input" value={form.categoryId} onChange={set("categoryId")}>
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {authors.length > 0 && (
            <label className="admin-field">
              <span>Byline author</span>
              <select className="admin-input" value={form.bylineId} onChange={set("bylineId")}>
                <option value="">— none —</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="admin-field">
            <span>Tags <em>(comma-separated)</em></span>
            <input className="admin-input" value={form.tagSlugs} onChange={set("tagSlugs")} placeholder="shonen, action" />
          </label>

          <label className="admin-field">
            <span>Cover image URL</span>
            <input className="admin-input" value={form.coverImage} onChange={set("coverImage")} />
          </label>

          <label className="admin-field">
            <span>Related manga IDs <em>(comma-separated)</em></span>
            <input className="admin-input" value={form.relatedMangaIds} onChange={set("relatedMangaIds")} />
          </label>

          <details className="admin-seo">
            <summary>SEO overrides</summary>
            <label className="admin-field">
              <span>SEO title</span>
              <input className="admin-input" value={form.seoTitle} onChange={set("seoTitle")} maxLength={160} />
            </label>
            <label className="admin-field">
              <span>SEO description</span>
              <textarea className="admin-input" rows={2} value={form.seoDescription} onChange={set("seoDescription")} maxLength={300} />
            </label>
            <label className="admin-field">
              <span>Canonical URL</span>
              <input className="admin-input" value={form.canonicalUrl} onChange={set("canonicalUrl")} />
            </label>
            <label className="admin-field">
              <span>OG image URL</span>
              <input className="admin-input" value={form.ogImage} onChange={set("ogImage")} />
            </label>
          </details>
        </aside>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create article"}
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() => router.push("/admin/articles")}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
