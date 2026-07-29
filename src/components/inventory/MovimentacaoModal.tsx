/**
 * Modal de movimentação de estoque.
 * Escrita real via POST /inventory/movements (backend Hostinger).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  inventoryService,
  MOVEMENT_LABEL,
  type MovementType,
  type StockBalance,
} from "@/services/inventory.service";
import { ApiError } from "@/services/api-client";

const TYPES: MovementType[] = ["IN", "OUT", "RETURN", "LOSS", "ADJUSTMENT"];

export function MovimentacaoModal({
  open,
  onOpenChange,
  balances,
  initialProductId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balances: StockBalance[];
  initialProductId?: string | null;
  onSaved?: () => void;
}) {
  const [productId, setProductId] = useState<string>("");
  const [type, setType] = useState<MovementType>("IN");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProductId(initialProductId ?? "");
    setType("IN");
    setQuantity("");
    setReason("");
    setOrderId("");
    setError(null);
  }, [open, initialProductId]);

  const product = useMemo(
    () => balances.find((b) => b.productId === productId) ?? null,
    [balances, productId],
  );

  const qty = Number(quantity.replace(/\D/g, ""));
  const projected = useMemo(() => {
    if (!product || !Number.isFinite(qty)) return null;
    if (type === "IN" || type === "RETURN") return product.stock + qty;
    if (type === "OUT" || type === "LOSS") return product.stock - qty;
    return qty; // ADJUSTMENT define o saldo final
  }, [product, qty, type]);

  async function handleSave() {
    setError(null);
    if (!productId) return setError("Selecione um produto.");
    if (type !== "ADJUSTMENT" && (!qty || qty <= 0)) return setError("Informe uma quantidade maior que zero.");
    if (!reason.trim()) return setError("O motivo é obrigatório.");
    if (projected !== null && projected < 0) return setError("Saldo insuficiente para esta saída.");

    setSaving(true);
    try {
      await inventoryService.createMovement({
        productId,
        type,
        quantity: qty,
        reason: reason.trim(),
        orderId: orderId.trim() ? orderId.trim() : null,
      });
      toast.success("Movimentação registrada.");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setError(msg || "Falha ao registrar movimentação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Movimentar estoque</DialogTitle>
          <DialogDescription>
            Toda movimentação é registrada no histórico com usuário, data e motivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs font-medium">
              Produto <span className="text-destructive">*</span>
            </Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {balances.map((b) => (
                  <SelectItem key={b.productId} value={b.productId}>
                    {b.name} · saldo {b.stock}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {MOVEMENT_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="qtd" className="mb-1 block text-xs font-medium">
                {type === "ADJUSTMENT" ? "Saldo final" : "Quantidade"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="qtd"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
              />
            </div>
          </div>

          {product && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Saldo atual <span className="font-medium text-foreground">{product.stock}</span>
              {projected !== null && (
                <>
                  {" → "}
                  <span
                    className={
                      projected < 0 ? "font-semibold text-destructive" : "font-semibold text-foreground"
                    }
                  >
                    {projected}
                  </span>
                </>
              )}
              {" · mínimo "}
              {product.minimumStock}
            </div>
          )}

          <div>
            <Label htmlFor="motivo" className="mb-1 block text-xs font-medium">
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motivo"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Recebimento NF 1234 / quebra no transporte"
            />
          </div>

          <div>
            <Label htmlFor="pedido" className="mb-1 block text-xs font-medium">
              Pedido vinculado (opcional)
            </Label>
            <Input
              id="pedido"
              inputMode="numeric"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ""))}
              placeholder="ID do pedido"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar movimentação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
