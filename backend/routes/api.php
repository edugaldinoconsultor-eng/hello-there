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
use SoulERP\Controllers\FinancialController;
use SoulERP\Controllers\HealthController;
use SoulERP\Controllers\InventoryController;
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

    // Inventory (Estoque) — leitura: stock.view | escrita: stock.adjust
    $r->get ("{$prefix}/inventory/balances",                 [InventoryController::class, 'balances']);
    $r->get ("{$prefix}/inventory/movements",                [InventoryController::class, 'movements']);
    $r->get ("{$prefix}/inventory/products/{id}/movements",  [InventoryController::class, 'movementsByProduct']);
    $r->post("{$prefix}/inventory/movements",                [InventoryController::class, 'createMovement']);

    // Financeiro — leitura: finance.view | escrita: finance.manage
    $r->get ("{$prefix}/financial/summary",                   [FinancialController::class, 'summary']);
    $r->get ("{$prefix}/financial/receivables",               [FinancialController::class, 'receivables']);
    $r->get ("{$prefix}/financial/receivables/{id}",          [FinancialController::class, 'showReceivable']);
    $r->post("{$prefix}/financial/receivables",               [FinancialController::class, 'createReceivable']);
    $r->post("{$prefix}/financial/receivables/{id}/payments", [FinancialController::class, 'payReceivable']);
    $r->get ("{$prefix}/financial/payables",                  [FinancialController::class, 'payables']);
    $r->get ("{$prefix}/financial/payables/{id}",             [FinancialController::class, 'showPayable']);
    $r->post("{$prefix}/financial/payables",                  [FinancialController::class, 'createPayable']);
    $r->post("{$prefix}/financial/payables/{id}/payments",    [FinancialController::class, 'payPayable']);
    $r->get ("{$prefix}/financial/payments",                  [FinancialController::class, 'payments']);
    $r->post("{$prefix}/financial/payments",                  [FinancialController::class, 'createPayment']);
};
