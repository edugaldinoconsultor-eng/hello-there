/**
 * Service de Clientes — integrado ao backend real (Hostinger).
 *
 * Endpoints usados:
 *   GET   /customers            → lista da empresa da sessão
 *   GET   /customers/{id}       → detalhe
 *   POST  /customers            → cria (snake_case conforme CustomerController)
 *   PATCH /customers/{id}       → edita (backend ainda responde 501 — bloqueado)
 *
 * A empresa é derivada da sessão (cookie HttpOnly). O frontend NUNCA envia
 * company_id. CSRF e credenciais são cuidados pelo `api-client` central.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "./api-client";
import type {
  PaymentTerm,
  PersonType,
  PriceTable,
} from "@/mocks/customers";

// ---------- Tipos do domínio (mesmo shape que a UI já consome) ----------

export type CustomerAddress = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
};

export type CustomerCommercial = {
  salespersonId?: string;
  salespersonName?: string;
  priceTable?: PriceTable;
  creditLimit?: number;
  paymentTerm?: PaymentTerm;
  notes?: string;
};

export type CustomerStatus = {
  active: boolean;
  /**
   * O backend atual não persiste "diamond". Mantemos no tipo para não
   * quebrar a UI, mas sempre chega como `false` do servidor.
   */
  diamond: boolean;
};

export type CustomerAggregates = {
  totalOrders?: number;
  lastPurchaseAt?: string;
  averageTicket?: number;
  purchaseFrequencyDays?: number;
  topProductIds?: string[];
  pendingReceivables?: number;
  creditUsed?: number;
};

export type Customer = {
  id: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;

  personType: PersonType;
  legalName: string;
  tradeName?: string;
  document?: string;
  phone: string;
  email?: string;

  address: CustomerAddress;
  commercial: CustomerCommercial;
  status: CustomerStatus;
  aggregates: CustomerAggregates;
};

export type NewCustomerInput = Omit<
  Customer,
  "id" | "companyId" | "createdAt" | "updatedAt" | "aggregates"
>;

// ---------- Mapeamento API ↔ domínio ----------

type ApiCustomerRow = {
  id: string | number;
  company_id?: string | number;
  name: string;
  fantasy_name?: string | null;
  document?: string | null;
  phone: string;
  email?: string | null;
  address_zip_code?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  seller_id?: string | number | null;
  price_table?: string | null;
  credit_limit?: string | number | null;
  payment_term?: string | null;
  notes?: string | null;
  active?: number | boolean | null;
  created_at?: string;
  updated_at?: string;
};

function s(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const str = String(v).trim();
  return str === "" ? undefined : str;
}

function n(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : undefined;
}

function fromApi(row: ApiCustomerRow): Customer {
  // person_type NÃO existe no banco real — inferido só localmente pelo documento.
  const doc = s(row.document) ?? "";
  const digits = doc.replace(/\D/g, "");
  const personType: PersonType = digits.length === 14 ? "PJ" : "PF";
  return {
    id: String(row.id),
    companyId: row.company_id !== undefined ? String(row.company_id) : "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    personType,
    legalName: row.name,
    tradeName: s(row.fantasy_name),
    document: s(row.document),
    phone: row.phone ?? "",
    email: s(row.email),
    address: {
      cep: s(row.address_zip_code),
      street: s(row.address_street),
      number: s(row.address_number),
      complement: s(row.address_complement),
      district: s(row.address_neighborhood),
      city: s(row.address_city),
      state: s(row.address_state),
    },
    commercial: {
      salespersonId: s(row.seller_id),
      priceTable: (s(row.price_table) as PriceTable | undefined) ?? undefined,
      creditLimit: n(row.credit_limit),
      paymentTerm: (s(row.payment_term) as PaymentTerm | undefined) ?? undefined,
      notes: s(row.notes),
    },
    status: {
      active: row.active === undefined || row.active === null ? true : Boolean(Number(row.active)),
      diamond: false,
    },
    aggregates: {},
  };
}

type ApiCreateBody = {
  name: string;
  phone: string;
  address_street: string;
  fantasy_name?: string;
  document?: string;
  email?: string;
  address_zip_code?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  seller_id?: string;
  price_table?: PriceTable;
  credit_limit?: number;
  payment_term?: PaymentTerm;
  notes?: string;
};

function toApiCreate(input: NewCustomerInput): ApiCreateBody {
  const addr = input.address ?? {};
  const com = input.commercial ?? {};
  const body: ApiCreateBody = {
    name: input.legalName,
    phone: input.phone,
    address_street: addr.street ?? "",
  };
  // person_type NÃO existe no banco — não enviar.
  if (input.tradeName) body.fantasy_name = input.tradeName;
  if (input.document) body.document = input.document;
  if (input.email) body.email = input.email;
  if (addr.cep) body.address_zip_code = addr.cep;
  if (addr.number) body.address_number = addr.number;
  if (addr.complement) body.address_complement = addr.complement;
  if (addr.district) body.address_neighborhood = addr.district;
  if (addr.city) body.address_city = addr.city;
  if (addr.state) body.address_state = addr.state;
  if (com.salespersonId) body.seller_id = com.salespersonId;
  if (com.priceTable) body.price_table = com.priceTable;
  if (typeof com.creditLimit === "number") body.credit_limit = com.creditLimit;
  if (com.paymentTerm) body.payment_term = com.paymentTerm;
  if (com.notes) body.notes = com.notes;
  return body;
}

// ---------- Fachada de rede ----------

function extractRows(raw: unknown): ApiCustomerRow[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw as ApiCustomerRow[];
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as ApiCustomerRow[];
    if (obj.data && typeof obj.data === "object") {
      const inner = (obj.data as Record<string, unknown>).data;
      if (Array.isArray(inner)) return inner as ApiCustomerRow[];
    }
    if (Array.isArray(obj.rows)) return obj.rows as ApiCustomerRow[];
    if (Array.isArray(obj.items)) return obj.items as ApiCustomerRow[];
  }
  // Payload inesperado — logar para diagnóstico e tratar como vazio (não erro).
  // eslint-disable-next-line no-console
  console.warn("[customers.service] payload inesperado de GET /customers:", raw);
  return [];
}


export const customersService = {
  async list(): Promise<Customer[]> {
    const raw = await apiFetch<unknown>("/customers");
    // Defesa: aceitar array puro, { data: [...] } (caso o api-client não tenha
    // desembrulhado por algum motivo), { data: { data: [...] } }, ou null/vazio.
    const rows = extractRows(raw);
    return rows.map(fromApi);
  },

  async getById(id: string): Promise<Customer | undefined> {
    try {
      const row = await apiFetch<ApiCustomerRow>(`/customers/${encodeURIComponent(id)}`);
      return row ? fromApi(row) : undefined;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },
  async create(input: NewCustomerInput): Promise<Customer> {
    const row = await apiFetch<ApiCustomerRow>("/customers", {
      method: "POST",
      body: toApiCreate(input),
    });
    return fromApi(row);
  },
  /**
   * PATCH /customers/{id} — o backend hoje responde 501 (não implementado).
   * Mantemos o método pronto para quando o CustomerController::update existir.
   */
  async update(id: string, input: Partial<NewCustomerInput>): Promise<Customer> {
    const body = toApiCreate({
      personType: input.personType ?? "PJ",
      legalName: input.legalName ?? "",
      phone: input.phone ?? "",
      address: input.address ?? {},
      commercial: input.commercial ?? {},
      status: input.status ?? { active: true, diamond: false },
      tradeName: input.tradeName,
      document: input.document,
      email: input.email,
    } as NewCustomerInput);
    const row = await apiFetch<ApiCustomerRow>(`/customers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    });
    return fromApi(row);
  },
};

// ---------- Hook reativo consumido pela UI ----------

export type UseCustomersState = {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCustomer: (input: NewCustomerInput) => Promise<Customer>;
};

export function useCustomers(): UseCustomersState {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await customersService.list();
      if (mounted.current) setCustomers(rows);
    } catch (err) {
      if (!mounted.current) return;
      const msg =
        err instanceof ApiError ? err.message : (err as Error).message ?? "Erro ao carregar clientes.";
      setError(msg);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const createCustomer = useCallback(
    async (input: NewCustomerInput) => {
      const created = await customersService.create(input);
      // Atualiza a lista otimisticamente e depois refaz para pegar ordenação real.
      setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      void load();
      return created;
    },
    [load],
  );

  return { customers, loading, error, refresh: load, createCustomer };
}
