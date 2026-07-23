<?php
declare(strict_types=1);

namespace SoulERP\Auth;

/**
 * Wrapper explícito ao redor de password_hash/password_verify.
 * Nenhum outro lugar do backend deve chamar essas funções diretamente.
 */
final class PasswordHasher
{
    public static function hash(string $plain): string
    {
        return password_hash($plain, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function verify(string $plain, string $hash): bool
    {
        return password_verify($plain, $hash);
    }

    public static function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_BCRYPT, ['cost' => 12]);
    }
}
