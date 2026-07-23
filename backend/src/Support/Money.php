<?php
declare(strict_types=1);

namespace SoulERP\Support;

/**
 * Aritmética de dinheiro em CENTAVOS (inteiros).
 * Nunca use float para preço/valor. Nunca.
 */
final class Money
{
    /** Converte "12.30" | 12.3 | 1230 (já em centavos, se int) em centavos. */
    public static function toCents(mixed $value): int
    {
        if (is_int($value)) {
            return $value; // assume que já veio em centavos
        }
        if (is_float($value)) {
            return (int) round($value * 100);
        }
        if (is_string($value)) {
            $clean = str_replace([' ', 'R$'], '', $value);
            // aceita "1.234,56" ou "1234.56"
            if (str_contains($clean, ',')) {
                $clean = str_replace('.', '', $clean);
                $clean = str_replace(',', '.', $clean);
            }
            if (!is_numeric($clean)) {
                return 0;
            }
            return (int) round(((float) $clean) * 100);
        }
        return 0;
    }

    public static function fromCents(int $cents): string
    {
        // devolve string com 2 casas — evita float ao serializar JSON
        $sign = $cents < 0 ? '-' : '';
        $abs = abs($cents);
        $reais = intdiv($abs, 100);
        $rest = $abs % 100;
        return $sign . $reais . '.' . str_pad((string) $rest, 2, '0', STR_PAD_LEFT);
    }

    /**
     * Divide total em N parcelas absorvendo resto de centavos na última.
     * Invariante: soma == total.
     *
     * @return int[] em centavos
     */
    public static function splitInstallments(int $totalCents, int $count): array
    {
        if ($count <= 0) return [];
        $base = intdiv($totalCents, $count);
        $rest = $totalCents - ($base * $count);
        $out = array_fill(0, $count, $base);
        $out[$count - 1] += $rest;
        return $out;
    }
}
