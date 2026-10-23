/**
 * SEO / GEO / AEO helpers.
 *
 * Central place for building Next.js `Metadata` objects and JSON-LD structured
 * data. All absolute URLs are derived from `env.NEXT_PUBLIC_SITE_URL` so the
 * canonical origin is defined in exactly one place.
 */
import type { Metadata } from "next";
import { env } from "@/lib/env";
import { SITE_NAME as CONFIG_SITE_NAME, SITE_URL as CONFIG_SITE_URL, SEO } from '@/lib/site-config';

/** Canonical site origin, without a trailing slash. */
export const SITE_URL = CONFIG_SITE_URL;

/** The public-facing site name. */
export const SITE_NAME = CONFIG_SITE_NAME;

const DEFAULT_DESCRIPTION = SEO.description;

/** The default social share image, served from the app's public directory. */
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.svg`;

/**
 * Resolve a path or absolute URL to an absolute URL rooted at the site origin.
 * Absolute inputs (http/https) are returned unchanged.
 */
export function absoluteUrl(pathOrUrl: string, domain?: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  const base = domain ? `https://${domain}` : SITE_URL;
  return `${base}${path}`;
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
  /** Request host domain for multi-domain canonical and SEO shielding */
  domain?: string;
};

export function getDomainSiteName(domain?: string): string {
  if (!domain) return SITE_NAME;
  if (domain.includes("mangaread.")) return "MangaRead";
  if (domain.includes("manireader")) return "ManiReader";
  return "MangaReader";
}

/**
 * Build a Next.js `Metadata` object with sensible SEO defaults: canonical URL,
 * OpenGraph, Twitter card, and multi-domain SEO shielding.
 */
export function buildMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  type = "website",
  image = DEFAULT_OG_IMAGE,
  noIndex = false,
  domain,
}: BuildMetadataInput): Metadata {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const activeDomain = domain || (SITE_URL ? new URL(SITE_URL).host : "mangareader.pro");
  const domainUrl = `https://${activeDomain}`;
  const canonicalUrl = `${domainUrl}${cleanPath}`;
  const imageUrl = image?.startsWith("http") ? image : `${domainUrl}${image?.startsWith("/") ? image : `/${image}`}`;
  const siteName = getDomainSiteName(activeDomain);

  // Multi-domain hreflang shielding: tells Google each mirror targets a specific region
  // preventing duplicate content penalties and enabling all 3 domains to rank simultaneously
  const languages: Record<string, string> = {
    "x-default": `https://mangareader.pro${cleanPath}`,
    "en": canonicalUrl,
    "en-US": `https://mangareader.pro${cleanPath}`,
    "en-GB": `https://mangaread.pro${cleanPath}`,
    "en-CA": `https://manireader.online${cleanPath}`,
  };

  return {
    metadataBase: new URL(domainUrl),
    title,
    description,
    alternates: {
      canonical: domain ? canonicalUrl : cleanPath,
      languages,
    },
    openGraph: {
      type,
      url: canonicalUrl,
      title,
      description,
      siteName,
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
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
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
export function organizationSchema(domain?: string): JsonLdObject {
  const activeDomain = domain || (SITE_URL ? new URL(SITE_URL).host : "mangareader.pro");
  const siteUrl = `https://${activeDomain}`;
  const siteName = getDomainSiteName(activeDomain);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    logo: `${siteUrl}/icon.png`,
  };
}

/**
 * Website schema with a SearchAction so search engines can expose a sitelinks
 * search box pointing at the browse page.
 */
export function websiteSchema(domain?: string): JsonLdObject {
  const activeDomain = domain || (SITE_URL ? new URL(SITE_URL).host : "mangareader.pro");
  const siteUrl = `https://${activeDomain}`;
  const siteName = getDomainSiteName(activeDomain);

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/browse?search={query}`,
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
export function breadcrumbSchema(items: BreadcrumbItem[], domain?: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url, domain),
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

/** Manga/Series schema for manga detail pages. */
export type MangaSchemaInput = {
  title: string;
  slug: string;
  description?: string;
  coverImage?: string;
  genres?: string[];
  author?: string;
  status?: string;
  chapters?: number;
  rating?: number;
  popularity?: number;
  datePublished?: string;
  alternativeTitles?: string[];
  domain?: string;
};

/**
 * Manga schema — for manga detail pages to enable rich results.
 * Uses Book type with Manga-specific properties.
 */
export function mangaSchema(manga: MangaSchemaInput): JsonLdObject {
  const activeDomain = manga.domain || (SITE_URL ? new URL(SITE_URL).host : "mangareader.pro");
  const siteUrl = `https://${activeDomain}`;
  const siteName = getDomainSiteName(activeDomain);

  const url = `${siteUrl}/manga/${manga.slug}`;
  const imageUrl = manga.coverImage
    ? manga.coverImage.startsWith("http")
      ? manga.coverImage
      : absoluteUrl(manga.coverImage, activeDomain)
    : undefined;
  const cleanDescription = (manga.description || `Read ${manga.title} manga online for free in high quality. Full chapter archive with English translations and daily updates.`)
    .replace(/<[^>]*>/g, '')
    .trim();

  const schema: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": ["Book", "ComicSeries"],
    name: manga.title,
    headline: `Read ${manga.title} Manga Online Free`,
    url,
    description: cleanDescription,
    genre: manga.genres?.length ? manga.genres : ["Manga"],
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: siteName,
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/icon.png`,
      },
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      category: "Free Online Manga",
    },
    potentialAction: {
      "@type": "ReadAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/manga/${manga.slug}`,
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
      expectsAcceptanceOf: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  };

  if (imageUrl) schema.image = imageUrl;
  if (manga.author) {
    schema.author = {
      "@type": "Person",
      name: manga.author,
    };
  }
  if (manga.status) {
    schema.creativeWorkStatus = manga.status;
    schema.publicationStatus = manga.status;
  }
  if (manga.chapters) schema.numberOfPages = manga.chapters;
  if (manga.rating) {
    const rVal = Number(manga.rating);
    const isOutOfTen = rVal > 5;
    const ratingCount = manga.popularity ? Math.max(150, Math.round(manga.popularity * 1.5)) : 350;
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rVal.toFixed(1),
      ratingCount,
      bestRating: isOutOfTen ? 10 : 5,
      worstRating: 1,
    };
  }
  if (manga.datePublished) schema.datePublished = manga.datePublished;
  if (manga.alternativeTitles?.length) {
    schema.alternativeHeadline = manga.alternativeTitles.join(", ");
  }

  return schema;
}

/** Chapter schema for chapter/reader pages. */
export type ChapterSchemaInput = {
  chapterNumber: string | number;
  title?: string;
  mangaTitle: string;
  mangaSlug: string;
  mangaUrl: string;
  datePublished?: string;
  imageUrls?: string[];
  domain?: string;
};

/**
 * Chapter schema — for chapter pages to link to parent series.
 */
export function chapterSchema(chapter: ChapterSchemaInput): JsonLdObject {
  const activeDomain = chapter.domain || (SITE_URL ? new URL(SITE_URL).host : "mangareader.pro");
  const siteUrl = `https://${activeDomain}`;
  const siteName = getDomainSiteName(activeDomain);

  const chapterNum = typeof chapter.chapterNumber === "string" ? chapter.chapterNumber : String(chapter.chapterNumber);
  const name = chapter.title ?? `Chapter ${chapterNum}`;
  const url = absoluteUrl(`/reader/${chapter.mangaSlug}/${chapterNum}`, activeDomain);

  return {
    "@context": "https://schema.org",
    "@type": "Chapter",
    name,
    url,
    description: `Read ${name} of ${chapter.mangaTitle} online.`,
    isPartOf: {
      "@type": "CreativeWorkSeries",
      name: chapter.mangaTitle,
      url: absoluteUrl(`/manga/${chapter.mangaSlug}`, activeDomain),
    },
    publisher: {
      "@type": "Organization",
      name: siteName,
      url: siteUrl,
    },
    datePublished: chapter.datePublished,
    position: typeof chapter.chapterNumber === "number" ? chapter.chapterNumber : parseInt(chapterNum, 10) || 1,
  };
}
