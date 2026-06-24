/*
 * API session storage — JWT + the authenticated user, persisted to localStorage.
 * Kept separate from the React auth context so the api client can read the token
 * without a hook.
 */

import type { Role } from "@/shared/types";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Session {
  token: string;
  user: SessionUser;
}

const KEY = "ceos.session.v1";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

export function getToken(): string | null {
  return loadSession()?.token ?? null;
}
