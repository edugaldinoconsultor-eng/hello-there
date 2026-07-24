// Sessão do SoulERP.
//
// Após a integração com o backend real (Hostinger), a sessão é hidratada
// via `GET /auth/me` e mantida em memória. Nada é gravado em localStorage
// (o cookie `soulerp_sid` é HttpOnly e vive só no navegador).
//
// Para preservar os mocks internos (products/orders/customers), mantemos
// um `currentCompany` fixo com o id mock; a empresa REAL da sessão vive em
// `activeCompany` e é usada pelo Sidebar/Header para exibição e pelo
// endpoint de switch-company.

import { useEffect, useSyncExternalStore } from "react";

export type Role =
  | "owner"
  | "admin"
  | "manager"
  | "seller"
  | "finance"
  | "stock";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gerente",
  seller: "Vendedor",
  finance: "Financeiro",
  stock: "Estoque",
};

export type Company = {
  id: string;
  name: string;
  slug: string;
};

export type SessionUser = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  companyId: string;
  active: boolean;
};

// ---------- empresa "mock" (mantém products/orders/customers funcionando) ----------
export const currentCompany: Company = {
  id: "co_soul_001",
  name: "Distribuidora Soul",
  slug: "distribuidora-soul",
};

// ---------- usuário "mock" default (só antes do bootstrap /me) ----------
const DEFAULT_USER: SessionUser = {
  id: "usr_local",
  name: "Convidado",
  initials: "SO",
  email: "",
  role: "admin",
  companyId: currentCompany.id,
  active: true,
};

export const currentUser: SessionUser = { ...DEFAULT_USER };

// ---------- estado reativo ----------
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  status: AuthStatus;
  user: SessionUser;
  activeCompany: Company;
  companies: Company[];
};

const state: AuthState = {
  status: "loading",
  user: currentUser,
  activeCompany: { ...currentCompany },
  companies: [],
};

const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SO";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function normalizeRole(role: unknown): Role {
  const r = String(role ?? "").toLowerCase();
  if (r === "owner" || r === "admin" || r === "manager" || r === "seller" || r === "finance" || r === "stock") {
    return r;
  }
  // Compatibilidade com nomes alternativos que o backend possa emitir.
  if (r === "representative") return "seller";
  if (r === "inventory" || r === "estoque") return "stock";
  if (r === "financeiro") return "finance";
  return "seller";
}

export type ApiSessionPayload = {
  user: { id: string | number; name: string; email: string; role: string; active?: boolean };
  company: { id: string | number; name: string; slug?: string };
  companies?: Array<{ id: string | number; name: string; slug?: string; role?: string }>;
};

export function applyApiSession(payload: ApiSessionPayload) {
  const role = normalizeRole(payload.user.role);
  const uid = String(payload.user.id);
  const cid = String(payload.company.id);

  Object.assign(currentUser, {
    id: uid,
    name: payload.user.name,
    email: payload.user.email,
    initials: initialsFromName(payload.user.name),
    role,
    // Mantemos companyId no id mock para preservar mocks internos.
    companyId: currentCompany.id,
    active: payload.user.active ?? true,
  } as SessionUser);

  state.status = "authenticated";
  state.user = currentUser;
  state.activeCompany = {
    id: cid,
    name: payload.company.name,
    slug: payload.company.slug ?? String(payload.company.name).toLowerCase().replace(/\s+/g, "-"),
  };
  state.companies = (payload.companies ?? []).map((c) => ({
    id: String(c.id),
    name: c.name,
    slug: c.slug ?? String(c.name).toLowerCase().replace(/\s+/g, "-"),
  }));
  notify();
}

export function clearApiSession() {
  Object.assign(currentUser, DEFAULT_USER);
  state.status = "unauthenticated";
  state.user = currentUser;
  state.activeCompany = { ...currentCompany };
  state.companies = [];
  notify();
}

export function markAuthLoading() {
  state.status = "loading";
  notify();
}

export function getAuthStatus(): AuthStatus {
  return state.status;
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => { subs.delete(cb); };
}

/** Hook reativo — devolve user + empresa ativa exibida na UI. */
export function useSession(): { user: SessionUser; company: Company } {
  const snap = useSyncExternalStore(subscribe, () => state, () => state);
  return { user: snap.user, company: snap.activeCompany };
}

export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(subscribe, () => state.status, () => state.status);
}

export function useAuthCompanies(): Company[] {
  return useSyncExternalStore(subscribe, () => state.companies, () => state.companies);
}

// ---------- shims legados (mantidos para não quebrar imports antigos) ----------
export const MOCK_USERS: SessionUser[] = [];
export function setCurrentUserId(_id: string): void { /* no-op: autenticação real */ }
export function getCurrentUser(): SessionUser { return currentUser; }

// Hidrata status inicial no cliente (sem SSR mismatch).
export function useHydrateAuthStatus() {
  useEffect(() => {
    // noop — a hidratação real é feita pelo AuthGate chamando /auth/me.
  }, []);
}
