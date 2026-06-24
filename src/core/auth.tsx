/*
 * Auth + role-based permissions (production / API-only).
 *
 * The app always runs against the live Fastify backend: a real JWT session
 * (from login()) is required, and user/role come from it. There is no demo or
 * mock session — when there is no session the app renders the login screen.
 *
 * UI gating reads `can(perm)` against the SHARED matrix (shared/authz) — the
 * same one the server enforces. UI gating is convenience; the API is the gate.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Role, User } from "@/shared/types";
import { can as canDo, type Permission } from "@/shared/authz";
import { api } from "@/core/api";
import {
  loadSession,
  saveSession,
  clearSession,
  type Session,
} from "@/core/session";

export type { Permission };
export { ROLE_LABELS } from "@/shared/authz";

interface AuthContextValue {
  user: User;
  role: Role;
  /** true once authenticated against the live API */
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  can: (perm: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Placeholder used only before login; the login screen gates real screens. */
const ANON_USER: User = {
  id: "",
  name: "",
  email: "",
  role: "auditor",
  active: false,
  created_at: "",
  created_by: "",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const value = useMemo<AuthContextValue>(() => {
    const isAuthenticated = !!session;
    const role: Role = session?.user.role ?? ANON_USER.role;

    const user: User = session
      ? {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          active: true,
          created_at: "",
          created_by: "",
        }
      : ANON_USER;

    return {
      user,
      role,
      isAuthenticated,
      can: (perm) => isAuthenticated && canDo(role, perm),
      login: async (identifier, password) => {
        const s = await api.login(identifier, password);
        saveSession(s);
        setSession(s);
        // reload so the data store hydrates from the live API snapshot
        window.location.assign("/");
      },
      logout: () => {
        clearSession();
        setSession(null);
        window.location.assign("/");
      },
    };
  }, [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
