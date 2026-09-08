import { API_BASE } from "./api";

export async function loginWithAniList() {
  window.location.href = `${API_BASE}/auth/anilist`;
}

export async function logoutAniList() {
  await fetch(`${API_BASE}/auth/anilist/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
}

export async function getAniListUser() {
  try {
    const res = await fetch(`${API_BASE}/auth/anilist/me`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.user || null;
  } catch {
    return null;
  }
}
