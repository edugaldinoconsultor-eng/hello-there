/**
 * Modal read-only com detalhes de um pedido existente.
 */
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatBRL, formatDateBR } from "@/lib/order-calc";
import { maskCpfCnpj, maskPhoneBR } from "@/lib/masks";
import {
  DELIVERY_METHOD_LABEL, ORDER_STATUS_BADGE, ORDER_STATUS_LABEL,
  PAYMENT_CONDITION_LABEL, SALE_TYPE_LABEL, type Order,
} from "@/lib/order-types";
import { useCustomers } from "@/services/customers.service";

export function PedidoDetalhesModal({
  order, open, onOpenChange,
}: {
  order?: Order;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { customers } = useCustomers();
  const customer = order ? customers.find((c) => c.id === order.customerId) : undefined;

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden border-border bg-popover p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base">Pedido {order.orderNumber}</DialogTitle>
            <StatusBadge variant={ORDER_STATUS_BADGE[order.status]}>
              {ORDER_STATUS_LABEL[order.status]}
            </StatusBadge>
          </div>
          <DialogDescription className="text-xs">
            {SALE_TYPE_LABEL[order.saleType]} · {formatDateBR(order.orderDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(92vh-64px-64px)] space-y-5 overflow-y-auto px-6 py-4 text-sm">
          {/* Cliente */}
          <Section title="Cliente">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Info label="Nome" value={customer?.legalName ?? "—"} />
              <Info label="Telefone" value={customer ? maskPhoneBR(customer.phone) : "—"} />
              {customer?.document && <Info label="CPF/CNPJ" value={maskCpfCnpj(customer.document)} />}
              {customer && (customer.address.street || customer.address.city) && (
                <Info
                  label="Endereço"
                  value={[
                    customer.address.street, customer.address.number,
                    customer.address.district, customer.address.city, customer.address.state,
                  ].filter(Boolean).join(", ")}
                />
              )}
              {order.sellerName && <Info label="Vendedor" value={order.sellerName} />}
            </div>
          </Section>

          {/* Itens */}
          <Section title="Itens">
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Produto</th>
                    <th className="px-2 py-1.5 text-right font-medium">Qtd.</th>
                    <th className="px-2 py-1.5 text-right font-medium">Unitário</th>
                    <th className="px-2 py-1.5 text-right font-medium">Desconto</th>
                    <th className="px-2 py-1.5 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.id} className="border-t border-border">
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{it.name}</div>
                        <div className="text-[11px] text-muted-foreground">SKU {it.sku}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right">{it.quantity}</td>
                      <td className="px-2 py-1.5 text-right">{formatBRL(it.unitPrice)}</td>
                      <td className="px-2 py-1.5 text-right">{formatBRL(it.discount)}</td>
                      <td className="px-2 py-1.5 text-right font-medium">{formatBRL(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Totais */}
          <Section title="Totais">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Info label="Subtotal" value={formatBRL(order.subtotal)} />
              <Info label="Descontos" value={formatBRL(order.discount)} />
              <Info label="Frete" value={order.delivery.freeShipping ? "Grátis" : formatBRL(order.freight)} />
              <Info label="Total" value={formatBRL(order.total)} highlight />
            </div>
          </Section>

          {/* Pagamento */}
          <Section title="Pagamento">
            <div className="mb-2 text-xs text-muted-foreground">
              {PAYMENT_CONDITION_LABEL[order.payment.condition]} ·{" "}
              {order.installments.length}{" "}
              {order.installments.length === 1 ? "parcela" : "parcelas"}
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Parcela</th>
                    <th className="px-2 py-1.5 text-left font-medium">Vencimento</th>
                    <th className="px-2 py-1.5 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {order.installments.map((i) => (
                    <tr key={i.number} className="border-t border-border">
                      <td className="px-2 py-1.5">{i.number}</td>
                      <td className="px-2 py-1.5">{formatDateBR(i.dueDate)}</td>
                      <td className="px-2 py-1.5 text-right font-medium">{formatBRL(i.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Entrega */}
          <Section title="Entrega">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Info label="Modalidade" value={DELIVERY_METHOD_LABEL[order.delivery.method]} />
              {order.delivery.carrier && <Info label="Transportadora" value={order.delivery.carrier} />}
              {order.delivery.address && (order.delivery.address.street || order.delivery.address.city) && (
                <Info
                  label="Endereço de entrega"
                  value={[
                    order.delivery.address.street, order.delivery.address.number,
                    order.delivery.address.district, order.delivery.address.city, order.delivery.address.state,
                  ].filter(Boolean).join(", ")}
                />
              )}
              {order.expectedDeliveryDate && (
                <Info label="Entrega prevista" value={formatDateBR(order.expectedDeliveryDate)} />
              )}
              {order.delivery.notes && <Info label="Observação" value={order.delivery.notes} />}
            </div>
          </Section>

          {order.notes && (
            <Section title="Observações">
              <p className="text-xs text-muted-foreground">{order.notes}</p>
            </Section>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={highlight ? "text-base font-semibold text-primary" : "text-xs text-foreground"}>
        {value}
      </div>
    </div>
  );
}
