/**
 * Modal de cadastro de Novo Cliente.
 *
 * - Segue o design system existente (dark, cards, accent violeta).
 * - Validação com react-hook-form + zod (schema em `@/lib/customer-schema`).
 * - Máscaras aplicadas em CPF/CNPJ, telefone, CEP e limite de crédito.
 * - Persistência: mock local escopo `companyId` — sem backend nesta etapa.
 * - Hooks `handleLookupCNPJ` / `handleLookupCEP` já ligados aos botões e
 *   estão prontos para receber integração de API (ReceitaWS / ViaCEP)
 *   sem alterar a UI.
 */
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  customerFormSchema,
  type CustomerFormValues,
  MOCK_SALESPEOPLE,
  PAYMENT_TERMS,
  PRICE_TABLES,
  UF_LIST,
} from "@/lib/customer-schema";
import {
  maskCpfCnpj,
  maskPhoneBR,
  maskCEP,
  maskCurrencyBRL,
  parseCurrencyBRL,
  onlyDigits,
} from "@/lib/masks";
import { useCustomers } from "@/mocks/customers";
import { cn } from "@/lib/utils";

const defaultValues: CustomerFormValues = {
  personType: "PJ",
  legalName: "",
  tradeName: "",
  document: "",
  phone: "",
  email: "",
  address: {
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  },
  commercial: {
    salespersonId: "",
    priceTable: "atacado",
    creditLimit: 0,
    paymentTerm: "30_dias",
    notes: "",
  },
  status: { active: true, diamond: false },
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-medium text-foreground"
    >
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] text-destructive">{message}</p>;
}

export function NovoClienteModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { createCustomer } = useCustomers();
  const [lookupCnpj, setLookupCnpj] = useState(false);
  const [lookupCep, setLookupCep] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  useEffect(() => {
    if (!open) reset(defaultValues);
  }, [open, reset]);

  const personType = watch("personType");
  const documentValue = watch("document");
  const cepValue = watch("address.cep");

  /**
   * Placeholder para futura integração ReceitaWS / BrasilAPI.
   * Já validado antes de disparar (evita chamadas desnecessárias).
   */
  const handleLookupCNPJ = async () => {
    const d = onlyDigits(documentValue ?? "");
    if (d.length !== 14) {
      toast.warning("Informe um CNPJ completo para consultar.");
      return;
    }
    setLookupCnpj(true);
    try {
      // TODO: substituir por chamada real (server function) na próxima etapa.
      await new Promise((r) => setTimeout(r, 600));
      toast.info("Consulta automática de CNPJ será liberada em breve.");
    } finally {
      setLookupCnpj(false);
    }
  };

  const handleLookupCEP = async () => {
    const d = onlyDigits(cepValue ?? "");
    if (d.length !== 8) {
      toast.warning("Informe um CEP completo para consultar.");
      return;
    }
    setLookupCep(true);
    try {
      // TODO: substituir por ViaCEP/BrasilAPI (server function).
      await new Promise((r) => setTimeout(r, 500));
      toast.info("Consulta automática de CEP será liberada em breve.");
    } finally {
      setLookupCep(false);
    }
  };

  const onSubmit = handleSubmit((values) => {
    const sp = MOCK_SALESPEOPLE.find((s) => s.id === values.commercial.salespersonId);
    const created = createCustomer({
      personType: values.personType,
      legalName: values.legalName.trim(),
      tradeName: values.tradeName || undefined,
      document: values.document ? onlyDigits(values.document) : undefined,
      phone: onlyDigits(values.phone),
      email: values.email || undefined,
      address: {
        cep: values.address.cep ? onlyDigits(values.address.cep) : undefined,
        street: values.address.street,
        number: values.address.number || undefined,
        complement: values.address.complement || undefined,
        district: values.address.district || undefined,
        city: values.address.city || undefined,
        state: (values.address.state as string) || undefined,
      },
      commercial: {
        salespersonId: values.commercial.salespersonId || undefined,
        salespersonName: sp?.name,
        priceTable: values.commercial.priceTable || undefined,
        creditLimit: values.commercial.creditLimit ?? undefined,
        paymentTerm: values.commercial.paymentTerm || undefined,
        notes: values.commercial.notes || undefined,
      },
      status: values.status,
    });
    toast.success(`Cliente "${created.legalName}" cadastrado.`);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "border-border bg-popover p-0",
          "sm:max-w-2xl md:max-w-3xl",
          "max-h-[92vh] overflow-hidden",
        )}
      >
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="text-base">Novo cliente</DialogTitle>
          <DialogDescription className="text-xs">
            Cadastre um cliente da sua empresa. Campos marcados com{" "}
            <span className="text-destructive">*</span> são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex max-h-[calc(92vh-64px-72px)] flex-col"
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* ---------------- Dados principais ---------------- */}
            <section className="space-y-3">
              <SectionTitle>Dados principais</SectionTitle>

              <div>
                <FieldLabel>Tipo de cliente</FieldLabel>
                <Controller
                  control={control}
                  name="personType"
                  render={({ field }) => (
                    <div className="inline-flex rounded-md border border-border bg-secondary p-0.5">
                      {(["PJ", "PF"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => field.onChange(t)}
                          className={cn(
                            "rounded px-3 py-1 text-xs font-medium transition",
                            field.value === t
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {t === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="legalName" required>
                    {personType === "PJ" ? "Razão Social" : "Nome completo"}
                  </FieldLabel>
                  <Input
                    id="legalName"
                    autoComplete="off"
                    {...register("legalName")}
                    aria-invalid={!!errors.legalName}
                  />
                  <FieldError message={errors.legalName?.message} />
                </div>

                {personType === "PJ" && (
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="tradeName">Nome Fantasia</FieldLabel>
                    <Input id="tradeName" autoComplete="off" {...register("tradeName")} />
                  </div>
                )}

                <div>
                  <FieldLabel htmlFor="document">
                    {personType === "PJ" ? "CNPJ" : "CPF"}
                  </FieldLabel>
                  <div className="flex gap-2">
                    <Controller
                      control={control}
                      name="document"
                      render={({ field }) => (
                        <Input
                          id="document"
                          inputMode="numeric"
                          placeholder={personType === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                          value={maskCpfCnpj(field.value ?? "")}
                          onChange={(e) => field.onChange(maskCpfCnpj(e.target.value))}
                          onBlur={field.onBlur}
                          aria-invalid={!!errors.document}
                        />
                      )}
                    />
                    {personType === "PJ" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleLookupCNPJ}
                        disabled={lookupCnpj}
                        aria-label="Consultar CNPJ"
                        title="Consultar CNPJ (em breve)"
                      >
                        {lookupCnpj ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  <FieldError message={errors.document?.message} />
                </div>

                <div>
                  <FieldLabel htmlFor="phone" required>
                    Telefone / WhatsApp
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field }) => (
                      <Input
                        id="phone"
                        inputMode="tel"
                        placeholder="(11) 90000-0000"
                        value={maskPhoneBR(field.value ?? "")}
                        onChange={(e) => field.onChange(maskPhoneBR(e.target.value))}
                        onBlur={field.onBlur}
                        aria-invalid={!!errors.phone}
                      />
                    )}
                  />
                  <FieldError message={errors.phone?.message} />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel htmlFor="email">E-mail</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="off"
                    placeholder="cliente@exemplo.com.br"
                    {...register("email")}
                    aria-invalid={!!errors.email}
                  />
                  <FieldError message={errors.email?.message} />
                </div>
              </div>
            </section>

            {/* ---------------- Endereço ---------------- */}
            <section className="space-y-3">
              <SectionTitle>Endereço</SectionTitle>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="cep">CEP</FieldLabel>
                  <div className="flex gap-2">
                    <Controller
                      control={control}
                      name="address.cep"
                      render={({ field }) => (
                        <Input
                          id="cep"
                          inputMode="numeric"
                          placeholder="00000-000"
                          value={maskCEP(field.value ?? "")}
                          onChange={(e) => field.onChange(maskCEP(e.target.value))}
                          onBlur={field.onBlur}
                          aria-invalid={!!errors.address?.cep}
                        />
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleLookupCEP}
                      disabled={lookupCep}
                      aria-label="Consultar CEP"
                      title="Consultar CEP (em breve)"
                    >
                      {lookupCep ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <FieldError message={errors.address?.cep?.message} />
                </div>

                <div className="md:col-span-3">
                  <FieldLabel htmlFor="street" required>Endereço</FieldLabel>
                  <Input
                    id="street"
                    placeholder="Rua, avenida, logradouro…"
                    {...register("address.street")}
                    aria-invalid={!!errors.address?.street}
                  />
                  <FieldError message={errors.address?.street?.message} />
                </div>
                <div className="md:col-span-1">
                  <FieldLabel htmlFor="number">Número</FieldLabel>
                  <Input id="number" {...register("address.number")} />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel htmlFor="complement">Complemento</FieldLabel>
                  <Input id="complement" {...register("address.complement")} />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="district">Bairro</FieldLabel>
                  <Input id="district" {...register("address.district")} />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="city">Cidade</FieldLabel>
                  <Input id="city" {...register("address.city")} />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Estado</FieldLabel>
                  <Controller
                    control={control}
                    name="address.state"
                    render={({ field }) => (
                      <Select
                        value={field.value || ""}
                        onValueChange={(v) => field.onChange(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {UF_LIST.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </section>

            {/* ---------------- Comercial ---------------- */}
            <section className="space-y-3">
              <SectionTitle>Dados comerciais</SectionTitle>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel>Vendedor / Representante</FieldLabel>
                  <Controller
                    control={control}
                    name="commercial.salespersonId"
                    render={({ field }) => (
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOCK_SALESPEOPLE.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div>
                  <FieldLabel>Tabela de preço</FieldLabel>
                  <Controller
                    control={control}
                    name="commercial.priceTable"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRICE_TABLES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="creditLimit">Limite de crédito</FieldLabel>
                  <Controller
                    control={control}
                    name="commercial.creditLimit"
                    render={({ field }) => (
                      <Input
                        id="creditLimit"
                        inputMode="numeric"
                        placeholder="R$ 0,00"
                        value={field.value ? maskCurrencyBRL(String(Math.round(field.value * 100))) : ""}
                        onChange={(e) => field.onChange(parseCurrencyBRL(e.target.value))}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                  <FieldError message={errors.commercial?.creditLimit?.message} />
                </div>

                <div>
                  <FieldLabel>Condição de pagamento</FieldLabel>
                  <Controller
                    control={control}
                    name="commercial.paymentTerm"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TERMS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel htmlFor="notes">Observações</FieldLabel>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="Preferências, restrições logísticas, contatos alternativos…"
                    {...register("commercial.notes")}
                  />
                </div>
              </div>
            </section>

            {/* ---------------- Status ---------------- */}
            <section className="space-y-3">
              <SectionTitle>Status</SectionTitle>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Cliente ativo</p>
                    <p className="text-[11px] text-muted-foreground">
                      Clientes inativos não aparecem em novos pedidos.
                    </p>
                  </div>
                  <Controller
                    control={control}
                    name="status.active"
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Cliente Diamante</p>
                    <p className="text-[11px] text-muted-foreground">
                      Habilita benefícios e priorização de atendimento.
                    </p>
                  </div>
                  <Controller
                    control={control}
                    name="status.diamond"
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="border-t border-border bg-popover px-6 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                "Salvar cliente"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
