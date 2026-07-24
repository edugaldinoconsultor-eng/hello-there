/**
 * Modal de criação de Pedido.
 *
 * Foco em LANÇAMENTO RÁPIDO:
 *   selecionar cliente → adicionar produtos → escolher pagamento → confirmar.
 *
 * Nada além dos itens é obrigatório para confirmar. Cliente sem CPF/CNPJ,
 * sem endereço completo ou sem dados comerciais NÃO impede a criação.
 *
 * Cálculos são delegados a `@/lib/order-calc` (funções puras) — este arquivo
 * concentra apenas UI e coleta de dados.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Check, ChevronsUpDown, Loader2, Plus, Trash2, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { maskCurrencyBRL, maskCpfCnpj, maskPhoneBR, onlyDigits, parseCurrencyBRL } from "@/lib/masks";
import {
  MOCK_SALESPEOPLE, PAYMENT_TERMS, PRICE_TABLES,
} from "@/lib/customer-schema";
import { useCustomers, type Customer } from "@/services/customers.service";
import { useProducts, type Product } from "@/services/products.service";
import { useOrders } from "@/services/orders.service";
import {
  DELIVERY_METHOD_LABEL, PAYMENT_CONDITION_LABEL, SALE_TYPE_LABEL,
  type DeliveryMethod, type OrderDelivery, type OrderInstallment, type OrderItem,
  type OrderPayment, type PaymentCondition, type SaleType,
  installmentsCountFor,
} from "@/lib/order-types";
import {
  calcItemSubtotal, calcOrderTotals, formatBRL, generateInstallments,
  installmentsDiff, todayISO,
} from "@/lib/order-calc";
import { NovoClienteModal } from "@/components/customers/NovoClienteModal";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function FieldLabel({
  htmlFor, required, children,
}: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-foreground">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
  );
}

function moneyInputProps(value: number, onChange: (n: number) => void) {
  return {
    inputMode: "numeric" as const,
    placeholder: "R$ 0,00",
    value: value ? maskCurrencyBRL(String(Math.round(value * 100))) : "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(parseCurrencyBRL(e.target.value)),
  };
}

// ------------------------------------------------------------------
// Sub-componente: Combobox de cliente
// ------------------------------------------------------------------

function CustomerCombobox({
  customers, value, onChange, onCreateNew,
}: {
  customers: Customer[];
  value?: Customer;
  onChange: (c: Customer) => void;
  onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2 text-left text-sm hover:bg-secondary"
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value ? value.legalName : "Selecione o cliente…"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(_v, search, keywords) => {
            const hay = (keywords ?? []).join(" ").toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por nome, telefone ou CPF/CNPJ…" />
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onCreateNew}>
                  <UserPlus className="h-3.5 w-3.5" />
                  Cadastrar novo cliente
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  keywords={[c.legalName, c.tradeName ?? "", c.phone, c.document ?? ""]}
                  onSelect={() => { onChange(c); setOpen(false); }}
                >
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{c.legalName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {maskPhoneBR(c.phone)}
                      {c.document ? ` · ${maskCpfCnpj(c.document)}` : ""}
                    </span>
                  </div>
                  {value?.id === c.id && <Check className="h-3.5 w-3.5 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
            <div className="border-t border-border p-2">
              <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={onCreateNew}>
                <UserPlus className="h-3.5 w-3.5" />
                Cadastrar novo cliente
              </Button>
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ------------------------------------------------------------------
// Sub-componente: Combobox de produto (por linha de item)
// ------------------------------------------------------------------

function ProductCombobox({
  products, value, onChange,
}: {
  products: Product[];
  value?: Product;
  onChange: (p: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-left text-sm hover:bg-secondary"
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value ? `${value.sku} · ${value.name}` : "Buscar produto…"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Nome ou SKU…" />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.sku} ${p.name}`}
                  onSelect={() => { onChange(p); setOpen(false); }}
                >
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {p.sku} · Estoque: {p.stock} · {formatBRL(p.price)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ------------------------------------------------------------------
// Modal principal
// ------------------------------------------------------------------

type ItemDraft = {
  key: string;                 // key local (React), independente de productId
  product?: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
};

function newItemDraft(): ItemDraft {
  return {
    key: `it_${Math.random().toString(36).slice(2, 9)}`,
    quantity: 1, unitPrice: 0, discount: 0,
  };
}

export function NovoPedidoModal({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { customers } = useCustomers();
  const { products } = useProducts();
  const { createOrder } = useOrders();

  const [customer, setCustomer] = useState<Customer | undefined>();
  const [saleType, setSaleType] = useState<SaleType>("venda");
  const [sellerId, setSellerId] = useState<string>("");
  const [priceTable, setPriceTable] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>(todayISO());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [items, setItems] = useState<ItemDraft[]>([newItemDraft()]);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("retirada");
  const [useCustomerAddress, setUseCustomerAddress] = useState<boolean>(true);
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [deliveryComplement, setDeliveryComplement] = useState("");
  const [deliveryDistrict, setDeliveryDistrict] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryCep, setDeliveryCep] = useState("");
  const [carrier, setCarrier] = useState("");
  const [freight, setFreight] = useState<number>(0);
  const [freeShipping, setFreeShipping] = useState<boolean>(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>("a_vista");
  const [installments, setInstallments] = useState<OrderInstallment[]>([]);
  const [installmentsTouched, setInstallmentsTouched] = useState(false);

  const [confirmStockOverride, setConfirmStockOverride] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);

  // Recomputa itens com subtotal derivado
  const enrichedItems = useMemo<OrderItem[]>(() => {
    return items
      .filter((i) => !!i.product)
      .map((i) => ({
        id: i.key,
        productId: i.product!.id,
        sku: i.product!.sku,
        name: i.product!.name,
        category: i.product!.category,
        stockAtOrder: i.product!.stock,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        subtotal: calcItemSubtotal(i.quantity, i.unitPrice, i.discount),
      }));
  }, [items]);

  const effectiveFreight = freeShipping ? 0 : freight;
  const totals = useMemo(
    () => calcOrderTotals(enrichedItems, orderDiscount, effectiveFreight),
    [enrichedItems, orderDiscount, effectiveFreight],
  );

  // Gera parcelas automaticamente quando a condição/total muda
  // e o usuário ainda não editou manualmente.
  useEffect(() => {
    if (!open) return;
    if (installmentsTouched && paymentCondition === "personalizado") return;
    const count = installmentsCountFor(paymentCondition);
    setInstallments(generateInstallments(totals.total, count, orderDate || todayISO()));
  }, [paymentCondition, totals.total, orderDate, open, installmentsTouched]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setCustomer(undefined); setSaleType("venda"); setSellerId(""); setPriceTable("");
      setOrderDate(todayISO()); setExpectedDeliveryDate(""); setNotes("");
      setItems([newItemDraft()]); setOrderDiscount(0);
      setDeliveryMethod("retirada"); setUseCustomerAddress(true);
      setDeliveryStreet(""); setDeliveryNumber(""); setDeliveryComplement("");
      setDeliveryDistrict(""); setDeliveryCity(""); setDeliveryState(""); setDeliveryCep("");
      setCarrier(""); setFreight(0); setFreeShipping(false); setDeliveryNotes("");
      setPaymentCondition("a_vista"); setInstallments([]); setInstallmentsTouched(false);
      setConfirmStockOverride(false); setSubmitting(false);
    }
  }, [open]);

  // Auto-preenche vendedor/tabela quando o cliente é escolhido
  useEffect(() => {
    if (!customer) return;
    if (!sellerId && customer.commercial.salespersonId) {
      setSellerId(customer.commercial.salespersonId);
    }
    if (!priceTable && customer.commercial.priceTable) {
      setPriceTable(customer.commercial.priceTable);
    }
  }, [customer]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------- handlers de itens --------
  const updateItem = (key: string, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };
  const removeItem = (key: string) => {
    setItems((prev) => (prev.length === 1 ? [newItemDraft()] : prev.filter((i) => i.key !== key)));
  };
  const addItem = () => setItems((prev) => [...prev, newItemDraft()]);
  const onPickProduct = (key: string, p: Product) => {
    updateItem(key, { product: p, unitPrice: p.price, quantity: 1, discount: 0 });
  };

  // -------- estoque insuficiente --------
  const stockIssues = enrichedItems.filter((i) => {
    const p = products.find((pp) => pp.id === i.productId);
    return p && i.quantity > p.stock;
  });

  // -------- parcelas --------
  const updateInstallment = (idx: number, patch: Partial<OrderInstallment>) => {
    setInstallmentsTouched(true);
    setInstallments((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addInstallment = () => {
    setInstallmentsTouched(true);
    setInstallments((prev) => [
      ...prev,
      { number: prev.length + 1, dueDate: orderDate || todayISO(), amount: 0, paid: false },
    ]);
  };
  const removeInstallment = (idx: number) => {
    setInstallmentsTouched(true);
    setInstallments((prev) =>
      prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, number: i + 1 })),
    );
  };
  const regenerateInstallments = () => {
    setInstallmentsTouched(false);
    setInstallments(
      generateInstallments(
        totals.total,
        installmentsCountFor(paymentCondition),
        orderDate || todayISO(),
      ),
    );
  };

  const installmentsDelta = installmentsDiff(installments, totals.total);
  const installmentsOk = Math.abs(installmentsDelta) < 0.005;

  // -------- validação e submit --------
  function validate(): string | undefined {
    if (!customer) return "Selecione um cliente.";
    if (enrichedItems.length === 0) return "Adicione pelo menos um produto.";
    if (enrichedItems.some((i) => i.quantity <= 0)) return "Quantidade inválida em algum item.";
    if (enrichedItems.some((i) => i.unitPrice <= 0)) return "Valor unitário inválido em algum item.";
    if (totals.total <= 0) return "Total do pedido inválido.";
    if (!installmentsOk) return "A soma das parcelas deve ser igual ao total do pedido.";
    if (stockIssues.length > 0 && !confirmStockOverride) {
      return "Há itens com estoque insuficiente. Confirme para prosseguir mesmo assim.";
    }
    return undefined;
  }

  function buildDelivery(): OrderDelivery {
    const address = deliveryMethod === "retirada"
      ? undefined
      : useCustomerAddress && customer
        ? {
            cep: customer.address.cep,
            street: customer.address.street,
            number: customer.address.number,
            complement: customer.address.complement,
            district: customer.address.district,
            city: customer.address.city,
            state: customer.address.state,
          }
        : {
            cep: deliveryCep ? onlyDigits(deliveryCep) : undefined,
            street: deliveryStreet || undefined,
            number: deliveryNumber || undefined,
            complement: deliveryComplement || undefined,
            district: deliveryDistrict || undefined,
            city: deliveryCity || undefined,
            state: deliveryState || undefined,
          };
    return {
      method: deliveryMethod,
      address,
      carrier: deliveryMethod === "transportadora" ? (carrier || undefined) : undefined,
      freight: effectiveFreight,
      freeShipping,
      notes: deliveryNotes || undefined,
    };
  }

  function buildPayment(): OrderPayment {
    return {
      condition: paymentCondition,
      installmentsCount: installments.length,
    };
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const seller = MOCK_SALESPEOPLE.find((s) => s.id === sellerId);
      // seller_id NÃO é enviado — backend define pelo usuário autenticado.
      const created = await createOrder({
        customerId: customer!.id,
        sellerId: sellerId || undefined,
        sellerName: seller?.name,
        priceTable: (priceTable || undefined) as never,
        saleType,
        status: "confirmed",
        items: enrichedItems,
        subtotal: totals.subtotal,
        discount: totals.discount,
        freight: totals.freight,
        total: totals.total,
        payment: buildPayment(),
        installments,
        delivery: buildDelivery(),
        notes: notes || undefined,
        orderDate,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
      });
      toast.success(`Pedido ${created.order_number} confirmado com sucesso.`);
      onOpenChange(false);
    } catch (e) {
      // Mensagens amigáveis para os erros esperados do backend.
      const anyErr = e as { status?: number; message?: string };
      if (anyErr?.status === 403) {
        toast.error("Você não possui permissão para criar pedidos.");
      } else if (anyErr?.status === 404) {
        toast.error(anyErr.message ?? "Cliente não encontrado nesta empresa.");
      } else if (anyErr?.status === 422) {
        toast.error(anyErr.message ?? "Dados inválidos no pedido.");
      } else if (anyErr?.status === 401) {
        // Fluxo global de sessão já cuida do redirect.
        toast.error("Sessão expirada. Faça login novamente.");
      } else {
        toast.error(anyErr?.message ?? "Não foi possível confirmar o pedido.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------- render ----------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "border-border bg-popover p-0",
          "sm:max-w-3xl md:max-w-5xl",
          "max-h-[94vh] overflow-hidden",
        )}
      >
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="text-base">Novo pedido</DialogTitle>
          <DialogDescription className="text-xs">
            Selecione o cliente, adicione produtos e defina o pagamento.
            Apenas cliente e itens são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[calc(94vh-64px-72px)] flex-col overflow-hidden">
          <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto px-6 py-5 lg:grid-cols-[1fr_320px]">
            {/* ============ COLUNA PRINCIPAL ============ */}
            <div className="space-y-6">
              {/* ----- Cliente ----- */}
              <section className="space-y-2">
                <SectionTitle>Cliente</SectionTitle>
                <CustomerCombobox
                  customers={customers}
                  value={customer}
                  onChange={setCustomer}
                  onCreateNew={() => setNovoClienteOpen(true)}
                />
                {customer && (
                  <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      <InfoLine label="Nome" value={customer.legalName} />
                      <InfoLine label="Telefone" value={maskPhoneBR(customer.phone)} />
                      {customer.document && (
                        <InfoLine label="CPF/CNPJ" value={maskCpfCnpj(customer.document)} />
                      )}
                      {(customer.address.street || customer.address.city) && (
                        <InfoLine
                          label="Endereço"
                          value={[
                            customer.address.street,
                            customer.address.number,
                            customer.address.city,
                            customer.address.state,
                          ].filter(Boolean).join(", ")}
                        />
                      )}
                      {customer.commercial.salespersonName && (
                        <InfoLine label="Vendedor" value={customer.commercial.salespersonName} />
                      )}
                      {typeof customer.commercial.creditLimit === "number" &&
                        customer.commercial.creditLimit > 0 && (
                        <InfoLine
                          label="Limite de crédito"
                          value={formatBRL(customer.commercial.creditLimit)}
                        />
                      )}
                      {typeof customer.aggregates.averageTicket === "number" && (
                        <InfoLine
                          label="Ticket médio"
                          value={formatBRL(customer.aggregates.averageTicket)}
                        />
                      )}
                      {customer.aggregates.lastPurchaseAt && (
                        <InfoLine
                          label="Última compra"
                          value={new Date(customer.aggregates.lastPurchaseAt).toLocaleDateString("pt-BR")}
                        />
                      )}
                      {typeof customer.aggregates.pendingReceivables === "number" &&
                        customer.aggregates.pendingReceivables > 0 && (
                        <InfoLine
                          label="Pagamentos pendentes"
                          value={formatBRL(customer.aggregates.pendingReceivables)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* ----- Dados comerciais ----- */}
              <section className="space-y-3">
                <SectionTitle>Dados comerciais</SectionTitle>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div>
                    <FieldLabel>Tipo de venda</FieldLabel>
                    <Select value={saleType} onValueChange={(v) => setSaleType(v as SaleType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SALE_TYPE_LABEL) as SaleType[]).map((k) => (
                          <SelectItem key={k} value={k}>{SALE_TYPE_LABEL[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>Vendedor / Representante</FieldLabel>
                    <Select value={sellerId} onValueChange={setSellerId}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        {MOCK_SALESPEOPLE.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>Tabela de preço</FieldLabel>
                    <Select value={priceTable} onValueChange={setPriceTable}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        {PRICE_TABLES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel htmlFor="orderDate">Data do pedido</FieldLabel>
                    <Input
                      id="orderDate" type="date"
                      value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="expectedDeliveryDate">Entrega prevista</FieldLabel>
                    <Input
                      id="expectedDeliveryDate" type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* ----- Itens ----- */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <SectionTitle>Itens do pedido</SectionTitle>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={addItem}>
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar produto
                  </Button>
                </div>

                <div className="space-y-2">
                  {items.map((it) => {
                    const stock = it.product?.stock ?? 0;
                    const overStock = !!it.product && it.quantity > stock;
                    const sub = calcItemSubtotal(it.quantity, it.unitPrice, it.discount);
                    return (
                      <div
                        key={it.key}
                        className={cn(
                          "grid grid-cols-12 gap-2 rounded-md border border-border bg-card p-2",
                          overStock && "border-warning/60",
                        )}
                      >
                        <div className="col-span-12 md:col-span-5">
                          <ProductCombobox
                            products={products}
                            value={it.product}
                            onChange={(p) => onPickProduct(it.key, p)}
                          />
                          {it.product && (
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>SKU {it.product.sku}</span>
                              <span>·</span>
                              <span className={cn(overStock && "text-warning")}>
                                Estoque: {stock}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="col-span-4 md:col-span-1">
                          <FieldLabel>Qtd.</FieldLabel>
                          <Input
                            type="number" min={1} step={1}
                            value={it.quantity}
                            onChange={(e) => updateItem(it.key, { quantity: Number(e.target.value) })}
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                          <FieldLabel>Unitário</FieldLabel>
                          <Input
                            {...moneyInputProps(it.unitPrice, (n) => updateItem(it.key, { unitPrice: n }))}
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                          <FieldLabel>Desconto</FieldLabel>
                          <Input
                            {...moneyInputProps(it.discount, (n) => updateItem(it.key, { discount: n }))}
                          />
                        </div>
                        <div className="col-span-10 md:col-span-1">
                          <FieldLabel>Subtotal</FieldLabel>
                          <div className="flex h-9 items-center rounded-md border border-border bg-secondary/40 px-2 text-xs font-medium text-foreground">
                            {formatBRL(sub)}
                          </div>
                        </div>
                        <div className="col-span-2 flex items-end justify-end md:col-span-1">
                          <Button
                            type="button" variant="ghost" size="icon"
                            aria-label="Remover item"
                            onClick={() => removeItem(it.key)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                        {overStock && (
                          <div className="col-span-12 flex items-center gap-1.5 rounded bg-warning/10 px-2 py-1 text-[11px] text-warning">
                            <AlertTriangle className="h-3 w-3" />
                            Quantidade solicitada excede o estoque ({stock} disponíveis).
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {stockIssues.length > 0 && (
                  <label className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                    <input
                      type="checkbox"
                      checked={confirmStockOverride}
                      onChange={(e) => setConfirmStockOverride(e.target.checked)}
                    />
                    Confirmo o pedido mesmo com itens sem estoque suficiente.
                  </label>
                )}
              </section>

              {/* ----- Entrega ----- */}
              <section className="space-y-3">
                <SectionTitle>Entrega</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DELIVERY_METHOD_LABEL) as DeliveryMethod[]).map((m) => (
                    <button
                      key={m} type="button"
                      onClick={() => setDeliveryMethod(m)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition",
                        deliveryMethod === m
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {DELIVERY_METHOD_LABEL[m]}
                    </button>
                  ))}
                </div>

                {deliveryMethod !== "retirada" && (
                  <>
                    {customer && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={useCustomerAddress}
                          onChange={(e) => setUseCustomerAddress(e.target.checked)}
                        />
                        Usar endereço cadastrado do cliente
                      </label>
                    )}
                    {!useCustomerAddress && (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                        <div className="md:col-span-4">
                          <FieldLabel>Endereço</FieldLabel>
                          <Input value={deliveryStreet} onChange={(e) => setDeliveryStreet(e.target.value)} />
                        </div>
                        <div><FieldLabel>Número</FieldLabel>
                          <Input value={deliveryNumber} onChange={(e) => setDeliveryNumber(e.target.value)} /></div>
                        <div><FieldLabel>Complemento</FieldLabel>
                          <Input value={deliveryComplement} onChange={(e) => setDeliveryComplement(e.target.value)} /></div>
                        <div className="md:col-span-2"><FieldLabel>Bairro</FieldLabel>
                          <Input value={deliveryDistrict} onChange={(e) => setDeliveryDistrict(e.target.value)} /></div>
                        <div className="md:col-span-2"><FieldLabel>Cidade</FieldLabel>
                          <Input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} /></div>
                        <div><FieldLabel>UF</FieldLabel>
                          <Input value={deliveryState} onChange={(e) => setDeliveryState(e.target.value.toUpperCase().slice(0, 2))} /></div>
                        <div><FieldLabel>CEP</FieldLabel>
                          <Input value={deliveryCep} onChange={(e) => setDeliveryCep(e.target.value)} /></div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {deliveryMethod === "transportadora" && (
                        <div>
                          <FieldLabel>Transportadora</FieldLabel>
                          <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                        </div>
                      )}
                      <div>
                        <FieldLabel>Frete</FieldLabel>
                        <Input {...moneyInputProps(freight, setFreight)} disabled={freeShipping} />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <Switch checked={freeShipping} onCheckedChange={setFreeShipping} />
                          Frete grátis
                        </label>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <FieldLabel>Observação da entrega</FieldLabel>
                  <Textarea
                    rows={2}
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                  />
                </div>
              </section>

              {/* ----- Pagamento ----- */}
              <section className="space-y-3">
                <SectionTitle>Pagamento</SectionTitle>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <FieldLabel>Condição</FieldLabel>
                    <Select
                      value={paymentCondition}
                      onValueChange={(v) => {
                        setPaymentCondition(v as PaymentCondition);
                        setInstallmentsTouched(false);
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PAYMENT_CONDITION_LABEL) as PaymentCondition[]).map((k) => (
                          <SelectItem key={k} value={k}>{PAYMENT_CONDITION_LABEL[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {paymentCondition === "personalizado" && (
                    <div className="flex items-end">
                      <Button type="button" size="sm" variant="outline" onClick={addInstallment} className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Adicionar parcela
                      </Button>
                    </div>
                  )}
                  {paymentCondition !== "personalizado" && (
                    <div className="flex items-end">
                      <Button type="button" size="sm" variant="outline" onClick={regenerateInstallments}>
                        Regerar parcelas
                      </Button>
                    </div>
                  )}
                  {/* Referência de condição-padrão do cliente (opcional) */}
                  {customer?.commercial.paymentTerm && (
                    <div className="text-[11px] text-muted-foreground md:col-span-1">
                      Padrão do cliente:{" "}
                      {PAYMENT_TERMS.find((p) => p.value === customer.commercial.paymentTerm)?.label}
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Parcela</th>
                        <th className="px-2 py-1.5 text-left font-medium">Vencimento</th>
                        <th className="px-2 py-1.5 text-right font-medium">Valor</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map((inst, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-2 py-1.5">{inst.number}</td>
                          <td className="px-2 py-1">
                            <Input
                              type="date" value={inst.dueDate}
                              onChange={(e) => updateInstallment(idx, { dueDate: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              className="h-8 text-right text-xs"
                              {...moneyInputProps(inst.amount, (n) => updateInstallment(idx, { amount: n }))}
                            />
                          </td>
                          <td className="px-1 py-1 text-right">
                            {paymentCondition === "personalizado" && installments.length > 1 && (
                              <Button
                                type="button" variant="ghost" size="icon"
                                onClick={() => removeInstallment(idx)}
                                aria-label="Remover parcela"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!installmentsOk && (
                  <div className="flex items-center gap-1.5 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    Soma das parcelas difere do total em {formatBRL(installmentsDelta)}.
                  </div>
                )}
              </section>

              {/* ----- Observações ----- */}
              <section className="space-y-2">
                <SectionTitle>Observações do pedido</SectionTitle>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </section>
            </div>

            {/* ============ COLUNA RESUMO ============ */}
            <aside className="space-y-3 lg:sticky lg:top-0">
              <div className="rounded-lg border border-border bg-card p-4">
                <SectionTitle>Resumo do pedido</SectionTitle>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <SummaryLine label="Produtos" value={String(totals.itemsCount)} />
                  <SummaryLine label="Unidades" value={String(totals.unitsCount)} />
                  <SummaryLine label="Subtotal" value={formatBRL(totals.subtotal)} />
                  <div>
                    <FieldLabel>Desconto adicional</FieldLabel>
                    <Input
                      className="h-8 text-xs"
                      {...moneyInputProps(orderDiscount, setOrderDiscount)}
                    />
                  </div>
                  <SummaryLine label="Frete" value={formatBRL(totals.freight)} />
                </dl>
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Total do pedido
                    </span>
                    <span className="text-xl font-semibold text-primary">
                      {formatBRL(totals.total)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {PAYMENT_CONDITION_LABEL[paymentCondition]} · {installments.length}{" "}
                    {installments.length === 1 ? "parcela" : "parcelas"}
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <DialogFooter className="border-t border-border bg-popover px-6 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              disabled
              title="Rascunho ainda não disponível no backend."
            >
              Salvar rascunho
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</>
              ) : "Confirmar pedido"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>

      {/* Reuso do fluxo de Novo Cliente já existente */}
      <NovoClienteModal open={novoClienteOpen} onOpenChange={setNovoClienteOpen} />
    </Dialog>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs text-foreground">{value}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
