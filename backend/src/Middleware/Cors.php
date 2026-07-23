<?php
declare(strict_types=1);

namespace SoulERP\Middleware;

use SoulERP\Config\AppConfig;
use SoulERP\Http\Request;

/**
 * CORS por allowlist. Nunca usa '*' quando cookies HttpOnly são o vetor
 * de autenticação — o navegador rejeitaria credenciais.
 */
final class Cors
{
    public static function apply(Request $request): void
    {
        $origin = $request->header('origin');
        if ($origin === null) {
            return;
        }
        $allowed = (array) AppConfig::get('allowed_origins', []);
        if (!in_array($origin, $allowed, true)) {
            return; // silenciosamente sem CORS → navegador bloqueia
        }
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, Idempotency-Key');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
        header('Access-Control-Max-Age: 600');
    }
}
