<?php
/**
 * SoulERP — mapa de rotas da API v1.
 *
 * Toda rota que não seja /api/v1/health depende de Session::requireUser
 * (chamado dentro dos controllers), então autorização é aplicada em camada
 * única antes de qualquer acesso ao banco.
 */

declare(strict_types=1);

use SoulERP\Controllers\AuthController;
use SoulERP\Controllers\CustomerController;
use SoulERP\Controllers\HealthController;
use SoulERP\Controllers\OrderController;
use SoulERP\Controllers\ProductController;
use SoulERP\Http\Router;

return static function (Router $r): void {
    $prefix = '/api/v1';

    // Health check público.
    $r->get("{$prefix}/health", [HealthController::class, 'index']);

    // Auth
    $r->get("{$prefix}/auth/me", [AuthController::class, 'me']);

    // Customers
    $r->get("{$prefix}/customers",         [CustomerController::class, 'index']);
    $r->get("{$prefix}/customers/{id}",    [CustomerController::class, 'show']);
    $r->post("{$prefix}/customers",        [CustomerController::class, 'create']);
    $r->patch("{$prefix}/customers/{id}",  [CustomerController::class, 'update']);

    // Products
    $r->get("{$prefix}/products",          [ProductController::class, 'index']);
    $r->get("{$prefix}/products/{id}",     [ProductController::class, 'show']);

    // Orders
    $r->get("{$prefix}/orders",              [OrderController::class, 'index']);
    $r->get("{$prefix}/orders/{id}",         [OrderController::class, 'show']);
    $r->post("{$prefix}/orders",             [OrderController::class, 'create']);
    $r->patch("{$prefix}/orders/{id}",       [OrderController::class, 'update']);
    $r->post("{$prefix}/orders/{id}/cancel", [OrderController::class, 'cancel']);
};
