<?php
declare(strict_types=1);

namespace SoulERP\Http;

use SoulERP\Auth\CsrfGuard;
use SoulERP\Config\AppConfig;
use SoulERP\Middleware\Cors;
use Throwable;

/**
 * Ponto de entrada do request.
 *
 * Ordem:
 *   1. CORS (responde OPTIONS 204 sem tocar em nada mais).
 *   2. CSRF em mutações (POST/PATCH/DELETE), exceto rotas isentas.
 *   3. Dispatch para o Router. Controllers chamam Session::requireUser.
 *   4. Exceções são serializadas no formato padrão de erro.
 */
final class Kernel
{
    public static function handle(): void
    {
        try {
            $request = Request::fromGlobals();

            Cors::apply($request);
            if ($request->method === 'OPTIONS') {
                Response::noContent();
                return;
            }

            CsrfGuard::enforce($request);

            /** @var callable(Router):void $bind */
            $bind = require __DIR__ . '/../../routes/api.php';
            $router = new Router();
            $bind($router);

            $router->dispatch($request);
        } catch (HttpException $e) {
            Response::error($e->status, $e->errorCode, $e->getMessage(), $e->details);
        } catch (Throwable $e) {
            error_log('[SoulERP] Uncaught: ' . $e::class . ' ' . $e->getMessage());
            // DIAGNÓSTICO TEMPORÁRIO — remover antes de produção final.
            Response::error(500, 'INTERNAL_ERROR', $e::class . ': ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => explode("\n", $e->getTraceAsString()),
            ]);
        }
    }
}
