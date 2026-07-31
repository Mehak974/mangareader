"use client";

import React from "react";
import { useApp } from "@/context/AppContext";

export default function HomeAuthNudge() {
  const { isLoggedIn, setSigninSheetOpen } = useApp();

  if (isLoggedIn) return null;

  return (
    <div className="nudge">
      <div>
        <h2>Get recommendations tailored to you</h2>
        <p>Sign in to see picks based on what you've read.</p>
      </div>
      <button className="nudge-btn" onClick={() => setSigninSheetOpen(true)}>
        Sign in free
      </button>
    </div>
  );
}
