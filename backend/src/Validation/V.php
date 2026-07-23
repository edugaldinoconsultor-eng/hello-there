<?php
declare(strict_types=1);

namespace SoulERP\Validation;

use SoulERP\Http\HttpException;

/**
 * Validador minimalista. Não é Zod, mas cobre o suficiente para input HTTP.
 * Todo campo obrigatório deve passar por aqui. Detalhes vão em `details`.
 */
final class V
{
    /** @param array<string,mixed> $input */
    public static function require(array $input, string $key, string $type = 'string'): mixed
    {
        if (!array_key_exists($key, $input) || $input[$key] === null || $input[$key] === '') {
            throw new HttpException(422, 'VALIDATION_ERROR', "Campo obrigatório: {$key}", [$key => 'required']);
        }
        return self::coerce($input[$key], $type, $key);
    }

    /** @param array<string,mixed> $input */
    public static function optional(array $input, string $key, string $type = 'string'): mixed
    {
        if (!array_key_exists($key, $input) || $input[$key] === null || $input[$key] === '') {
            return null;
        }
        return self::coerce($input[$key], $type, $key);
    }

    private static function coerce(mixed $v, string $type, string $key): mixed
    {
        return match ($type) {
            'string' => is_string($v) ? trim($v) : self::fail($key, 'string'),
            'int'    => is_int($v) || (is_string($v) && ctype_digit($v)) ? (int) $v : self::fail($key, 'int'),
            'bool'   => is_bool($v) ? $v : self::fail($key, 'bool'),
            'array'  => is_array($v) ? $v : self::fail($key, 'array'),
            'money'  => \SoulERP\Support\Money::toCents($v),
            default  => $v,
        };
    }

    private static function fail(string $key, string $type): never
    {
        throw new HttpException(422, 'VALIDATION_ERROR', "Campo {$key} deve ser {$type}.", [$key => "expected_{$type}"]);
    }
}
