<?php
declare(strict_types=1);

namespace SoulERP\Controllers;

use SoulERP\Auth\Permissions;
use SoulERP\Auth\Session;
use SoulERP\Database\Connection;
use SoulERP\Http\HttpException;
use SoulERP\Http\Request;
use SoulERP\Http\Response;
use SoulERP\Repositories\CustomerRepository;
use SoulERP\Repositories\OrderRepository;
use SoulERP\Repositories\ProductRepository;
use SoulERP\Services\AuditLogger;
use SoulERP\Services\OrderPricing;
use SoulERP\Support\Money;
use SoulERP\Validation\V;

final class OrderController
{
    public function index(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'orders.view');

        // Vendedor sem orders.view.all só enxerga os próprios.
        $onlySeller = Permissions::has($user->role, 'orders.view.all') ? null : $user->userId;

        $repo = new OrderRepository();
        $rows = $repo->listByCompany(
            companyId: $user->companyId,
            onlySellerId: $onlySeller,
            status: $request->query['status'] ?? null,
            page: (int) ($request->query['page'] ?? 1),
            pageSize: min(200, (int) ($request->query['pageSize'] ?? 25)),
        );
        Response::json($rows, 200, ['count' => count($rows)]);
    }

    public function show(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'orders.view');
        $repo = new OrderRepository();
        $order = $repo->findById($user->companyId, $request->params['id']);
        if ($order === null) {
            throw new HttpException(404, 'NOT_FOUND', 'Pedido não encontrado.');
        }
        // Vendedor só vê os próprios.
        if (!Permissions::has($user->role, 'orders.view.all') && $order['seller_id'] !== $user->userId) {
            throw new HttpException(404, 'NOT_FOUND', 'Pedido não encontrado.');
        }
        Response::json($order);
    }

    public function create(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'orders.create');

        $body = $request->body ?? [];
        $customerId = V::require($body, 'customer_id');
        $items = V::require($body, 'items', 'array');
        if ($items === []) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Pedido precisa de ao menos 1 item.');
        }
        $installments = V::optional($body, 'installments', 'array') ?? [];
        $delivery = V::optional($body, 'delivery', 'array');
        $saleType = V::optional($body, 'sale_type') ?? 'balcao';
        $orderDate = V::optional($body, 'order_date') ?? date('Y-m-d');
        $expectedDelivery = V::optional($body, 'expected_delivery_date');
        $paymentCondition = V::optional($body, 'payment_condition');
        $notes = V::optional($body, 'notes');
        $discountInput = $body['discount'] ?? 0;
        $freightInput = $body['freight'] ?? 0;

        // Valida cliente da empresa.
        $customerRepo = new CustomerRepository();
        $customer = $customerRepo->findById($user->companyId, $customerId);
        if ($customer === null) {
            throw new HttpException(404, 'NOT_FOUND', 'Cliente não encontrado nesta empresa.');
        }

        // Carrega produtos e verifica que todos pertencem à empresa.
        $productIds = array_values(array_unique(array_map(
            static fn($i) => (string) ($i['product_id'] ?? ''),
            $items,
        )));
        $productRepo = new ProductRepository();
        $products = $productRepo->findManyById($user->companyId, $productIds);
        if (count($products) !== count($productIds)) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Um ou mais produtos não pertencem a esta empresa.');
        }
        $productsById = [];
        foreach ($products as $p) $productsById[$p['id']] = $p;

        // Normaliza itens com snapshot (nome/sku/categoria/estoque naquele instante).
        $normalizedItems = [];
        foreach ($items as $i => $item) {
            $pid = (string) ($item['product_id'] ?? '');
            $p = $productsById[$pid] ?? null;
            if ($p === null) {
                throw new HttpException(422, 'VALIDATION_ERROR', "Produto inválido no item {$i}.");
            }
            $qty = (int) ($item['quantity'] ?? 0);
            $unit = Money::toCents($item['unit_price'] ?? $p['price']);
            $disc = Money::toCents($item['discount'] ?? 0);
            $subtotal = $unit * $qty - $disc;
            $normalizedItems[] = [
                'product_id' => $pid,
                'product_name_snapshot' => $p['name'],
                'sku_snapshot' => $p['sku'] ?? null,
                'category_snapshot' => $p['category'] ?? null,
                'quantity' => $qty,
                'unit_price' => Money::fromCents($unit),
                'discount' => Money::fromCents($disc),
                'subtotal' => Money::fromCents($subtotal),
                'stock_at_order' => $p['stock'] ?? null,
            ];
        }

        // Recalcula totais no servidor. NUNCA usar o total enviado.
        $totals = OrderPricing::compute(
            array_map(static fn($it) => [
                'quantity' => $it['quantity'],
                'unit_price' => $it['unit_price'],
                'discount' => $it['discount'],
            ], $normalizedItems),
            $discountInput,
            $freightInput,
        );

        // Se cliente não mandou parcelas, cria 1 parcela à vista.
        if ($installments === []) {
            $installments = [[
                'due_date' => $orderDate,
                'amount' => Money::fromCents($totals['total_cents']),
            ]];
        }
        $normalizedInstallments = OrderPricing::normalizeInstallments($installments, $totals['total_cents']);

        // TRANSAÇÃO — tudo ou nada.
        $orderRepo = new OrderRepository();
        Connection::beginTransaction();
        try {
            $orderNumber = $orderRepo->nextOrderNumber($user->companyId);
            $orderId = $orderRepo->insertOrderHeader([
                'order_number' => $orderNumber,
                'company_id' => $user->companyId,
                'customer_id' => $customerId,
                'seller_id' => $user->userId, // vendedor = quem criou
                'status' => 'confirmed',
                'sale_type' => $saleType,
                'order_date' => $orderDate,
                'expected_delivery_date' => $expectedDelivery,
                'subtotal' => Money::fromCents($totals['subtotal_cents']),
                'discount' => Money::fromCents($totals['discount_cents']),
                'freight'  => Money::fromCents($totals['freight_cents']),
                'total'    => Money::fromCents($totals['total_cents']),
                'payment_condition' => $paymentCondition,
                'notes' => $notes,
            ]);

            foreach ($normalizedItems as $it) {
                $orderRepo->insertItem($orderId, $it);
            }
            foreach ($normalizedInstallments as $ip) {
                $orderRepo->insertInstallment($orderId, [
                    'installment_number' => $ip['installment_number'],
                    'due_date' => $ip['due_date'],
                    'amount' => Money::fromCents($ip['amount_cents']),
                ]);
            }
            if (is_array($delivery)) {
                $orderRepo->insertDelivery($orderId, [
                    'type' => $delivery['type'] ?? $saleType,
                    'address_snapshot' => $delivery['address_snapshot'] ?? null,
                    'freight' => Money::fromCents(Money::toCents($delivery['freight'] ?? 0)),
                    'scheduled_for' => $delivery['scheduled_for'] ?? null,
                    'notes' => $delivery['notes'] ?? null,
                ]);
            }

            AuditLogger::log($user, 'ORDER_CREATED', 'order', $orderId, null, [
                'order_number' => $orderNumber,
                'total' => Money::fromCents($totals['total_cents']),
            ]);
            Connection::commit();
        } catch (\Throwable $e) {
            Connection::rollBack();
            throw $e;
        }

        Response::json([
            'id' => $orderId,
            'order_number' => $orderNumber,
            'total' => Money::fromCents($totals['total_cents']),
        ], 201);
    }

    public function cancel(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'orders.cancel');
        $repo = new OrderRepository();
        $order = $repo->findById($user->companyId, $request->params['id']);
        if ($order === null) {
            throw new HttpException(404, 'NOT_FOUND', 'Pedido não encontrado.');
        }
        if ($order['status'] === 'cancelled') {
            throw new HttpException(409, 'CONFLICT', 'Pedido já está cancelado.');
        }
        $repo->updateStatus($user->companyId, $order['id'], 'cancelled');
        AuditLogger::log($user, 'ORDER_CANCELLED', 'order', $order['id'],
            ['status' => $order['status']],
            ['status' => 'cancelled'],
        );
        Response::json(['id' => $order['id'], 'status' => 'cancelled']);
    }

    public function update(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'orders.edit');
        throw new HttpException(501, 'INTERNAL_ERROR', 'Edição de pedido ainda não implementada.');
    }
}
