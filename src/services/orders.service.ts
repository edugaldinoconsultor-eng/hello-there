/**
 * Service de Pedidos — integrado ao backend real (Hostinger).
 *
 * Endpoints:
 *   GET   /orders                 → header dos pedidos da empresa
 *   GET   /orders/{id}            → detalhe (apenas header hoje)
 *   POST  /orders                 → cria pedido (backend recalcula totais)
 *   POST  /orders/{id}/cancel     → cancela pedido
 *
 * Regras inegociáveis:
 *  - `credentials: "include"` e CSRF são responsabilidade do api-client.
 *  - Frontend NUNCA envia company_id nem seller_id (sessão define no backend).
 *  - Valores monetários são serializados como STRING decimal ("99.99").
 *  - Total final é do backend — nunca confiar no cálculo do navegador.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "./api-client";
import type {
  Order,
  OrderItem,
  OrderInstallment,
  OrderStatus,
  PaymentCondition,
  SaleType,
} from "@/lib/order-types";

export type { Order, OrderStatus };

export type NewOrderInput = Omit<
  Order,
  "id" | "orderNumber" | "companyId" | "createdAt" | "updatedAt"
>;

// -------------------- helpers monetários --------------------

function money(n: number | undefined): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return v.toFixed(2);
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// -------------------- payload de criação --------------------

type ApiCreateItem = {
  product_id: string;
  quantity: number;
  unit_price: string;
  discount: string;
};

type ApiCreateInstallment = { due_date: string; amount: string };

type ApiDelivery = {
  type: string;
  address_snapshot?: Record<string, string | undefined> | null;
  freight: string;
  scheduled_for?: string | null;
  notes?: string | null;
};

type ApiCreateBody = {
  customer_id: string;
  items: ApiCreateItem[];
  sale_type: string;
  order_date: string;
  expected_delivery_date?: string;
  discount: string;
  freight: string;
  payment_condition?: PaymentCondition;
  notes?: string;
  installments?: ApiCreateInstallment[];
  delivery?: ApiDelivery;
};

function buildCreateBody(input: NewOrderInput): ApiCreateBody {
  const body: ApiCreateBody = {
    customer_id: String(input.customerId),
    items: input.items.map((it: OrderItem) => ({
      product_id: String(it.productId),
      quantity: it.quantity,
      unit_price: money(it.unitPrice),
      discount: money(it.discount),
    })),
    // Nomes visuais do modal são mapeados literalmente; retirada vira "balcao".
    sale_type: input.saleType as string,
    order_date: input.orderDate,
    discount: money(input.discount),
    freight: money(input.delivery?.freeShipping ? 0 : input.freight),
    payment_condition: input.payment.condition,
  };
  if (input.expectedDeliveryDate) body.expected_delivery_date = input.expectedDeliveryDate;
  if (input.notes) body.notes = input.notes;

  // Parcelas: só envia quando o usuário definiu mais de uma no modal.
  // Backend cria automaticamente 1 parcela à vista quando `installments` é vazio.
  if (input.installments && input.installments.length > 1) {
    body.installments = input.installments.map((p) => ({
      due_date: p.dueDate,
      amount: money(p.amount),
    }));
  }

  // Entrega: só envia payload quando não é retirada (evita snapshot vazio).
  const d = input.delivery;
  if (d && d.method !== "retirada") {
    const addr = d.address;
    const snap = addr
      ? {
          cep: addr.cep,
          street: addr.street,
          number: addr.number,
          complement: addr.complement,
          district: addr.district,
          city: addr.city,
          state: addr.state,
        }
      : null;
    body.delivery = {
      type: d.method,
      address_snapshot: snap,
      freight: money(d.freeShipping ? 0 : d.freight),
      scheduled_for: input.expectedDeliveryDate ?? null,
      notes: d.notes ?? null,
    };
  }
  return body;
}

// -------------------- resposta do backend --------------------

type ApiOrderRow = {
  id: string | number;
  order_number: string;
  company_id?: string | number;
  customer_id: string | number;
  seller_id?: string | number | null;
  status: string;
  sale_type?: string | null;
  order_date: string;
  expected_delivery_date?: string | null;
  subtotal?: string | number | null;
  discount?: string | number | null;
  freight?: string | number | null;
  total?: string | number | null;
  payment_condition?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

function fromApi(row: ApiOrderRow): Order {
  return {
    id: String(row.id),
    orderNumber: row.order_number,
    companyId: row.company_id !== undefined && row.company_id !== null ? String(row.company_id) : "",
    customerId: String(row.customer_id),
    sellerId: row.seller_id !== null && row.seller_id !== undefined ? String(row.seller_id) : undefined,
    sellerName: undefined,
    saleType: (row.sale_type ?? "venda") as SaleType,
    status: (row.status ?? "pending") as OrderStatus,
    // GET /orders retorna apenas o header. Itens/parcelas/entrega ficam vazios
    // até que exista endpoint dedicado; NÃO inventamos dados no frontend.
    items: [] as OrderItem[],
    installments: [] as OrderInstallment[],
    subtotal: toNum(row.subtotal),
    discount: toNum(row.discount),
    freight: toNum(row.freight),
    total: toNum(row.total),
    payment: {
      condition: (row.payment_condition ?? "a_vista") as PaymentCondition,
      installmentsCount: 1,
    },
    delivery: {
      method: "retirada",
      freight: toNum(row.freight),
      freeShipping: false,
    },
    notes: row.notes ?? undefined,
    orderDate: row.order_date,
    expectedDeliveryDate: row.expected_delivery_date ?? undefined,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function extractRows(raw: unknown): ApiOrderRow[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw as ApiOrderRow[];
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as ApiOrderRow[];
    if (obj.data && typeof obj.data === "object") {
      const inner = (obj.data as Record<string, unknown>).data;
      if (Array.isArray(inner)) return inner as ApiOrderRow[];
    }
    if (Array.isArray(obj.rows)) return obj.rows as ApiOrderRow[];
    if (Array.isArray(obj.items)) return obj.items as ApiOrderRow[];
  }
  // eslint-disable-next-line no-console
  console.warn("[orders.service] payload inesperado de GET /orders:", raw);
  return [];
}

// -------------------- fachada de rede --------------------

type ApiCreateResponse = {
  id: string | number;
  order_number: string;
  total: string | number;
};

export const ordersService = {
  async list(): Promise<Order[]> {
    const raw = await apiFetch<unknown>("/orders");
    return extractRows(raw).map(fromApi);
  },
  async getById(id: string): Promise<Order | undefined> {
    try {
      const row = await apiFetch<ApiOrderRow>(`/orders/${encodeURIComponent(id)}`);
      return row ? fromApi(row) : undefined;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },
  async create(input: NewOrderInput): Promise<ApiCreateResponse> {
    return apiFetch<ApiCreateResponse>("/orders", {
      method: "POST",
      body: buildCreateBody(input),
    });
  },
  async cancel(id: string): Promise<void> {
    await apiFetch<unknown>(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    });
  },
};

// -------------------- hook consumido pela UI --------------------

export type UseOrdersState = {
  orders: Order[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createOrder: (input: NewOrderInput) => Promise<ApiCreateResponse>;
  updateStatus: (id: string, status: OrderStatus) => Promise<void>;
  findOrder: (id: string) => Order | undefined;
};

export function useOrders(): UseOrdersState {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await ordersService.list();
      if (mounted.current) setOrders(rows);
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof ApiError) setError(err.message);
      else setError((err as Error).message ?? "Erro ao carregar pedidos.");
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

  const createOrder = useCallback(
    async (input: NewOrderInput) => {
      const res = await ordersService.create(input);
      await load();
      return res;
    },
    [load],
  );

  const updateStatus = useCallback(
    async (id: string, status: OrderStatus) => {
      // Só o cancelamento tem endpoint hoje. Outros status ficam indisponíveis
      // no frontend até o backend expor transições.
      if (status !== "cancelled") return;
      await ordersService.cancel(id);
      await load();
    },
    [load],
  );

  const findOrder = useCallback(
    (id: string) => orders.find((o) => o.id === id),
    [orders],
  );

  return { orders, loading, error, refresh: load, createOrder, updateStatus, findOrder };
}
