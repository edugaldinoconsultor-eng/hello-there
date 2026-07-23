<?php
declare(strict_types=1);

namespace SoulERP\Controllers;

use SoulERP\Auth\Permissions;
use SoulERP\Auth\Session;
use SoulERP\Http\HttpException;
use SoulERP\Http\Request;
use SoulERP\Http\Response;
use SoulERP\Repositories\CustomerRepository;
use SoulERP\Services\AuditLogger;
use SoulERP\Validation\V;

final class CustomerController
{
    public function index(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'customers.view');
        $repo = new CustomerRepository();
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
        Permissions::require($user, 'customers.view');
        $repo = new CustomerRepository();
        $row = $repo->findById($user->companyId, $request->params['id']);
        if ($row === null) {
            throw new HttpException(404, 'NOT_FOUND', 'Cliente não encontrado.');
        }
        Response::json($row);
    }

    public function create(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'customers.create');
        $body = $request->body ?? [];

        // REGRA DEFINITIVA: obrigatórios = name, phone, address_street.
        $data = [
            'name'             => V::require($body, 'name'),
            'phone'            => V::require($body, 'phone'),
            'address_street'   => V::require($body, 'address_street'),
            'fantasy_name'     => V::optional($body, 'fantasy_name'),
            'person_type'      => V::optional($body, 'person_type'),
            'document'         => V::optional($body, 'document'),
            'email'            => V::optional($body, 'email'),
            'address_cep'      => V::optional($body, 'address_cep'),
            'address_number'   => V::optional($body, 'address_number'),
            'address_complement'=> V::optional($body, 'address_complement'),
            'address_district' => V::optional($body, 'address_district'),
            'address_city'     => V::optional($body, 'address_city'),
            'address_state'    => V::optional($body, 'address_state'),
            'seller_id'        => V::optional($body, 'seller_id'),
            'price_table'      => V::optional($body, 'price_table'),
            'credit_limit'     => V::optional($body, 'credit_limit', 'money'),
            'payment_term'     => V::optional($body, 'payment_term'),
            'notes'            => V::optional($body, 'notes'),
        ];

        $repo = new CustomerRepository();
        $id = $repo->create($user->companyId, $data);
        AuditLogger::log($user, 'CUSTOMER_CREATED', 'customer', $id, null, $data);
        Response::json(['id' => $id] + $data, 201);
    }

    public function update(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'customers.edit');
        // Deixado para próxima etapa quando definir campos editáveis por perfil.
        throw new HttpException(501, 'INTERNAL_ERROR', 'Edição de cliente ainda não implementada.');
    }
}
