/**
 * Modal de cadastro de Novo Produto.
 * - Segue o design system atual do SoulERP (dark, cards, accent violeta).
 * - Persistência via POST /products (backend real Hostinger).
 * - CSRF + cookies tratados pelo api-client central.
 */
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useProducts, type NewProductInput } from "@/services/products.service";
import { ApiError } from "@/services/api-client";
import { maskCurrencyBRL, parseCurrencyBRL } from "@/lib/masks";
import { assertPermission } from "@/lib/permissions";
import { useSession } from "@/mocks/session";

type FormValues = {
  sku: string;
  name: string;
  category: string;
  priceMasked: string;
  stock: string;
  minimumStock: string;
};

const defaultValues: FormValues = {
  sku: "",
  name: "",
  category: "",
  priceMasked: "",
  stock: "",
  minimumStock: "",
};

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

function parseDecimal(v: string): number {
  if (!v) return 0;
  const normalized = v.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export function NovoProdutoModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { createProduct } = useProducts();
  const { user } = useSession();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
  } = useForm<FormValues>({ defaultValues, mode: "onBlur" });

  useEffect(() => {
    if (!open) reset(defaultValues);
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    // Validação manual (mantém dependências enxutas — sem zod aqui).
    let hasError = false;
    if (!values.sku.trim()) {
      setError("sku", { message: "SKU obrigatório." });
      hasError = true;
    }
    if (!values.name.trim()) {
      setError("name", { message: "Nome do produto obrigatório." });
      hasError = true;
    }
    const price = parseCurrencyBRL(values.priceMasked || "");
    if (!(price > 0)) {
      setError("priceMasked", { message: "Informe um preço válido." });
      hasError = true;
    }
    const stock = values.stock ? parseDecimal(values.stock) : 0;
    if (Number.isNaN(stock) || stock < 0) {
      setError("stock", { message: "Estoque inválido." });
      hasError = true;
    }
    const minimumStock = values.minimumStock ? parseDecimal(values.minimumStock) : 0;
    if (Number.isNaN(minimumStock) || minimumStock < 0) {
      setError("minimumStock", { message: "Estoque mínimo inválido." });
      hasError = true;
    }
    if (hasError) return;

    try {
      assertPermission(user, "products.create");
    } catch {
      toast.error("Você não tem permissão para cadastrar produtos.");
      return;
    }

    const payload: NewProductInput = {
      sku: values.sku.trim(),
      name: values.name.trim(),
      category: values.category.trim() || undefined,
      price,
      stock,
      minimumStock,
    };

    setSubmitting(true);
    try {
      const created = await createProduct(payload);
      toast.success(`Produto "${created.name}" cadastrado com sucesso.`);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          toast.error("Permissão insuficiente para cadastrar produtos.");
        } else if (err.status === 409) {
          toast.error("Já existe um produto com este SKU.");
          setError("sku", { message: "SKU já cadastrado." });
        } else if (err.status === 422) {
          toast.error(err.message || "Dados inválidos.");
        } else if (err.status === 401) {
          // 401 é tratado globalmente pelo api-client (derruba sessão).
          toast.error("Sessão expirada. Faça login novamente.");
        } else {
          toast.error("Não foi possível cadastrar o produto. Tente novamente.");
        }
      } else {
        toast.error("Falha inesperada ao cadastrar produto.");
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "border-border bg-popover p-0",
          "sm:max-w-xl",
          "max-h-[92vh] overflow-hidden",
        )}
      >
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="text-base">Novo produto</DialogTitle>
          <DialogDescription className="text-xs">
            Cadastre um produto do catálogo da sua empresa. Campos marcados com{" "}
            <span className="text-destructive">*</span> são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex max-h-[calc(92vh-64px-72px)] flex-col"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor="sku" required>SKU</FieldLabel>
                <Input
                  id="sku"
                  autoComplete="off"
                  placeholder="PROD-001"
                  {...register("sku")}
                  aria-invalid={!!errors.sku}
                />
                <FieldError message={errors.sku?.message} />
              </div>

              <div>
                <FieldLabel htmlFor="category">Categoria</FieldLabel>
                <Input
                  id="category"
                  autoComplete="off"
                  placeholder="Ex.: Suplementos"
                  {...register("category")}
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel htmlFor="name" required>Nome do produto</FieldLabel>
                <Input
                  id="name"
                  autoComplete="off"
                  placeholder="Ex.: Whey Protein 900g"
                  {...register("name")}
                  aria-invalid={!!errors.name}
                />
                <FieldError message={errors.name?.message} />
              </div>

              <div>
                <FieldLabel htmlFor="price" required>Preço</FieldLabel>
                <Controller
                  control={control}
                  name="priceMasked"
                  render={({ field }) => (
                    <Input
                      id="price"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={maskCurrencyBRL(field.value ?? "")}
                      onChange={(e) => field.onChange(maskCurrencyBRL(e.target.value))}
                      onBlur={field.onBlur}
                      aria-invalid={!!errors.priceMasked}
                    />
                  )}
                />
                <FieldError message={errors.priceMasked?.message} />
              </div>

              <div>
                <FieldLabel htmlFor="stock">Estoque inicial</FieldLabel>
                <Input
                  id="stock"
                  inputMode="decimal"
                  placeholder="0"
                  {...register("stock")}
                  aria-invalid={!!errors.stock}
                />
                <FieldError message={errors.stock?.message} />
              </div>

              <div>
                <FieldLabel htmlFor="minimumStock">Estoque mínimo</FieldLabel>
                <Input
                  id="minimumStock"
                  inputMode="decimal"
                  placeholder="0"
                  {...register("minimumStock")}
                  aria-invalid={!!errors.minimumStock}
                />
                <FieldError message={errors.minimumStock?.message} />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Salvando…" : "Salvar produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
