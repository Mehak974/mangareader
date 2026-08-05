/**
 * Zod validation schemas shared across auth and editorial API routes.
 * Centralised so request shapes stay consistent and messages are uniform.
 */
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200, "Password is too long."),
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(50, "Display name is too long."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  subject: z.string().trim().min(3, "Subject is too short.").max(150),
  message: z.string().trim().min(10, "Message must be at least 10 characters.").max(5000),
  // Honeypot: real users leave this empty; bots fill every field.
  website: z.string().max(0).optional().or(z.literal("")),
});

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

const CONTENT_TYPES = ["BLOG", "REVIEW", "GUIDE", "RECOMMENDATION", "EDITORIAL", "NEWS"] as const;
const CONTENT_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

// Structured review scores (0-100) attached to a REVIEW article.
const reviewSchema = z.object({
  mangaId: z.string().trim().max(64).optional().or(z.literal("")),
  storyScore: z.number().int().min(0).max(100).nullable().optional(),
  charactersScore: z.number().int().min(0).max(100).nullable().optional(),
  artworkScore: z.number().int().min(0).max(100).nullable().optional(),
  worldScore: z.number().int().min(0).max(100).nullable().optional(),
  pacingScore: z.number().int().min(0).max(100).nullable().optional(),
  overallScore: z.number().int().min(0).max(100).nullable().optional(),
  strengths: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  weaknesses: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  verdict: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const articleSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(160),
  slug: z.string().trim().max(80).optional().or(z.literal("")),
  excerpt: z.string().trim().max(300).optional().or(z.literal("")),
  body: z.string().trim().min(1, "Body cannot be empty."),
  coverImage: z.string().trim().regex(/^(https?:\/\/|\/)/, "Cover image must be a valid URL or absolute path").optional().or(z.literal("")),
  contentType: z.enum(CONTENT_TYPES).default("BLOG"),
  status: z.enum(CONTENT_STATUSES).default("DRAFT"),
  bylineId: z.string().trim().optional().or(z.literal("")),
  categoryId: z.string().trim().optional().or(z.literal("")),
  tagSlugs: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  scheduledFor: z.string().datetime().optional().or(z.literal("")),
  seoTitle: z.string().trim().max(160).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(300).optional().or(z.literal("")),
  canonicalUrl: z.string().trim().url().optional().or(z.literal("")),
  ogImage: z.string().trim().url().optional().or(z.literal("")),
  relatedMangaIds: z.array(z.string().trim().max(64)).max(24).optional(),
  review: reviewSchema.optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(2, "Comment is too short.").max(4000, "Comment is too long."),
  // Exactly one target is required; enforced in the route.
  mangaId: z.string().trim().max(64).optional().or(z.literal("")),
  articleId: z.string().trim().max(64).optional().or(z.literal("")),
  parentId: z.string().trim().max(64).optional().or(z.literal("")),
});

export type CommentInput = z.infer<typeof commentSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

export const tagSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(50),
});

// Editorial byline persona. `slug` is optional and auto-derived from the name
// when omitted. `socialLinks` is a free-form map of network → handle/URL.
export const authorSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  slug: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  avatarUrl: z.string().trim().url("Avatar must be a URL.").optional().or(z.literal("")),
  credentials: z.string().trim().max(300).optional().or(z.literal("")),
  socialLinks: z.record(z.string(), z.string().trim().max(300)).optional(),
});

// Admin-only mutation of a user's role and/or ban state. Every field is
// optional so a request can change just the role, just the ban, or both.
export const userAdminSchema = z
  .object({
    role: z.enum(["USER", "EDITOR", "ADMIN"]).optional(),
    banned: z.boolean().optional(),
    bannedReason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => d.role !== undefined || d.banned !== undefined, {
    message: "Nothing to update.",
  });

export type ArticleInput = z.infer<typeof articleSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type AuthorInput = z.infer<typeof authorSchema>;
export type UserAdminInput = z.infer<typeof userAdminSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type NewsletterInput = z.infer<typeof newsletterSchema>;

/** Flatten a ZodError into a single user-facing message. */
export function firstZodMessage(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input.";
}

/** Shape of a User safe to expose to the client (never the password hash). */
export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "USER" | "EDITOR" | "ADMIN";
};

/** Strip a Prisma User down to client-safe fields. */
export function publicUser(user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "USER" | "EDITOR" | "ADMIN";
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}
