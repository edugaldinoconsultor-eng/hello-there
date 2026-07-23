<?php
declare(strict_types=1);

namespace SoulERP\Services;

use SoulERP\Http\HttpException;
use SoulERP\Support\Money;

/**
 * Recalcula totais do pedido a partir dos itens.
 *
 * REGRA: o backend NUNCA confia no total enviado pelo frontend. Ele aceita
 * quantidade / preço unitário / desconto / frete e recalcula tudo em centavos.
 */
final class OrderPricing
{
    /**
     * @param array<int, array{quantity:int, unit_price:mixed, discount?:mixed}> $items
     * @return array{subtotal_cents:int, discount_cents:int, freight_cents:int, total_cents:int}
     */
    public static function compute(array $items, mixed $discount, mixed $freight): array
    {
        $subtotal = 0;
        $itemDiscount = 0;
        foreach ($items as $i => $item) {
            $qty = (int) ($item['quantity'] ?? 0);
            if ($qty <= 0) {
                throw new HttpException(422, 'VALIDATION_ERROR', "Quantidade inválida no item {$i}.");
            }
            $unit = Money::toCents($item['unit_price'] ?? 0);
            if ($unit < 0) {
                throw new HttpException(422, 'VALIDATION_ERROR', "Preço inválido no item {$i}.");
            }
            $itemDisc = Money::toCents($item['discount'] ?? 0);
            $subtotal += $unit * $qty;
            $itemDiscount += $itemDisc;
        }
        $orderDiscount = Money::toCents($discount ?? 0);
        $freightCents = Money::toCents($freight ?? 0);
        $totalDiscount = $itemDiscount + $orderDiscount;
        $total = $subtotal - $totalDiscount + $freightCents;
        if ($total < 0) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Desconto maior que o total do pedido.');
        }
        return [
            'subtotal_cents' => $subtotal,
            'discount_cents' => $totalDiscount,
            'freight_cents'  => $freightCents,
            'total_cents'    => $total,
        ];
    }

    /**
     * Valida parcelas enviadas pelo cliente. Se somaram diferente do total,
     * o backend redistribui via splitInstallments para manter invariante.
     *
     * @param array<int, array{due_date:string, amount:mixed}> $installments
     * @return array<int, array{installment_number:int, due_date:string, amount_cents:int}>
     */
    public static function normalizeInstallments(array $installments, int $totalCents): array
    {
        if ($installments === []) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Pedido precisa de ao menos 1 parcela.');
        }
        $sum = 0;
        $out = [];
        foreach ($installments as $i => $ip) {
            $due = (string) ($ip['due_date'] ?? '');
            if ($due === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $due)) {
                throw new HttpException(422, 'VALIDATION_ERROR', "Vencimento inválido na parcela " . ($i + 1) . '.');
            }
            $amt = Money::toCents($ip['amount'] ?? 0);
            $sum += $amt;
            $out[] = [
                'installment_number' => $i + 1,
                'due_date' => $due,
                'amount_cents' => $amt,
            ];
        }
        if ($sum !== $totalCents) {
            // Ajusta última parcela para absorver o resto — nunca aceita divergência.
            $out[array_key_last($out)]['amount_cents'] += ($totalCents - $sum);
        }
        return $out;
    }
}
