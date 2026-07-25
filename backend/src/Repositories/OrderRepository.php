<?php
declare(strict_types=1);

namespace SoulERP\Repositories;

use SoulERP\Database\Connection;


final class OrderRepository
{
    /**
     * Lista com filtro por vendedor quando o usuário não tem orders.view.all.
     * A regra vem do controller — o repo só aplica o filtro que receber.
     */
    public function listByCompany(
        string $companyId,
        ?string $onlySellerId,
        ?string $status,
        int $page = 1,
        int $pageSize = 25,
    ): array {
        $offset = max(0, ($page - 1) * $pageSize);
        $where = 'company_id = :cid';
        $params = [':cid' => $companyId];
        if ($onlySellerId !== null) {
            $where .= ' AND seller_id = :sid';
            $params[':sid'] = $onlySellerId;
        }
        if ($status !== null && $status !== '') {
            $where .= ' AND status = :st';
            $params[':st'] = $status;
        }
        $sql = "SELECT * FROM orders WHERE {$where} ORDER BY order_date DESC, created_at DESC LIMIT :lim OFFSET :off";
        $stmt = Connection::pdo()->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue(':lim', $pageSize, \PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function findById(string $companyId, string $id): ?array
    {
        $stmt = Connection::pdo()->prepare(
            'SELECT * FROM orders WHERE id = :id AND company_id = :cid LIMIT 1'
        );
        $stmt->execute([':id' => $id, ':cid' => $companyId]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /**
     * Cria order + items + installments + delivery em UMA transação.
     * Caller (controller) chama BEGIN e COMMIT/ROLLBACK.
     */
    public function insertOrderHeader(array $data): int
    {
        $stmt = Connection::pdo()->prepare(
            'INSERT INTO orders
             (order_number, company_id, customer_id, seller_id, status, sale_type,
              order_date, expected_delivery_date,
              subtotal, discount, freight, total,
              payment_condition, notes, created_at, updated_at)
             VALUES
             (:num, :cid, :cust, :sell, :status, :stype,
              :odate, :edate,
              :subtotal, :discount, :freight, :total,
              :pcond, :notes, NOW(), NOW())'
        );
        try {
            error_log('[ORDER FLOW] entrando insertOrderHeader');
            $stmt->execute([
                ':num' => $data['order_number'],
                ':cid' => $data['company_id'],
                ':cust' => $data['customer_id'],
                ':sell' => $data['seller_id'],
                ':status' => $data['status'],
                ':stype' => $data['sale_type'],
                ':odate' => $data['order_date'],
                ':edate' => $data['expected_delivery_date'] ?? null,
                ':subtotal' => $data['subtotal'],
                ':discount' => $data['discount'],
                ':freight' => $data['freight'],
                ':total' => $data['total'],
                ':pcond' => $data['payment_condition'] ?? null,
                ':notes' => $data['notes'] ?? null,
            ]);
            error_log('[ORDER FLOW] sucesso insertOrderHeader id=' . Connection::pdo()->lastInsertId());
        } catch (\PDOException $e) {
            error_log('[ORDER DEBUG ERROR] ' . $e->getMessage());
            throw $e;
        }
        return (int) Connection::pdo()->lastInsertId();
    }

    /**
     * Insere um item do pedido.
     *
     * Aceita payload mínimo do frontend ({product_id, quantity, unit_price, discount})
     * e completa snapshots + subtotal a partir da tabela products quando ausentes.
     * Cálculo: subtotal = (quantity * unit_price) - discount.
     */
    public function insertItem(string $orderId, array $item): void
    {
        $productId = (string) ($item['product_id'] ?? '');
        $quantity  = (int) ($item['quantity'] ?? 0);
        $unitPrice = (float) ($item['unit_price'] ?? 0);
        $discount  = (float) ($item['discount'] ?? 0);

        $nameSnap  = $item['product_name_snapshot'] ?? null;
        $skuSnap   = $item['sku_snapshot'] ?? null;
        $catSnap   = $item['category_snapshot'] ?? null;
        $stockSnap = array_key_exists('stock_at_order', $item) ? $item['stock_at_order'] : null;

        // Se algum snapshot essencial não veio, buscar do cadastro do produto.
        if ($nameSnap === null || $skuSnap === null || $catSnap === null || $stockSnap === null) {
            $ps = Connection::pdo()->prepare(
                'SELECT name, sku, category, stock, price FROM products WHERE id = :pid LIMIT 1'
            );
            $ps->execute([':pid' => $productId]);
            $prod = $ps->fetch();
            if ($prod !== false) {
                if ($nameSnap === null) $nameSnap = $prod['name'] ?? null;
                if ($skuSnap === null)  $skuSnap  = $prod['sku'] ?? null;
                if ($catSnap === null)  $catSnap  = $prod['category'] ?? null;
                if ($stockSnap === null) $stockSnap = $prod['stock'] ?? null;
                if ($unitPrice <= 0 && isset($prod['price'])) {
                    $unitPrice = (float) $prod['price'];
                }
            }
        }

        // Subtotal sempre recalculado no backend — nunca confiar no cliente.
        $subtotal = ($quantity * $unitPrice) - $discount;
        if ($subtotal < 0) $subtotal = 0;

        $stmt = Connection::pdo()->prepare(
            'INSERT INTO order_items
             (order_id, product_id, product_name_snapshot, sku_snapshot, category_snapshot,
              quantity, unit_price, discount, subtotal, stock_at_order)
             VALUES
             (:oid, :pid, :pname, :sku, :cat, :qty, :price, :disc, :sub, :stock)'
        );
        $stmt->bindValue(':oid', (int) $orderId, \PDO::PARAM_INT);
        $stmt->bindValue(':pid', $productId);
        $stmt->bindValue(':pname', $nameSnap !== null ? (string) $nameSnap : '');
        $stmt->bindValue(':sku', $skuSnap !== null ? (string) $skuSnap : null);
        $stmt->bindValue(':cat', $catSnap !== null ? (string) $catSnap : null);
        $stmt->bindValue(':qty', $quantity, \PDO::PARAM_INT);
        $stmt->bindValue(':price', number_format($unitPrice, 2, '.', ''));
        $stmt->bindValue(':disc', number_format($discount, 2, '.', ''));
        $stmt->bindValue(':sub', number_format($subtotal, 2, '.', ''));
        if ($stockSnap === null) {
            $stmt->bindValue(':stock', null, \PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':stock', (int) $stockSnap, \PDO::PARAM_INT);
        }
        error_log('[ORDER FLOW] entrando insertItem');
        $stmt->execute();
        error_log('[ORDER FLOW] sucesso insertItem');
    }

    public function insertInstallment(int $orderId, array $ip): void
    {
        $stmt = Connection::pdo()->prepare(
            'INSERT INTO order_installments
             (order_id, installment_number, due_date, amount, status, paid)
             VALUES (:oid, :num, :due, :amt, "pending", 0)'
        );
        $stmt->bindValue(':oid', $orderId, \PDO::PARAM_INT);
        $stmt->bindValue(':num', (int) $ip['installment_number'], \PDO::PARAM_INT);
        $stmt->bindValue(':due', $ip['due_date']);
        $stmt->bindValue(':amt', $ip['amount']);
        $stmt->execute();
    }

    public function insertDelivery(int $orderId, array $d): void
    {
        $stmt = Connection::pdo()->prepare(
            'INSERT INTO order_deliveries
             (order_id, type, address_snapshot, freight, scheduled_for, notes)
             VALUES (:oid, :type, :addr, :fr, :sched, :notes)'
        );
        $stmt->bindValue(':oid', $orderId, \PDO::PARAM_INT);
        $stmt->bindValue(':type', $d['type']);
        $stmt->bindValue(':addr', isset($d['address_snapshot']) ? json_encode($d['address_snapshot'], JSON_UNESCAPED_UNICODE) : null);
        $stmt->bindValue(':fr', $d['freight'] ?? 0);
        $stmt->bindValue(':sched', $d['scheduled_for'] ?? null);
        $stmt->bindValue(':notes', $d['notes'] ?? null);
        $stmt->execute();
    }

    public function updateStatus(string $companyId, string $orderId, string $status): void
    {
        $stmt = Connection::pdo()->prepare(
            'UPDATE orders SET status = :st, updated_at = NOW()
             WHERE id = :id AND company_id = :cid'
        );
        $stmt->execute([':st' => $status, ':id' => $orderId, ':cid' => $companyId]);
    }

    public function nextOrderNumber(string $companyId): string
    {
        $year = date('Y');
        $stmt = Connection::pdo()->prepare(
            "SELECT COUNT(*) AS c FROM orders
             WHERE company_id = :cid AND order_number LIKE :pfx"
        );
        $stmt->execute([':cid' => $companyId, ':pfx' => "PED-{$year}-%"]);
        $c = (int) ($stmt->fetch()['c'] ?? 0);
        return sprintf('PED-%s-%04d', $year, $c + 1);
    }
}
