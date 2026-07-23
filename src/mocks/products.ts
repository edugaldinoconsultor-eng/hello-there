/**
 * MOCK — catálogo de produtos.
 *
 * Escopo multiempresa: todo produto tem `companyId`. A API pública
 * (`useProducts`) filtra por `currentCompany.id` para garantir que
 * um pedido nunca liste produtos de outra empresa.
 *
 * Estrutura já contempla os campos que a Soul AI usará no futuro
 * (categoria, giro, estoque mínimo) — hoje apenas seed inicial.
 */
import { useEffect, useState } from "react";
import { currentCompany } from "./session";

export type Product = {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  category: string;
  price: number;         // BRL
  stock: number;
  minimumStock: number;
  active: boolean;
};

const seed: Product[] = [
  {
    id: "prd_001", companyId: currentCompany.id, sku: "SHP-UNQ-1L",
    name: "Shampoo Unique 1L", category: "Lavagem",
    price: 89.9, stock: 42, minimumStock: 10, active: true,
  },
  {
    id: "prd_002", companyId: currentCompany.id, sku: "TIT-BLD-1KG",
    name: "Titanium Blend 1kg", category: "Descoloração",
    price: 145.0, stock: 8, minimumStock: 6, active: true,
  },
  {
    id: "prd_003", companyId: currentCompany.id, sku: "REP-FIN-500",
    name: "Repair Finisher 500ml", category: "Finalização",
    price: 69.5, stock: 25, minimumStock: 8, active: true,
  },
  {
    id: "prd_004", companyId: currentCompany.id, sku: "MSK-ABS-1KG",
    name: "Máscara Absolute 1kg", category: "Tratamento",
    price: 129.0, stock: 15, minimumStock: 5, active: true,
  },
  {
    id: "prd_005", companyId: currentCompany.id, sku: "PO-DSC-1KG",
    name: "Pó Descolorante 1kg", category: "Descoloração",
    price: 98.0, stock: 3, minimumStock: 10, active: true,
  },
  {
    id: "prd_006", companyId: currentCompany.id, sku: "LVN-200",
    name: "Leave-in", category: "Finalização",
    price: 44.9, stock: 30, minimumStock: 12, active: true,
  },
];

const store: Product[] = [...seed];
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

export function listProducts(companyId: string): Product[] {
  return store.filter((p) => p.companyId === companyId && p.active);
}

export function findProduct(companyId: string, id: string): Product | undefined {
  return store.find((p) => p.companyId === companyId && p.id === id);
}

export function useProducts() {
  const companyId = currentCompany.id;
  const [rows, setRows] = useState<Product[]>(() => listProducts(companyId));
  useEffect(() => {
    const update = () => setRows(listProducts(companyId));
    subs.add(update);
    return () => { subs.delete(update); };
  }, [companyId]);
  return { products: rows };
}
