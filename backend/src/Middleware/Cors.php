<?php
declare(strict_types=1);

namespace SoulERP\Middleware;

use SoulERP\Config\AppConfig;
use SoulERP\Http\Request;

/**
 * CORS por allowlist. Nunca usa '*' quando cookies HttpOnly são o vetor
 * de autenticação — o navegador rejeitaria credenciais.
 *
 * Além das origens de config/config.php ('allowed_origins'), aceitamos
 * uma allowlist padrão com os domínios de preview/publicação do Lovable
 * e o dev server local. Isso evita que a API pare de responder CORS
 * quando o config do servidor ainda não foi atualizado manualmente.
 */
final class Cors
{
    /** @var string[] */
    private const DEFAULT_ORIGINS = [
        'https://id-preview--d864102f-80f4-4268-87ac-bda274124536.lovable.app',
        'https://mellow-mutual-mix.lovable.app',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
    ];

    public static function apply(Request $request): void
    {
        $origin = $request->header('origin');
        if ($origin === null || $origin === '') {
            return;
        }

        if (!self::isAllowed($origin)) {
            return; // silenciosamente sem CORS → navegador bloqueia
        }

        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Bootstrap-Token, Idempotency-Key');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
        header('Access-Control-Expose-Headers: X-CSRF-Token');
        header('Access-Control-Max-Age: 600');
    }

    private static function isAllowed(string $origin): bool
    {
        $configured = (array) AppConfig::get('allowed_origins', []);
        $allowed = array_values(array_unique(array_merge(
            self::DEFAULT_ORIGINS,
            array_filter(array_map(
                static function ($value): string {
                    return is_string($value) ? rtrim(trim($value), '/') : '';
                },
                $configured
            ))
        )));

        $normalized = rtrim($origin, '/');

        return in_array($normalized, $allowed, true);
    }
}
