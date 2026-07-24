<?php
declare(strict_types=1);

namespace SoulERP\Auth;

/**
 * Geração e hashing de tokens de sessão.
 *
 * O token BRUTO só existe em RAM na hora do login (é enviado ao navegador
 * como cookie HttpOnly). O banco guarda apenas o hash SHA-256 hex.
 */
final class TokenGenerator
{
    /** 32 bytes aleatórios em base64url = 43 chars, ~256 bits de entropia. */
    public static function raw(): string
    {
        $bytes = random_bytes(32);
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    /** Hash determinístico usado como índice único em auth_sessions.token_hash. */
    public static function hash(string $raw): string
    {
        return hash('sha256', $raw);
    }

    /** Token opaco para CSRF (não precisa ser hasheado — vai também no cookie). */
    public static function csrf(): string
    {
        return self::raw();
    }
}
