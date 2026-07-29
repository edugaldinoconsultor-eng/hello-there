<?php
declare(strict_types=1);

namespace SoulERP\Controllers;

use SoulERP\Auth\Permissions;
use SoulERP\Auth\Session;
use SoulERP\Http\Request;
use SoulERP\Http\Response;
use SoulERP\Repositories\InventoryRepository;
use SoulERP\Services\AuditLogger;
use SoulERP\Validation\V;

/**
 * Estoque: saldos e kardex.
 *
 * Leitura  -> stock.view
 * Escrita  -> stock.adjust
 *
 * A empresa vem SEMPRE da sessao. O cliente nunca envia company_id.
 */
final class InventoryController
{
    public function balances(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'stock.view');

        $query = isset($request->query['query']) ? (string) $request->query['query'] : null;
        $below = isset($request->query['belowMinimum']) && ($request->query['belowMinimum'] === '1' || $request->query['belowMinimum'] === 'true');
        $page = isset($request->query['page']) ? (int) $request->query['page'] : 1;
        $pageSize = isset($request->query['pageSize']) ? (int) $request->query['pageSize'] : 100;

        $repo = new InventoryRepository();
        $rows = $repo->listBalances($user->companyId, $query, $below, $page, $pageSize);

        Response::json($rows, 200, array('count' => count($rows)));
    }

    public function movements(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'stock.view');

        $productId = isset($request->query['productId']) ? (int) $request->query['productId'] : null;
        $type = isset($request->query['type']) ? (string) $request->query['type'] : null;
        $page = isset($request->query['page']) ? (int) $request->query['page'] : 1;
        $pageSize = isset($request->query['pageSize']) ? (int) $request->query['pageSize'] : 50;

        $repo = new InventoryRepository();
        $rows = $repo->listMovements($user->companyId, $productId, $type, $page, $pageSize);

        Response::json($rows, 200, array('count' => count($rows)));
    }

    public function movementsByProduct(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'stock.view');

        $productId = (int) $request->params['id'];
        $page = isset($request->query['page']) ? (int) $request->query['page'] : 1;
        $pageSize = isset($request->query['pageSize']) ? (int) $request->query['pageSize'] : 50;

        $repo = new InventoryRepository();
        $rows = $repo->listMovements($user->companyId, $productId, null, $page, $pageSize);

        Response::json($rows, 200, array('count' => count($rows)));
    }

    public function createMovement(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'stock.adjust');

        $body = $request->body !== null ? $request->body : array();

        $data = array(
            'product_id'     => V::require($body, 'product_id', 'int'),
            'type'           => V::require($body, 'type'),
            'quantity'       => V::require($body, 'quantity', 'int'),
            'reason'         => V::require($body, 'reason'),
            'reference_type' => V::optional($body, 'reference_type'),
            'reference_id'   => V::optional($body, 'reference_id', 'int'),
        );

        $repo = new InventoryRepository();
        $movement = $repo->createMovement($user->companyId, $user->userId, $data);

        AuditLogger::log($user, 'STOCK_MOVEMENT_CREATED', 'inventory_movement', (string) $movement['id'], null, $data);

        Response::json($movement, 201);
    }
}
