/**
 * SEO / GEO / AEO helpers.
 *
 * Central place for building Next.js `Metadata` objects and JSON-LD structured
 * data. All absolute URLs are derived from `env.NEXT_PUBLIC_SITE_URL` so the
 * canonical origin is defined in exactly one place.
 */
import type { Metadata } from "next";
import { env } from "@/lib/env";

/** Canonical site origin, without a trailing slash. */
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");

/** The public-facing site name. */
export const SITE_NAME = "MangaReader";

const DEFAULT_DESCRIPTION =
  "Sync reading across devices. Bookmark chapters, track progress, discover new series — without ads.";

/** The default social share image, served from the app's public directory. */
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.svg`;

/**
 * Resolve a path or absolute URL to an absolute URL rooted at the site origin.
 * Absolute inputs (http/https) are returned unchanged.
 */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}

export type BuildMetadataInput = {
  /** Page title (fed through the layout's title template). */
  title: string;
  /** Meta description. Falls back to the site default when omitted. */
  description?: string;
  /** Canonical path or absolute URL for this page. */
  path?: string;
  /** OpenGraph object type. Defaults to "website". */
  type?: "website" | "article" | "profile";
  /** Social image path or absolute URL. Falls back to the site default. */
  image?: string;
  /** When true, instruct crawlers not to index the page. */
  noIndex?: boolean;
};

/**
 * Build a Next.js `Metadata` object with sensible SEO defaults: canonical URL,
 * OpenGraph, and Twitter card. Page-level metadata should spread or return the
 * result of this helper.
 */
export function buildMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  type = "website",
  image = DEFAULT_OG_IMAGE,
  noIndex = false,
}: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: SITE_NAME,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

/* ------------------------------------------------------------------ */
/* JSON-LD structured data                                            */
/* ------------------------------------------------------------------ */

type JsonLdObject = Record<string, unknown>;

/**
 * Organization schema — establishes the publishing entity for GEO/AEO and
 * knowledge-panel eligibility.
 */
export function organizationSchema(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
  };
}

/**
 * Website schema with a SearchAction so search engines can expose a sitelinks
 * search box pointing at the browse page.
 */
export function websiteSchema(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/browse?search={query}`,
      },
      "query-input": "required name=query",
    },
  };
}

/** Minimal shape of an article needed to build Article structured data. */
export type ArticleSchemaInput = {
  slug: string;
  title: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  coverImage?: string | null;
  ogImage?: string | null;
  canonicalUrl?: string | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  authorName?: string | null;
};

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Article schema for blog/editorial content. Used to power rich results and
 * to feed generative/answer engines with authoritative metadata.
 */
export function articleSchema(article: ArticleSchemaInput): JsonLdObject {
  const url = article.canonicalUrl
    ? absoluteUrl(article.canonicalUrl)
    : `${SITE_URL}/blog/${article.slug}`;
  const headline = article.seoTitle ?? article.title;
  const description = article.seoDescription ?? article.excerpt ?? undefined;
  const imageSource = article.ogImage ?? article.coverImage;
  const published = toIso(article.publishedAt);
  const modified = toIso(article.updatedAt) ?? published;

  const schema: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline,
    url,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.png`,
      },
    },
  };

  if (description) schema.description = description;
  if (imageSource) schema.image = absoluteUrl(imageSource);
  if (published) schema.datePublished = published;
  if (modified) schema.dateModified = modified;
  if (article.authorName) {
    schema.author = { "@type": "Person", name: article.authorName };
  }

  return schema;
}

/** A single breadcrumb entry: a visible name and the path/URL it points to. */
export type BreadcrumbItem = {
  name: string;
  url: string;
};

/**
 * BreadcrumbList schema — helps engines render breadcrumb trails and
 * understand site hierarchy.
 */
export function breadcrumbSchema(items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

/** A single question/answer pair for an FAQ block. */
export type FaqItem = {
  question: string;
  answer: string;
};

/**
 * FAQPage schema — core to AEO (answer-engine optimization); lets engines
 * surface question/answer pairs directly.
 */
export function faqSchema(items: FaqItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
