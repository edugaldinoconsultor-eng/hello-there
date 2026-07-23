<?php
declare(strict_types=1);

namespace SoulERP\Http;

use SoulERP\Config\AppConfig;
use SoulERP\Middleware\Cors;
use Throwable;

/**
 * Ponto de entrada do request. Chamado pelo public/index.php.
 *
 * - Roda CORS antes de tudo (responde preflight OPTIONS na hora).
 * - Instancia o Router a partir de routes/api.php.
 * - Traduz qualquer exceção em resposta JSON no formato padrão.
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

            /** @var callable(Router):void $bind */
            $bind = require __DIR__ . '/../../routes/api.php';
            $router = new Router();
            $bind($router);

            $router->dispatch($request);
        } catch (HttpException $e) {
            Response::error($e->status, $e->errorCode, $e->getMessage(), $e->details);
        } catch (Throwable $e) {
            error_log('[SoulERP] Uncaught: ' . $e::class . ' ' . $e->getMessage());
            $message = AppConfig::isDev()
                ? $e->getMessage()
                : 'Erro interno. Tente novamente em instantes.';
            Response::error(500, 'INTERNAL_ERROR', $message);
        }
    }
}
