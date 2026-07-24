/**
 * Service de Produtos — integrado ao backend real (Hostinger).
 *
 * Endpoints:
 *   GET  /products
 *   POST /products
 *
 * A empresa é derivada da sessão (cookie HttpOnly). O frontend NUNCA envia
 * company_id. CSRF e credenciais são cuidados pelo `api-client` central.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "./api-client";

// ---------- Tipos do domínio (shape consumido pela UI e por NovoPedidoModal) ----------

export type Product = {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minimumStock: number;
  active: boolean;
};

export type NewProductInput = {
  sku: string;
  name: string;
  category?: string;
  price: number;
  stock?: number;
  minimumStock?: number;
};

// ---------- Mapeamento API ↔ domínio ----------

type ApiProductRow = {
  id: string | number;
  company_id?: string | number;
  sku: string;
  name: string;
  category?: string | null;
  price: string | number;
  stock: string | number;
  minimum_stock: string | number;
  active?: number | boolean | null;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fromApi(row: ApiProductRow): Product {
  return {
    id: String(row.id),
    companyId: row.company_id !== undefined ? String(row.company_id) : "",
    sku: row.sku,
    name: row.name,
    category: row.category ?? "",
    price: toNum(row.price),
    stock: toNum(row.stock),
    minimumStock: toNum(row.minimum_stock),
    active: row.active === undefined || row.active === null ? true : Boolean(Number(row.active)),
  };
}

function extractRows(raw: unknown): ApiProductRow[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw as ApiProductRow[];
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as ApiProductRow[];
    if (obj.data && typeof obj.data === "object") {
      const inner = (obj.data as Record<string, unknown>).data;
      if (Array.isArray(inner)) return inner as ApiProductRow[];
    }
    if (Array.isArray(obj.rows)) return obj.rows as ApiProductRow[];
    if (Array.isArray(obj.items)) return obj.items as ApiProductRow[];
  }
  // eslint-disable-next-line no-console
  console.warn("[products.service] payload inesperado de GET /products:", raw);
  return [];
}

/**
 * Contrato atual do backend: price, stock e minimum_stock são STRING.
 * Convertemos number → string com ponto decimal, sem separador de milhar.
 */
function numToApiStr(n: number, decimals = 2): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(decimals);
}

type ApiCreateBody = {
  sku: string;
  name: string;
  category?: string;
  price: string;
  stock: string;
  minimum_stock: string;
};

function toApiCreate(input: NewProductInput): ApiCreateBody {
  const body: ApiCreateBody = {
    sku: input.sku.trim(),
    name: input.name.trim(),
    price: numToApiStr(input.price, 2),
    stock: numToApiStr(input.stock ?? 0, 3),
    minimum_stock: numToApiStr(input.minimumStock ?? 0, 3),
  };
  if (input.category && input.category.trim()) body.category = input.category.trim();
  return body;
}

// ---------- Fachada de rede ----------

export const productsService = {
  async list(): Promise<Product[]> {
    const raw = await apiFetch<unknown>("/products");
    return extractRows(raw).map(fromApi);
  },
  async create(input: NewProductInput): Promise<Product> {
    const row = await apiFetch<ApiProductRow>("/products", {
      method: "POST",
      body: toApiCreate(input),
    });
    return fromApi(row);
  },
};

// ---------- Hook reativo consumido pela UI ----------

export type UseProductsState = {
  products: Product[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createProduct: (input: NewProductInput) => Promise<Product>;
};

export function useProducts(): UseProductsState {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await productsService.list();
      if (mounted.current) setProducts(rows);
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError((err as Error).message ?? "Erro ao carregar produtos.");
      }
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

  const createProduct = useCallback(
    async (input: NewProductInput) => {
      const created = await productsService.create(input);
      setProducts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      void load();
      return created;
    },
    [load],
  );

  return { products, loading, error, refresh: load, createProduct };
}
