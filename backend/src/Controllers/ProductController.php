<?php
declare(strict_types=1);

namespace SoulERP\Controllers;

use SoulERP\Auth\Permissions;
use SoulERP\Auth\Session;
use SoulERP\Http\HttpException;
use SoulERP\Http\Request;
use SoulERP\Http\Response;
use SoulERP\Repositories\ProductRepository;

final class ProductController
{
    public function index(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'products.view');
        $repo = new ProductRepository();
        $rows = $repo->listByCompany(
            companyId: $user->companyId,
            query: $request->query['query'] ?? null,
            page: (int) ($request->query['page'] ?? 1),
            pageSize: min(200, (int) ($request->query['pageSize'] ?? 25)),
        );
        Response::json($rows, 200, ['count' => count($rows)]);
    }

    public function show(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'products.view');
        $repo = new ProductRepository();
        $row = $repo->findById($user->companyId, $request->params['id']);
        if ($row === null) {
            throw new HttpException(404, 'NOT_FOUND', 'Produto não encontrado.');
        }
        Response::json($row);
    }
}
