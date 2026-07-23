/**
 * MOCK — estado local do módulo de Clientes.
 *
 * Toda a modelagem já contempla os campos que a Soul AI precisará consultar
 * no futuro (histórico, ticket médio, produtos mais comprados, pagamentos
 * pendentes, frequência de compra etc.). Esses agregados NÃO são calculados
 * aqui — são derivados a partir de pedidos/pagamentos quando o backend
 * existir. Ficam declarados no tipo para consumidores da UI e da IA.
 *
 * Escopo: todo cliente é sempre criado com o `companyId` da sessão atual.
 * A API pública (`useCustomers`) filtra por `companyId` para garantir que
 * dados de uma empresa nunca se misturem com outra.
 */
import { useEffect, useState } from "react";
import { currentCompany } from "./session";

export type PersonType = "PF" | "PJ";

export type PaymentTerm =
  | "a_vista"
  | "7_dias"
  | "14_dias"
  | "21_28"
  | "30_dias"
  | "30_60"
  | "30_60_90"
  | "faturado";

export type PriceTable = "atacado" | "varejo" | "vip" | "diamante";

export type CustomerAddress = {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
};

export type CustomerCommercial = {
  salespersonId?: string;
  salespersonName?: string;
  priceTable: PriceTable;
  creditLimit: number; // BRL
  paymentTerm: PaymentTerm;
  notes?: string;
};

export type CustomerStatus = {
  active: boolean;
  diamond: boolean;
};

/**
 * Agregados que a Soul AI consultará no futuro. Preenchidos a partir de
 * pedidos/pagamentos — hoje ficam `undefined` para clientes novos.
 */
export type CustomerAggregates = {
  totalOrders?: number;
  lastPurchaseAt?: string; // ISO
  averageTicket?: number; // BRL
  purchaseFrequencyDays?: number;
  topProductIds?: string[];
  pendingReceivables?: number; // BRL
  creditUsed?: number; // BRL
};

export type Customer = {
  id: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;

  personType: PersonType;
  legalName: string; // Nome / Razão Social
  tradeName?: string; // Nome Fantasia
  document: string; // CPF ou CNPJ (somente dígitos)
  phone: string; // somente dígitos
  email?: string;

  address: Partial<CustomerAddress>;
  commercial: CustomerCommercial;
  status: CustomerStatus;

  aggregates: CustomerAggregates;
};

export type NewCustomerInput = Omit<
  Customer,
  "id" | "companyId" | "createdAt" | "updatedAt" | "aggregates"
>;

// ---------- store simples in-memory ----------

const store: Customer[] = [];
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

function uid() {
  return `cus_${Math.random().toString(36).slice(2, 10)}`;
}

export function listCustomers(companyId: string): Customer[] {
  return store.filter((c) => c.companyId === companyId);
}

export function createCustomer(
  companyId: string,
  input: NewCustomerInput,
): Customer {
  const now = new Date().toISOString();
  const customer: Customer = {
    id: uid(),
    companyId,
    createdAt: now,
    updatedAt: now,
    ...input,
    aggregates: {},
  };
  store.push(customer);
  notify();
  return customer;
}

/** Hook reativo escopo-multi-empresa. */
export function useCustomers() {
  const companyId = currentCompany.id;
  const [rows, setRows] = useState<Customer[]>(() => listCustomers(companyId));

  useEffect(() => {
    const update = () => setRows(listCustomers(companyId));
    subs.add(update);
    return () => {
      subs.delete(update);
    };
  }, [companyId]);

  return {
    customers: rows,
    createCustomer: (input: NewCustomerInput) =>
      createCustomer(companyId, input),
  };
}
