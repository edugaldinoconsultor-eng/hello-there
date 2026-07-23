/**
 * Domain event catalog for SoulERP.
 *
 * Nothing is wired yet — this file simply *names* the events the app will
 * emit as modules are implemented. Feature code should import these constants
 * so integrations (webhooks, Soul AI triggers, notifications, audit log)
 * can subscribe in one place.
 */

export const DomainEvents = {
  CustomerCreated: "customer.created",
  OrderCreated: "order.created",
  OrderConfirmed: "order.confirmed",
  OrderCancelled: "order.cancelled",
  PaymentReceived: "payment.received",
  StockLow: "stock.low",
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];

export type DomainEvent<TPayload = unknown> = {
  name: DomainEventName;
  companyId: string;
  actorId: string;
  occurredAt: string; // ISO
  payload: TPayload;
};

// Placeholder — replace with a real bus (server function + queue) later.
export function emitDomainEvent<T>(event: DomainEvent<T>): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[domain-event]", event.name, event);
  }
}
