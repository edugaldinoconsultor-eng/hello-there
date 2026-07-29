/**
 * Service de Estoque — integrado ao backend real (Hostinger).
 *
 * Endpoints:
 *   GET  /inventory/balances
 *   GET  /inventory/movements
 *   GET  /inventory/products/{id}/movements
 *   POST /inventory/movements
 *
 * A empresa vem da sessão (cookie HttpOnly). O frontend NUNCA envia company_id.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "./api-client";

// ---------- Domínio ----------

export type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "RETURN" | "LOSS";

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
  ADJUSTMENT: "Ajuste",
  RETURN: "Devolução",
  LOSS: "Perda",
};

export type StockBalance = {
  productId: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minimumStock: number;
  belowMinimum: boolean;
  lastMovementAt: string | null;
};

export type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  type: MovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  orderNumber: string | null;
  userName: string;
  createdAt: string;
};

export type NewMovementInput = {
  productId: string;
  type: MovementType;
  quantity: number;
  reason: string;
  orderId?: string | null;
};

// ---------- Mapeamento API ↔ domínio ----------

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function extractRows<T>(raw: unknown): T[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (obj.data && typeof obj.data === "object") {
      const inner = (obj.data as Record<string, unknown>).data;
      if (Array.isArray(inner)) return inner as T[];
    }
    if (Array.isArray(obj.rows)) return obj.rows as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  // eslint-disable-next-line no-console
  console.warn("[inventory.service] payload inesperado:", raw);
  return [];
}

type ApiBalanceRow = Record<string, unknown>;
type ApiMovementRow = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function balanceFromApi(row: ApiBalanceRow): StockBalance {
  const stock = toNum(row.stock);
  const minimumStock = toNum(row.minimum_stock);
  return {
    productId: str(row.id),
    sku: str(row.sku),
    name: str(row.name),
    category: str(row.category),
    price: toNum(row.price),
    stock,
    minimumStock,
    belowMinimum: stock <= minimumStock,
    lastMovementAt: row.last_movement_at ? str(row.last_movement_at) : null,
  };
}

function movementFromApi(row: ApiMovementRow): InventoryMovement {
  const rawType = str(row.type, "IN").toUpperCase();
  const type = (["IN", "OUT", "ADJUSTMENT", "RETURN", "LOSS"].includes(rawType)
    ? rawType
    : "IN") as MovementType;
  return {
    id: str(row.id),
    productId: str(row.product_id),
    productName: str(row.product_name, "—"),
    productSku: str(row.product_sku),
    type,
    quantity: toNum(row.quantity),
    stockBefore: toNum(row.stock_before),
    stockAfter: toNum(row.stock_after),
    reason: str(row.reason),
    referenceType: row.reference_type ? str(row.reference_type) : null,
    referenceId: row.reference_id ? str(row.reference_id) : null,
    orderNumber: row.order_number ? str(row.order_number) : null,
    userName: str(row.user_name, "—"),
    createdAt: str(row.created_at),
  };
}

function toApiCreate(input: NewMovementInput) {
  const body: Record<string, unknown> = {
    product_id: Number(input.productId),
    type: input.type,
    quantity: Math.trunc(input.quantity),
    reason: input.reason.trim(),
  };
  if (input.orderId) {
    body.reference_type = "order";
    body.reference_id = Number(input.orderId);
  }
  return body;
}

// ---------- Fachada de rede ----------

export const inventoryService = {
  async listBalances(params?: { query?: string; belowMinimum?: boolean }): Promise<StockBalance[]> {
    const search = new URLSearchParams();
    if (params?.query) search.set("query", params.query);
    if (params?.belowMinimum) search.set("belowMinimum", "1");
    const qs = search.toString();
    const raw = await apiFetch<unknown>(`/inventory/balances${qs ? `?${qs}` : ""}`);
    return extractRows<ApiBalanceRow>(raw).map(balanceFromApi);
  },

  async listMovements(params?: { productId?: string; type?: MovementType }): Promise<InventoryMovement[]> {
    const search = new URLSearchParams();
    if (params?.productId) search.set("productId", params.productId);
    if (params?.type) search.set("type", params.type);
    const qs = search.toString();
    const raw = await apiFetch<unknown>(`/inventory/movements${qs ? `?${qs}` : ""}`);
    return extractRows<ApiMovementRow>(raw).map(movementFromApi);
  },

  async createMovement(input: NewMovementInput): Promise<InventoryMovement> {
    const row = await apiFetch<ApiMovementRow>("/inventory/movements", {
      method: "POST",
      body: toApiCreate(input),
    });
    return movementFromApi(row);
  },
};

// ---------- Hooks ----------

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return (err as Error)?.message ?? fallback;
}

export function useStockBalances() {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await inventoryService.listBalances();
      if (mounted.current) setBalances(rows);
    } catch (err) {
      if (mounted.current) setError(errMessage(err, "Erro ao carregar saldos."));
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

  return { balances, loading, error, refresh: load };
}

export function useInventoryMovements() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await inventoryService.listMovements();
      if (mounted.current) setMovements(rows);
    } catch (err) {
      if (mounted.current) setError(errMessage(err, "Erro ao carregar movimentações."));
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

  return { movements, loading, error, refresh: load };
}
