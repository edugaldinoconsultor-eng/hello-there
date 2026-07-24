<?php
/**
 * SoulERP — mapa de rotas da API v1.
 *
 * Autorização vive nos controllers via Session::requireUser.
 * CSRF é aplicado no Kernel para POST/PATCH/DELETE, exceto login/bootstrap.
 */

declare(strict_types=1);

use SoulERP\Controllers\AuthController;
use SoulERP\Controllers\BootstrapController;
use SoulERP\Controllers\CustomerController;
use SoulERP\Controllers\HealthController;
use SoulERP\Controllers\OrderController;
use SoulERP\Controllers\ProductController;
use SoulERP\Http\Router;

return static function (Router $r): void {
    $prefix = '/api/v1';

    // Público
    $r->get("{$prefix}/health", [HealthController::class, 'index']);

    // Auth — cookie HttpOnly + CSRF double-submit
    $r->post("{$prefix}/auth/login",           [AuthController::class, 'login']);
    $r->get ("{$prefix}/auth/me",              [AuthController::class, 'me']);
    $r->post("{$prefix}/auth/logout",          [AuthController::class, 'logout']);
    $r->post("{$prefix}/auth/switch-company",  [AuthController::class, 'switchCompany']);

    // Bootstrap único (só responde se `bootstrap_token` estiver configurado)
    $r->post("{$prefix}/auth/bootstrap",       [BootstrapController::class, 'run']);

    // Customers
    $r->get  ("{$prefix}/customers",        [CustomerController::class, 'index']);
    $r->get  ("{$prefix}/customers/{id}",   [CustomerController::class, 'show']);
    $r->post ("{$prefix}/customers",        [CustomerController::class, 'create']);
    $r->patch("{$prefix}/customers/{id}",   [CustomerController::class, 'update']);

    // Products
    $r->get("{$prefix}/products",       [ProductController::class, 'index']);
    $r->get("{$prefix}/products/{id}",  [ProductController::class, 'show']);

    // Orders
    $r->get  ("{$prefix}/orders",              [OrderController::class, 'index']);
    $r->get  ("{$prefix}/orders/{id}",         [OrderController::class, 'show']);
    $r->post ("{$prefix}/orders",              [OrderController::class, 'create']);
    $r->patch("{$prefix}/orders/{id}",         [OrderController::class, 'update']);
    $r->post ("{$prefix}/orders/{id}/cancel",  [OrderController::class, 'cancel']);
};
