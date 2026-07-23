/**
 * MOCK — estado local de Pedidos.
 *
 * REGRAS INEGOCIÁVEIS
 *  - Todo pedido pertence a `currentCompany.id`. Nenhuma leitura pode
 *    retornar pedidos de outra empresa. Isso replica a semântica que
 *    será enforced por RLS no banco quando o backend existir.
 *  - Cálculos NÃO são refeitos aqui — vêm prontos do formulário através
 *    das funções puras em `@/lib/order-calc`. Este arquivo apenas
 *    persiste, numera e emite eventos de domínio.
 */
import { useEffect, useState } from "react";
import { currentCompany, currentUser } from "./session";
import type { Order, OrderStatus } from "@/lib/order-types";
import { DomainEvents, emitDomainEvent } from "@/lib/events";

const store: Order[] = [];
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

let seq = 1;
function nextOrderNumber(): string {
  const n = String(seq++).padStart(4, "0");
  const year = new Date().getFullYear();
  return `PED-${year}-${n}`;
}

function uid() {
  return `ord_${Math.random().toString(36).slice(2, 10)}`;
}

export type NewOrderInput = Omit<
  Order,
  "id" | "orderNumber" | "companyId" | "createdAt" | "updatedAt"
>;

export function listOrders(companyId: string): Order[] {
  return store
    .filter((o) => o.companyId === companyId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function findOrder(companyId: string, id: string): Order | undefined {
  return store.find((o) => o.companyId === companyId && o.id === id);
}

export function createOrder(companyId: string, input: NewOrderInput): Order {
  const now = new Date().toISOString();
  const order: Order = {
    id: uid(),
    orderNumber: nextOrderNumber(),
    companyId,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  store.push(order);
  notify();

  emitDomainEvent({
    name: DomainEvents.OrderCreated,
    companyId,
    actorId: currentUser.id,
    occurredAt: now,
    payload: { orderId: order.id, orderNumber: order.orderNumber, total: order.total },
  });
  if (order.status === "confirmed") {
    emitDomainEvent({
      name: DomainEvents.OrderConfirmed,
      companyId,
      actorId: currentUser.id,
      occurredAt: now,
      payload: { orderId: order.id, orderNumber: order.orderNumber },
    });
  }
  return order;
}

export function updateOrderStatus(
  companyId: string,
  id: string,
  status: OrderStatus,
): Order | undefined {
  const order = findOrder(companyId, id);
  if (!order) return undefined;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  notify();
  if (status === "cancelled") {
    emitDomainEvent({
      name: DomainEvents.OrderCancelled,
      companyId,
      actorId: currentUser.id,
      occurredAt: order.updatedAt,
      payload: { orderId: order.id, orderNumber: order.orderNumber },
    });
  } else if (status === "confirmed") {
    emitDomainEvent({
      name: DomainEvents.OrderConfirmed,
      companyId,
      actorId: currentUser.id,
      occurredAt: order.updatedAt,
      payload: { orderId: order.id, orderNumber: order.orderNumber },
    });
  }
  return order;
}

/** Hook reativo escopo-multi-empresa. */
export function useOrders() {
  const companyId = currentCompany.id;
  const [rows, setRows] = useState<Order[]>(() => listOrders(companyId));

  useEffect(() => {
    const update = () => setRows(listOrders(companyId));
    subs.add(update);
    return () => { subs.delete(update); };
  }, [companyId]);

  return {
    orders: rows,
    createOrder: (input: NewOrderInput) => createOrder(companyId, input),
    updateStatus: (id: string, status: OrderStatus) =>
      updateOrderStatus(companyId, id, status),
    findOrder: (id: string) => findOrder(companyId, id),
  };
}
