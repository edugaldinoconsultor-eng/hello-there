/**
 * Cálculos puros de Pedido — 100% deterministas, sem React, sem IO.
 *
 * Separar cálculos da UI garante que a mesma lógica possa ser:
 *  - reaproveitada em server functions (validação anti-tampering);
 *  - consumida pela Soul AI para simulações ("e se aplicássemos 5%?");
 *  - coberta por testes unitários no futuro sem ferramenta extra.
 */
import type { OrderInstallment, OrderItem } from "./order-types";

/** Arredonda para 2 casas evitando lixo de ponto-flutuante. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcItemSubtotal(
  quantity: number,
  unitPrice: number,
  discount: number,
): number {
  const q = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  const p = Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0;
  const d = Number.isFinite(discount) ? Math.max(0, discount) : 0;
  return round2(Math.max(0, q * p - d));
}

export type OrderTotals = {
  itemsCount: number;
  unitsCount: number;
  subtotal: number;      // soma dos subtotais dos itens
  itemDiscounts: number; // soma dos descontos aplicados nos itens
  discount: number;      // desconto adicional no pedido inteiro
  freight: number;
  total: number;         // subtotal - discount + freight (nunca negativo)
};

export function calcOrderTotals(
  items: OrderItem[],
  orderDiscount: number,
  freight: number,
): OrderTotals {
  const subtotal = round2(items.reduce((acc, i) => acc + i.subtotal, 0));
  const itemDiscounts = round2(items.reduce((acc, i) => acc + i.discount, 0));
  const unitsCount = items.reduce((acc, i) => acc + (i.quantity || 0), 0);
  const discount = Math.max(0, round2(orderDiscount || 0));
  const frt = Math.max(0, round2(freight || 0));
  const total = round2(Math.max(0, subtotal - discount + frt));
  return {
    itemsCount: items.length,
    unitsCount,
    subtotal,
    itemDiscounts,
    discount,
    freight: frt,
    total,
  };
}

/**
 * Divide `total` em `count` parcelas iguais. A última parcela absorve a
 * diferença de centavos para garantir que a soma feche EXATAMENTE em `total`.
 *
 * Datas de vencimento seguem intervalos mensais a partir de `firstDueDate`
 * (para "à vista" / 1 parcela, cai no próprio dia).
 */
export function generateInstallments(
  total: number,
  count: number,
  firstDueDateISO: string,
): OrderInstallment[] {
  const n = Math.max(1, Math.floor(count));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const remainder = cents - base * n;

  const start = parseISODate(firstDueDateISO);

  const list: OrderInstallment[] = [];
  for (let i = 0; i < n; i++) {
    const amountCents = i === n - 1 ? base + remainder : base;
    list.push({
      number: i + 1,
      dueDate: addMonthsISO(start, i),
      amount: round2(amountCents / 100),
      paid: false,
    });
  }
  return list;
}

/** Soma exata das parcelas (em centavos) para evitar drift. */
export function installmentsSum(installments: OrderInstallment[]): number {
  const cents = installments.reduce(
    (acc, i) => acc + Math.round((i.amount || 0) * 100),
    0,
  );
  return round2(cents / 100);
}

/** Diferença entre soma das parcelas e total (em BRL, com sinal). */
export function installmentsDiff(
  installments: OrderInstallment[],
  total: number,
): number {
  return round2(installmentsSum(installments) - total);
}

// ---------------- datas ----------------

export function parseISODate(iso: string): Date {
  // yyyy-mm-dd → Date local (evita fuso UTC)
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addMonthsISO(base: Date, months: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + months, base.getDate());
  return toISODate(d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

// ---------------- formatação BRL ----------------

export function formatBRL(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatDateBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
