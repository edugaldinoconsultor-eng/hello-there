/**
 * Camada centralizada de permissões do SoulERP.
 *
 * REGRAS
 *  - Toda decisão de acesso passa por `hasPermission` / `can` / `canAccessRoute`.
 *  - Nunca duplicar lógica de perfil dentro de componentes.
 *  - Esconder UI NÃO substitui checagem: ações também devem validar via
 *    `assertPermission` antes de executar mutações.
 *  - O modelo já está preparado para o futuro CompanyUser (role vive na
 *    relação usuário × empresa). Hoje a role sai de `SessionUser.role`,
 *    mas nada mais precisa mudar quando a tabela existir.
 *
 * FUTURO — RLS/Supabase
 *  - Cada permissão desta matriz mapeia direto para uma policy: por exemplo,
 *    `orders.view` → SELECT em `orders` limitado ao `company_id` do JWT e,
 *    para `seller`, também `seller_id = auth.uid()`.
 *  - `canAccessOrder` reproduz aqui a mesma cláusula que a policy fará no
 *    banco — quando ligarmos o backend, remova o filtro em memória e a
 *    RLS assume; o helper permanece útil para gating de UI.
 *
 * FUTURO — Soul AI
 *  - `getAIDataScope(user)` devolve `company | team | self`. A IA deve
 *    montar toda consulta a partir desse escopo + `currentCompany.id`.
 *  - Consultas explicitamente proibidas para o perfil devem responder com
 *    o mesmo texto padronizado ao invés de retornar dados globais.
 */
import type { Role, SessionUser } from "@/mocks/session";
import type { Order } from "@/lib/order-types";

// ---------- catálogo de permissões ----------

export const PERMISSIONS = [
  // clientes
  "customers.view",
  "customers.create",
  "customers.edit",
  "customers.delete",

  // pedidos
  "orders.view",
  "orders.view.all",     // ver pedidos de outros vendedores
  "orders.create",
  "orders.edit",
  "orders.cancel",

  // produtos
  "products.view",
  "products.create",
  "products.edit",
  "products.price.edit",

  // estoque
  "stock.view",
  "stock.adjust",

  // financeiro
  "finance.view",
  "finance.view.sensitive", // faturamento global, inadimplência total
  "finance.receivables.manage",

  // relatórios
  "reports.view.commercial",
  "reports.view.finance",
  "reports.view.admin",

  // admin
  "users.manage",
  "company.manage",
  "settings.access",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// ---------- matriz por perfil ----------

const ALL: Permission[] = [...PERMISSIONS];

const MATRIX: Record<Role, Permission[]> = {
  owner: ALL,

  admin: ALL.filter((p) => p !== "company.manage"), // reserva algo exclusivo do owner (futuro)

  manager: [
    "customers.view", "customers.create", "customers.edit",
    "orders.view", "orders.view.all", "orders.create", "orders.edit", "orders.cancel",
    "products.view", "products.create",
    "stock.view",
    "reports.view.commercial",
    "settings.access",
  ],

  seller: [
    "customers.view", "customers.create", "customers.edit",
    "orders.view",              // apenas os próprios — regra aplicada em canAccessOrder
    "orders.create", "orders.edit",
    "products.view",
    "stock.view",
  ],

  finance: [
    "customers.view",
    "orders.view", "orders.view.all",
    "products.view",
    "finance.view", "finance.view.sensitive", "finance.receivables.manage",
    "reports.view.finance",
  ],

  stock: [
    "orders.view", "orders.view.all", // separação/expedição
    "products.view",
    "stock.view",
  ],
};

// ---------- helpers ----------

export function permissionsFor(user: Pick<SessionUser, "role" | "active">): ReadonlySet<Permission> {
  if (!user.active) return new Set();
  return new Set(MATRIX[user.role] ?? []);
}

export function hasPermission(
  user: Pick<SessionUser, "role" | "active">,
  permission: Permission,
): boolean {
  return permissionsFor(user).has(permission);
}

/** Alias curto para uso em componentes. */
export const can = hasPermission;

export function hasAny(
  user: Pick<SessionUser, "role" | "active">,
  permissions: Permission[],
): boolean {
  const set = permissionsFor(user);
  return permissions.some((p) => set.has(p));
}

/**
 * Valida antes de executar uma ação. Use em handlers para garantir que
 * ocultar o botão não é a única barreira.
 */
export function assertPermission(
  user: Pick<SessionUser, "role" | "active">,
  permission: Permission,
): void {
  if (!hasPermission(user, permission)) {
    throw new Error(`Permissão negada: ${permission}`);
  }
}

// ---------- rotas ----------

/**
 * Mapa rota → permissão mínima. Rotas ausentes são livres para qualquer
 * usuário autenticado da empresa.
 */
export const ROUTE_PERMISSION: Record<string, Permission> = {
  "/": "orders.view",              // Home mostra métricas — precisa ver pedidos
  "/clientes": "customers.view",
  "/pedidos": "orders.view",
  "/produtos": "products.view",
  "/estoque": "stock.view",
  "/financeiro": "finance.view",
  "/inteligencia": "reports.view.commercial",
  "/configuracoes": "settings.access",
};

export function canAccessRoute(
  user: Pick<SessionUser, "role" | "active">,
  path: string,
): boolean {
  const required = ROUTE_PERMISSION[path];
  if (!required) return true;
  return hasPermission(user, required);
}

// ---------- acesso a pedido individual ----------

/**
 * Regra centralizada — NÃO espalhe `order.sellerId === user.id` na UI.
 * Mesma cláusula que a RLS aplicará no banco.
 */
export function canAccessOrder(
  user: Pick<SessionUser, "id" | "role" | "active" | "companyId">,
  order: Pick<Order, "companyId" | "sellerId">,
): boolean {
  if (!user.active) return false;
  if (order.companyId !== user.companyId) return false;
  if (hasPermission(user, "orders.view.all")) return true;
  // seller enxerga só os próprios pedidos
  return !!order.sellerId && order.sellerId === user.id;
}

export function canEditOrder(
  user: Pick<SessionUser, "id" | "role" | "active" | "companyId">,
  order: Pick<Order, "companyId" | "sellerId" | "status">,
): boolean {
  if (!canAccessOrder(user, order)) return false;
  if (!hasPermission(user, "orders.edit")) return false;
  // Regra futura por status: rascunho/pending sempre; confirmed depende de perfil.
  if (order.status === "cancelled") return false;
  if (order.status === "confirmed" && user.role === "seller") return false;
  return true;
}

export function canCancelOrder(
  user: Pick<SessionUser, "id" | "role" | "active" | "companyId">,
  order: Pick<Order, "companyId" | "sellerId" | "status">,
): boolean {
  if (!canAccessOrder(user, order)) return false;
  if (order.status === "cancelled") return false;
  return hasPermission(user, "orders.cancel");
}

// ---------- escopo para Soul AI ----------

export type AIDataScope = "company" | "team" | "self" | "none";

/**
 * Escopo máximo que a IA pode consultar em nome do usuário atual.
 *  - company: dados globais da empresa
 *  - team:    dados do time (ex.: gerente vê seus vendedores)
 *  - self:    apenas o próprio recorte (ex.: vendedor)
 *  - none:    sem acesso a analytics
 *
 * O prompt/servidor da IA DEVE ler este escopo + `currentCompany.id`
 * antes de qualquer consulta.
 */
export function getAIDataScope(user: Pick<SessionUser, "role" | "active">): AIDataScope {
  if (!user.active) return "none";
  switch (user.role) {
    case "owner":
    case "admin":
    case "finance":
      return "company";
    case "manager":
      return "team";
    case "seller":
      return "self";
    case "stock":
      return "none"; // acessa só dados operacionais via permissões diretas
  }
}
