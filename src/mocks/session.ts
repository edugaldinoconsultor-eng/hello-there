// MOCK — sessão e usuários para desenvolvimento.
//
// Arquitetura preparada para o modelo definitivo:
//   User × Company × Role (CompanyUser)
// Hoje: um mesmo usuário só está numa empresa; a `role` já vive na relação
// (`SessionUser.role`) e não no perfil global — quando existir o modelo
// multiempresa por usuário, o switcher escolherá a linha CompanyUser
// correta em vez de mudar o usuário.
//
// Toda leitura de domínio SEMPRE escopa por `currentCompany.id`. Nunca
// permita que um usuário acesse dados fora da empresa ativa.

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

export const currentCompany: Company = {
  id: "co_soul_001",
  name: "Distribuidora Soul",
  slug: "distribuidora-soul",
};

// --- usuários mock, um por perfil, todos escopados na mesma empresa ---
export const MOCK_USERS: SessionUser[] = [
  { id: "usr_owner",   name: "Eduardo Oliveira", initials: "EO", email: "eduardo@soul.com",  role: "owner",   companyId: currentCompany.id, active: true },
  { id: "usr_admin",   name: "Ricardo Mendes",   initials: "RM", email: "ricardo@soul.com",  role: "admin",   companyId: currentCompany.id, active: true },
  { id: "usr_manager", name: "Camila Duarte",    initials: "CD", email: "camila@soul.com",   role: "manager", companyId: currentCompany.id, active: true },
  { id: "usr_seller",  name: "Bruno Freitas",    initials: "BF", email: "bruno@soul.com",    role: "seller",  companyId: currentCompany.id, active: true },
  { id: "usr_finance", name: "Larissa Prado",    initials: "LP", email: "larissa@soul.com",  role: "finance", companyId: currentCompany.id, active: true },
  { id: "usr_stock",   name: "Marcos Almeida",   initials: "MA", email: "marcos@soul.com",   role: "stock",   companyId: currentCompany.id, active: true },
];

const STORAGE_KEY = "soulerp.dev.currentUserId";

function readInitialUserId(): string {
  if (typeof window === "undefined") return "usr_admin";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && MOCK_USERS.some((u) => u.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return "usr_admin";
}

let _currentUserId = "usr_admin";
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

// Objeto mutável exportado para consumidores não-reativos (ex.: mocks/orders).
// Componentes React devem usar `useSession()` para reagir a mudanças.
export const currentUser: SessionUser = { ...MOCK_USERS.find((u) => u.id === _currentUserId)! };

function applyUser(id: string) {
  const u = MOCK_USERS.find((x) => x.id === id);
  if (!u) return;
  _currentUserId = u.id;
  Object.assign(currentUser, u);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, u.id);
    } catch {
      /* ignore */
    }
  }
  notify();
}

export function getCurrentUser(): SessionUser {
  return currentUser;
}

export function setCurrentUserId(id: string) {
  applyUser(id);
}

/** Hook reativo. Todo componente que decide por perfil deve usar isto. */
export function useSession(): { user: SessionUser; company: Company } {
  // Hidrata a partir do localStorage no cliente (evita mismatch no SSR).
  useEffect(() => {
    const id = readInitialUserId();
    if (id !== _currentUserId) applyUser(id);
  }, []);

  const user = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => currentUser,
    () => currentUser,
  );

  return { user, company: currentCompany };
}
