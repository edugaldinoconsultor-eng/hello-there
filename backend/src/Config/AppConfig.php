<?php
declare(strict_types=1);

namespace SoulERP\Config;

/**
 * Config leve. Sem mágica. Só leitura.
 */
final class AppConfig
{
    /** @var array<string,mixed> */
    private static array $data = [];
    private static string $env = 'production';

    /** @param array<string,mixed> $data */
    public static function set(array $data): void
    {
        self::$data = $data;
    }

    public static function setEnv(string $env): void
    {
        self::$env = $env;
    }

    public static function env(): string
    {
        return self::$env;
    }

    public static function isDev(): bool
    {
        return self::$env === 'dev';
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        // suporte a notação "db.host"
        $parts = explode('.', $key);
        $ref = self::$data;
        foreach ($parts as $part) {
            if (!is_array($ref) || !array_key_exists($part, $ref)) {
                return $default;
            }
            $ref = $ref[$part];
        }
        return $ref;
    }
}
