/**
 * Environment validation.
 *
 * Validates required environment variables once, at module load, and exposes a
 * strongly-typed `env` object. Fails fast with a clear message rather than
 * surfacing cryptic runtime errors deep in a request. No external dependency —
 * keeps the bundle lightweight.
 */

type EnvShape = {
  DATABASE_URL: string;
  AUTH_SECRET: string;
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_SCRAPER_URL: string;
  NODE_ENV: "development" | "production" | "test";
};

const isBuilding =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

function required(name: string, value: string | undefined, buildFallback = ""): string {
  if (!value || value.trim() === "") {
    if (isBuilding) {
      return buildFallback;
    }
    throw new Error(
      `Missing required environment variable: ${name}. See frontend/.env.example.`
    );
  }
  return value;
}

function validateUrl(name: string, value: string): string {
  try {
    // Throws on malformed URLs.
    new URL(value);
    return value;
  } catch {
    if (isBuilding) return "https://mangareader.pro";
    throw new Error(`Environment variable ${name} is not a valid URL: "${value}".`);
  }
}

const nodeEnv = (process.env.NODE_ENV ?? "development") as EnvShape["NODE_ENV"];

export const env: EnvShape = {
  DATABASE_URL: required(
    "DATABASE_URL",
    process.env.DATABASE_URL,
    "postgresql://placeholder:placeholder@localhost:5432/placeholder"
  ),
  AUTH_SECRET: (() => {
    const secret = required(
      "AUTH_SECRET",
      process.env.AUTH_SECRET,
      "01234567890123456789012345678901"
    );
    if (nodeEnv === "production" && secret.length < 32 && !isBuilding) {
      throw new Error(
        "AUTH_SECRET must be at least 32 characters in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    return secret;
  })(),
  NEXT_PUBLIC_SITE_URL: validateUrl(
    "NEXT_PUBLIC_SITE_URL",
    required(
      "NEXT_PUBLIC_SITE_URL",
      process.env.NEXT_PUBLIC_SITE_URL,
      "https://mangareader.pro"
    )
  ),
  NEXT_PUBLIC_SCRAPER_URL: validateUrl(
    "NEXT_PUBLIC_SCRAPER_URL",
    required(
      "NEXT_PUBLIC_SCRAPER_URL",
      process.env.NEXT_PUBLIC_SCRAPER_URL,
      "https://mangareader.pro"
    )
  ),
  NODE_ENV: nodeEnv,
};
