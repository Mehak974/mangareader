"use client";
import { useEffect } from "react";
import posthog from "posthog-js";

export default function AnalyticsProvider() {
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_API_HOST || "https://us.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
      });
    }
  }, []);
  return null;
}
