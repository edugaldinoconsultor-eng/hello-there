<?php
declare(strict_types=1);

namespace SoulERP\Auth;

use SoulERP\Http\HttpException;
use SoulERP\Http\Request;

/**
 * Proteção CSRF pattern double-submit.
 *
 * Após login o servidor emite dois cookies: `soulerp_sid` (HttpOnly, usado
 * para autenticar) e `soulerp_csrf` (legível pelo JS). Toda mutação
 * (POST/PATCH/DELETE) precisa reenviar o valor do CSRF no header
 * `X-CSRF-Token`. Comparação é feita com hash_equals para evitar timing.
 *
 * Rotas isentas:
 *   - Métodos idempotentes (GET/HEAD/OPTIONS).
 *   - Login e bootstrap (o usuário ainda não tem cookie CSRF).
 */
final class CsrfGuard
{
    /** @var list<string> */
    private const EXEMPT_PATHS = [
        '/api/v1/auth/login',
        '/api/v1/auth/bootstrap',
    ];

    public static function enforce(Request $request): void
    {
        if (in_array($request->method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        if (in_array($request->path, self::EXEMPT_PATHS, true)) {
            return;
        }

        $cookie = SessionCookie::readCsrfCookie();
        $header = $request->header('x-csrf-token');

        if ($cookie === null || $header === null || !hash_equals($cookie, $header)) {
            throw new HttpException(403, 'FORBIDDEN', 'CSRF token inválido.');
        }
    }
}
