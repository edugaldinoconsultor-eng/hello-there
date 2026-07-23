// MOCK — replace with real auth/session provider once backend is wired up.
// Architecture is multi-company from day 1: every domain query MUST scope by companyId.

export type UserRole =
  | "administrador"
  | "proprietario"
  | "gerente"
  | "vendedor"
  | "representante"
  | "financeiro"
  | "estoque";

export type Company = {
  id: string;
  name: string;
  slug: string;
};

export type SessionUser = {
  id: string;
  name: string;
  initials: string;
  role: UserRole;
  companyId: string;
};

export const currentCompany: Company = {
  id: "co_soul_001",
  name: "Distribuidora Soul",
  slug: "distribuidora-soul",
};

export const currentUser: SessionUser = {
  id: "usr_001",
  name: "Ricardo Mendes",
  initials: "RM",
  role: "administrador",
  companyId: currentCompany.id,
};
