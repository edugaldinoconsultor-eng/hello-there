/**
 * Orçamento (proposta comercial) gerado a partir de um pedido existente.
 *
 * Camada 100% de visualização — não altera o backend de pedidos.
 * Ações: enviar por WhatsApp (texto formatado) e baixar/imprimir PDF
 * (abre a caixa de impressão do navegador com "Salvar como PDF").
 */
import { useMemo, useRef } from "react";
import { Download, MessageCircle, Printer } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDateBR } from "@/lib/order-calc";
import { maskCpfCnpj, maskPhoneBR } from "@/lib/masks";
import {
  DELIVERY_METHOD_LABEL, PAYMENT_CONDITION_LABEL, type Order,
} from "@/lib/order-types";
import { useCustomers } from "@/services/customers.service";
import { useSession } from "@/mocks/session";

const EXTRA_PAYMENT_LABEL: Record<string, string> = {
  "30_dias": "30 dias",
  "30_60": "30/60 dias",
  "30_60_90": "30/60/90 dias",
  balcao: "Balcão",
  faturado: "Faturado",
};

function paymentLabel(order: Order): string {
  const raw = String(order.payment?.condition ?? "");
  if (!raw) return "A combinar";
  return (
    PAYMENT_CONDITION_LABEL[order.payment.condition] ??
    EXTRA_PAYMENT_LABEL[raw] ??
    raw.replace(/_/g, " ")
  );
}

/** Validade padrão do orçamento: 7 dias após a data do pedido. */
function validityDate(order: Order): string {
  const base = new Date(`${order.orderDate}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "—";
  base.setDate(base.getDate() + 7);
  return formatDateBR(base.toISOString().slice(0, 10));
}

export function OrcamentoModal({
  order, open, onOpenChange,
}: {
  order?: Order;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { customers } = useCustomers();
  const { company } = useSession();
  const docRef = useRef<HTMLDivElement>(null);

  const customer = order
    ? customers.find((c) => String(c.id) === String(order.customerId))
    : undefined;

  const customerAddress = customer
    ? [
        customer.address.street, customer.address.number, customer.address.district,
        customer.address.city, customer.address.state,
      ].filter(Boolean).join(", ")
    : "";

  const whatsappText = useMemo(() => {
    if (!order) return "";
    const lines: string[] = [];
    lines.push(`*ORÇAMENTO ${order.orderNumber}*`);
    lines.push(company.name);
    lines.push(`Data: ${formatDateBR(order.orderDate)} · Validade: ${validityDate(order)}`);
    lines.push("");
    if (customer) lines.push(`*Cliente:* ${customer.legalName}`);
    lines.push("");
    lines.push("*Itens*");
    order.items.forEach((it) => {
      lines.push(
        `• ${it.quantity}x ${it.name} — ${formatBRL(it.unitPrice)} = ${formatBRL(it.subtotal)}`,
      );
    });
    lines.push("");
    lines.push(`Subtotal: ${formatBRL(order.subtotal)}`);
    if (order.discount > 0) lines.push(`Desconto: -${formatBRL(order.discount)}`);
    lines.push(
      `Frete: ${order.delivery?.freeShipping ? "Grátis" : formatBRL(order.freight ?? 0)}`,
    );
    lines.push(`*TOTAL: ${formatBRL(order.total)}*`);
    lines.push("");
    lines.push(`Pagamento: ${paymentLabel(order)}`);
    if (order.installments?.length > 1) {
      lines.push(`Parcelas: ${order.installments.length}x`);
    }
    if (order.delivery?.method) {
      lines.push(`Entrega: ${DELIVERY_METHOD_LABEL[order.delivery.method] ?? order.delivery.method}`);
    }
    return lines.join("\n");
  }, [order, customer, company.name]);

  if (!order) return null;

  const handleWhatsApp = () => {
    const digits = String(customer?.phone ?? "").replace(/\D/g, "");
    const phone = digits ? (digits.startsWith("55") ? digits : `55${digits}`) : "";
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappText)}`
      : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handlePrint = () => {
    const node = docRef.current;
    if (!node) return;
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8">
<title>Orçamento ${order.orderNumber}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:ui-sans-serif,system-ui,Segoe UI,Arial,sans-serif;color:#111;margin:0;padding:28px;font-size:12px}
  h1{font-size:18px;margin:0}
  .muted{color:#666}
  .row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  .head{border-bottom:2px solid #6d28d9;padding-bottom:12px;margin-bottom:16px}
  .badge{display:inline-block;border:1px solid #6d28d9;color:#6d28d9;border-radius:4px;padding:2px 8px;font-weight:600}
  .box{border:1px solid #ddd;border-radius:6px;padding:10px;margin-bottom:14px}
  .label{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#777}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}
  th{background:#f4f4f5;text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#555;border-bottom:1px solid #ddd}
  td{padding:6px 8px;border-bottom:1px solid #eee}
  .right{text-align:right}
  .totals{width:280px;margin-left:auto}
  .totals td{border:0;padding:3px 0}
  .total-line{border-top:1px solid #ddd;font-size:15px;font-weight:700;color:#6d28d9}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  footer{margin-top:22px;border-top:1px solid #eee;padding-top:10px;font-size:10px;color:#777}
</style></head><body>${node.innerHTML}</body></html>`);
    doc.close();
    const run = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 1000);
    };
    if (frame.contentWindow?.document.readyState === "complete") run();
    else frame.onload = run;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden border-border bg-popover p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="text-base">Orçamento {order.orderNumber}</DialogTitle>
          <DialogDescription className="text-xs">
            Documento comercial gerado a partir do pedido · validade {validityDate(order)}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(92vh-160px)] overflow-y-auto bg-muted/30 p-4">
          {/* Folha do orçamento — fundo claro, imprimível */}
          <div
            ref={docRef}
            className="mx-auto w-full rounded-md bg-white p-6 text-[13px] text-neutral-900 shadow-sm"
          >
            <div className="head row">
              <div>
                <h1>{company.name}</h1>
                <div className="muted">Proposta comercial · Orçamento</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="badge">{order.orderNumber}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  Emissão: {formatDateBR(order.orderDate)}
                </div>
                <div className="muted">Validade: {validityDate(order)}</div>
              </div>
            </div>

            <div className="box">
              <div className="label">Cliente</div>
              <div style={{ fontWeight: 600 }}>{customer?.legalName ?? "—"}</div>
              <div className="grid" style={{ marginTop: 6 }}>
                <div>
                  <div className="label">Telefone</div>
                  <div>{customer?.phone ? maskPhoneBR(customer.phone) : "—"}</div>
                </div>
                <div>
                  <div className="label">CPF / CNPJ</div>
                  <div>{customer?.document ? maskCpfCnpj(customer.document) : "—"}</div>
                </div>
                <div>
                  <div className="label">Vendedor</div>
                  <div>{order.sellerName ?? "—"}</div>
                </div>
              </div>
              {customerAddress && (
                <div style={{ marginTop: 6 }}>
                  <div className="label">Endereço</div>
                  <div>{customerAddress}</div>
                </div>
              )}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="right">Qtd.</th>
                  <th className="right">Unitário</th>
                  <th className="right">Desconto</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{it.name}</div>
                      <div className="muted" style={{ fontSize: 10 }}>SKU {it.sku}</div>
                    </td>
                    <td className="right">{it.quantity}</td>
                    <td className="right">{formatBRL(it.unitPrice)}</td>
                    <td className="right">{formatBRL(it.discount)}</td>
                    <td className="right" style={{ fontWeight: 600 }}>{formatBRL(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="totals">
              <tbody>
                <tr>
                  <td>Subtotal</td>
                  <td className="right">{formatBRL(order.subtotal)}</td>
                </tr>
                <tr>
                  <td>Desconto</td>
                  <td className="right">- {formatBRL(order.discount)}</td>
                </tr>
                <tr>
                  <td>Frete</td>
                  <td className="right">
                    {order.delivery?.freeShipping ? "Grátis" : formatBRL(order.freight ?? 0)}
                  </td>
                </tr>
                <tr className="total-line">
                  <td>TOTAL</td>
                  <td className="right">{formatBRL(order.total)}</td>
                </tr>
              </tbody>
            </table>

            <div className="box">
              <div className="label">Condição de pagamento</div>
              <div style={{ fontWeight: 600 }}>
                {paymentLabel(order)}
                {order.installments?.length > 1 && ` · ${order.installments.length}x`}
              </div>
              {order.installments?.length > 0 && (
                <table style={{ marginTop: 8, marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Vencimento</th>
                      <th className="right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.installments.map((i) => (
                      <tr key={i.number}>
                        <td>{i.number}</td>
                        <td>{formatDateBR(i.dueDate)}</td>
                        <td className="right">{formatBRL(i.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="box">
              <div className="label">Entrega</div>
              <div>
                {DELIVERY_METHOD_LABEL[order.delivery?.method] ?? "A combinar"}
                {order.delivery?.carrier ? ` · ${order.delivery.carrier}` : ""}
              </div>
              {order.expectedDeliveryDate && (
                <div className="muted">
                  Previsão: {formatDateBR(order.expectedDeliveryDate)}
                </div>
              )}
              {order.delivery?.notes && <div className="muted">{order.delivery.notes}</div>}
            </div>

            {order.notes && (
              <div className="box">
                <div className="label">Observações</div>
                <div>{order.notes}</div>
              </div>
            )}

            <footer>
              Orçamento sem valor fiscal. Valores sujeitos a alteração após a data de validade
              e à disponibilidade de estoque. {company.name}.
            </footer>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="outline" className="gap-1.5" onClick={handleWhatsApp}>
            <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
          </Button>
          <Button className="gap-1.5" onClick={handlePrint}>
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const OrcamentoPrintIcon = Printer;
