/**
 * seo.ts — SEO / JSON-LD helpers (multi-domain aware)
 *
 * Replaces src/lib/seo.ts
 *
 * The only change from the original: SITE_NAME and SITE_URL are now imported
 * from site-config.ts instead of being hardcoded. Everything else is identical.
 */

import type { Metadata } from 'next';
import { env }           from '@/lib/env';
import { siteConfig }    from '@/lib/site-config';

/** Canonical site origin, without a trailing slash. */
export const SITE_URL  = (process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url).replace(/\/+$/, '');

/** The public-facing site name — differs per domain. */
export const SITE_NAME = siteConfig.name;

const DEFAULT_DESCRIPTION = siteConfig.seo.description;
const DEFAULT_OG_IMAGE    = `${SITE_URL}${siteConfig.seo.ogImage}`;

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}

export type BuildMetadataInput = {
  title:        string;
  description?: string;
  path?:        string;
  type?:        'website' | 'article' | 'profile';
  image?:       string;
  noIndex?:     boolean;
};

export function buildMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path        = '/',
  type        = 'website',
  image       = DEFAULT_OG_IMAGE,
  noIndex     = false,
}: BuildMetadataInput): Metadata {
  const url      = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: SITE_NAME,
      images:   [{ url: imageUrl }],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      [imageUrl],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true,  follow: true  },
  };
}

// ── JSON-LD structured data ──────────────────────────────────────────────────

type JsonLdObject = Record<string, unknown>;

export function organizationSchema(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type':    'Organization',
    name:       SITE_NAME,
    url:        SITE_URL,
    logo:       `${SITE_URL}/icon.png`,
    sameAs:     [
      `https://twitter.com/${siteConfig.seo.twitterHandle}`,
    ],
  };
}

export function websiteSchema(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type':    'WebSite',
    name:       SITE_NAME,
    url:        SITE_URL,
    description: siteConfig.seo.tagline,
    potentialAction: {
      '@type':  'SearchAction',
      target: {
        '@type':       'EntryPoint',
        urlTemplate:   `${SITE_URL}/browse?search={query}`,
      },
      'query-input': 'required name=query',
    },
  };
}

export type ArticleSchemaInput = {
  slug:             string;
  title:            string;
  excerpt?:         string | null;
  seoTitle?:        string | null;
  seoDescription?:  string | null;
  coverImage?:      string | null;
  ogImage?:         string | null;
  canonicalUrl?:    string | null;
  publishedAt?:     Date | string | null;
  updatedAt?:       Date | string | null;
  authorName?:      string | null;
};

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function articleSchema(article: ArticleSchemaInput): JsonLdObject {
  const url         = article.canonicalUrl
                      ? absoluteUrl(article.canonicalUrl)
                      : `${SITE_URL}/blog/${article.slug}`;
  const headline    = article.seoTitle ?? article.title;
  const description = article.seoDescription ?? article.excerpt ?? undefined;
  const imageSource = article.ogImage ?? article.coverImage;
  const published   = toIso(article.publishedAt);
  const modified    = toIso(article.updatedAt) ?? published;

  const schema: JsonLdObject = {
    '@context':       'https://schema.org',
    '@type':          'Article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline,
    url,
    publisher: {
      '@type': 'Organization',
      name:    SITE_NAME,
      logo:    { '@type': 'ImageObject', url: `${SITE_URL}/icon.png` },
    },
  };

  if (description)          schema.description    = description;
  if (imageSource)          schema.image          = absoluteUrl(imageSource);
  if (published)            schema.datePublished  = published;
  if (modified)             schema.dateModified   = modified;
  if (article.authorName)   schema.author         = { '@type': 'Person', name: article.authorName };

  return schema;
}

export type BreadcrumbItem = { name: string; url: string };

export function breadcrumbSchema(items: BreadcrumbItem[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type':   'ListItem',
      position:  index + 1,
      name:      item.name,
      item:      absoluteUrl(item.url),
    })),
  };
}

export type FaqItem = { question: string; answer: string };

export function faqSchema(items: FaqItem[]): JsonLdObject {
  return {
    '@context':  'https://schema.org',
    '@type':     'FAQPage',
    mainEntity:  items.map(item => ({
      '@type':          'Question',
      name:             item.question,
      acceptedAnswer:   { '@type': 'Answer', text: item.answer },
    })),
  };
}
