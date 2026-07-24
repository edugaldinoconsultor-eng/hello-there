<?php
declare(strict_types=1);

namespace SoulERP\Auth;

use SoulERP\Config\AppConfig;

/**
 * Emissão e leitura dos cookies de sessão e CSRF.
 *
 * Regras:
 *   - Cookie de sessão SEMPRE HttpOnly + Secure em produção.
 *   - SameSite=Lax para permitir navegação normal do frontend cross-subdomínio.
 *   - Cookie de CSRF NÃO é HttpOnly (o JS precisa lê-lo p/ ecoar no header).
 *   - Nenhum outro lugar do backend deve chamar setcookie() para autenticação.
 */
final class SessionCookie
{
    public const CSRF_COOKIE = 'soulerp_csrf';

    public static function sessionName(): string
    {
        return (string) AppConfig::get('session.cookie_name', 'soulerp_sid');
    }

    public static function readSessionToken(): ?string
    {
        $name = self::sessionName();
        $v = $_COOKIE[$name] ?? null;
        return is_string($v) && $v !== '' ? $v : null;
    }

    public static function readCsrfCookie(): ?string
    {
        $v = $_COOKIE[self::CSRF_COOKIE] ?? null;
        return is_string($v) && $v !== '' ? $v : null;
    }

    public static function issue(string $rawToken, int $lifetimeSeconds, string $csrf): void
    {
        $secure = (bool) AppConfig::get('session.cookie_secure', true);
        $sameSite = (string) AppConfig::get('session.cookie_samesite', 'Lax');

        setcookie(self::sessionName(), $rawToken, [
            'expires'  => time() + $lifetimeSeconds,
            'path'     => '/',
            'secure'   => $secure,
            'httponly' => true,
            'samesite' => $sameSite,
        ]);

        // CSRF cookie: legível por JS (por design, pattern double-submit).
        setcookie(self::CSRF_COOKIE, $csrf, [
            'expires'  => time() + $lifetimeSeconds,
            'path'     => '/',
            'secure'   => $secure,
            'httponly' => false,
            'samesite' => $sameSite,
        ]);
    }

    public static function clear(): void
    {
        $secure = (bool) AppConfig::get('session.cookie_secure', true);
        $sameSite = (string) AppConfig::get('session.cookie_samesite', 'Lax');

        foreach ([self::sessionName(), self::CSRF_COOKIE] as $name) {
            setcookie($name, '', [
                'expires'  => time() - 3600,
                'path'     => '/',
                'secure'   => $secure,
                'httponly' => $name === self::sessionName(),
                'samesite' => $sameSite,
            ]);
        }
    }
}
