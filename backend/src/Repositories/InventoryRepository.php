<?php
declare(strict_types=1);

namespace SoulERP\Repositories;

use PDO;
use PDOException;
use SoulERP\Database\Connection;
use SoulERP\Http\HttpException;

/**
 * Repositorio de estoque (saldos + kardex).
 *
 * Estilo conservador validado no servidor da Hostinger:
 *  - sem named arguments
 *  - sem trailing comma em parametros
 *  - sem arrow function
 *  - variaveis ASCII
 *  - PDO::PARAM_INT em todo id
 */
final class InventoryRepository
{
    /** Tipos que somam ao saldo. */
    private const POSITIVE = array('IN', 'RETURN');
    /** Tipos que subtraem do saldo. */
    private const NEGATIVE = array('OUT', 'LOSS');

    /**
     * Saldos por produto. Le direto de products (fonte do saldo atual).
     *
     * @return array<int,array<string,mixed>>
     */
    public function listBalances(string $companyId, ?string $query, bool $onlyBelowMinimum, int $page, int $pageSize): array
    {
        $page = $page < 1 ? 1 : $page;
        $pageSize = $pageSize < 1 ? 25 : ($pageSize > 200 ? 200 : $pageSize);
        $offset = ($page - 1) * $pageSize;

        $where = 'CAST(p.company_id AS CHAR) = :cid AND p.active = 1';
        $params = array(':cid' => $companyId);

        if ($query !== null && $query !== '') {
            $where .= ' AND (p.name LIKE :q OR p.sku LIKE :q)';
            $params[':q'] = '%' . $query . '%';
        }
        if ($onlyBelowMinimum) {
            $where .= ' AND p.stock <= p.minimum_stock';
        }

        $sql = 'SELECT p.id, p.sku, p.name, p.category, p.price, p.stock, p.minimum_stock, p.active,
                       (SELECT MAX(m.created_at) FROM inventory_movements m
                         WHERE m.product_id = p.id) AS last_movement_at
                  FROM products p
                 WHERE ' . $where . '
                 ORDER BY (p.stock <= p.minimum_stock) DESC, p.name ASC
                 LIMIT :lim OFFSET :off';

        $stmt = Connection::pdo()->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':lim', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Historico de movimentacoes da empresa, com nome do produto e do usuario.
     *
     * @return array<int,array<string,mixed>>
     */
    public function listMovements(string $companyId, ?int $productId, ?string $type, int $page, int $pageSize): array
    {
        $page = $page < 1 ? 1 : $page;
        $pageSize = $pageSize < 1 ? 50 : ($pageSize > 200 ? 200 : $pageSize);
        $offset = ($page - 1) * $pageSize;

        $where = 'CAST(m.company_id AS CHAR) = :cid';
        $params = array(':cid' => $companyId);

        if ($productId !== null && $productId > 0) {
            $where .= ' AND m.product_id = :pid';
        }
        if ($type !== null && $type !== '' && in_array($type, array('IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'LOSS'), true)) {
            $where .= ' AND m.type = :type';
            $params[':type'] = $type;
        }

        $sql = 'SELECT m.*,
                       p.name AS product_name,
                       p.sku  AS product_sku,
                       u.name AS user_name,
                       o.order_number AS order_number
                  FROM inventory_movements m
             LEFT JOIN products p ON p.id = m.product_id
             LEFT JOIN users u    ON u.id = m.created_by
             LEFT JOIN orders o   ON m.reference_type = \'order\' AND o.id = m.reference_id
                 WHERE ' . $where . '
                 ORDER BY m.id DESC
                 LIMIT :lim OFFSET :off';

        $stmt = Connection::pdo()->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        if ($productId !== null && $productId > 0) {
            $stmt->bindValue(':pid', $productId, PDO::PARAM_INT);
        }
        $stmt->bindValue(':lim', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Cria uma movimentacao e atualiza o saldo do produto, em transacao.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed> movimentacao criada
     */
    public function createMovement(string $companyId, string $userId, array $data): array
    {
        $productId = (int) $data['product_id'];
        $type = (string) $data['type'];
        $quantity = (int) $data['quantity'];
        $reason = (string) $data['reason'];
        $referenceType = isset($data['reference_type']) && $data['reference_type'] !== null ? (string) $data['reference_type'] : null;
        $referenceId = isset($data['reference_id']) && $data['reference_id'] !== null ? (int) $data['reference_id'] : null;

        if ($quantity < 0) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Quantidade nao pode ser negativa.');
        }
        if ($type !== 'ADJUSTMENT' && $quantity === 0) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Quantidade deve ser maior que zero.');
        }

        $pdo = Connection::pdo();

        try {
            $pdo->beginTransaction();

            $lock = $pdo->prepare(
                'SELECT id, name, stock, active FROM products
                  WHERE id = :pid AND CAST(company_id AS CHAR) = :cid
                  LIMIT 1 FOR UPDATE'
            );
            $lock->bindValue(':pid', $productId, PDO::PARAM_INT);
            $lock->bindValue(':cid', $companyId);
            $lock->execute();
            $product = $lock->fetch();

            if ($product === false) {
                $pdo->rollBack();
                throw new HttpException(404, 'NOT_FOUND', 'Produto nao encontrado nesta empresa.');
            }
            if ((int) $product['active'] !== 1) {
                $pdo->rollBack();
                throw new HttpException(422, 'PRODUCT_INACTIVE', 'Produto inativo nao aceita movimentacao.');
            }

            $before = (int) $product['stock'];
            $after = $before;

            if (in_array($type, self::POSITIVE, true)) {
                $after = $before + $quantity;
            } elseif (in_array($type, self::NEGATIVE, true)) {
                $after = $before - $quantity;
            } elseif ($type === 'ADJUSTMENT') {
                // Em ajuste, quantity representa o saldo final desejado.
                $after = $quantity;
            } else {
                $pdo->rollBack();
                throw new HttpException(422, 'VALIDATION_ERROR', 'Tipo de movimentacao invalido.');
            }

            if ($after < 0) {
                $pdo->rollBack();
                throw new HttpException(
                    422,
                    'INSUFFICIENT_STOCK',
                    'Saldo insuficiente. Disponivel: ' . $before . '.',
                    array('available' => $before, 'requested' => $quantity)
                );
            }

            $upd = $pdo->prepare('UPDATE products SET stock = :stock WHERE id = :pid');
            $upd->bindValue(':stock', $after, PDO::PARAM_INT);
            $upd->bindValue(':pid', $productId, PDO::PARAM_INT);
            $upd->execute();

            $ins = $pdo->prepare(
                'INSERT INTO inventory_movements
                    (company_id, product_id, type, quantity, stock_before, stock_after,
                     reason, reference_type, reference_id, created_by, created_at)
                 VALUES
                    (:company_id, :product_id, :type, :quantity, :stock_before, :stock_after,
                     :reason, :reference_type, :reference_id, :created_by, NOW())'
            );
            $ins->bindValue(':company_id', $companyId);
            $ins->bindValue(':product_id', $productId, PDO::PARAM_INT);
            $ins->bindValue(':type', $type);
            $ins->bindValue(':quantity', $quantity, PDO::PARAM_INT);
            $ins->bindValue(':stock_before', $before, PDO::PARAM_INT);
            $ins->bindValue(':stock_after', $after, PDO::PARAM_INT);
            $ins->bindValue(':reason', $reason);
            if ($referenceType === null) {
                $ins->bindValue(':reference_type', null, PDO::PARAM_NULL);
            } else {
                $ins->bindValue(':reference_type', $referenceType);
            }
            if ($referenceId === null) {
                $ins->bindValue(':reference_id', null, PDO::PARAM_NULL);
            } else {
                $ins->bindValue(':reference_id', $referenceId, PDO::PARAM_INT);
            }
            $ins->bindValue(':created_by', $userId);
            $ins->execute();

            $movementId = (int) $pdo->lastInsertId();

            $pdo->commit();

            return array(
                'id'             => $movementId,
                'company_id'     => $companyId,
                'product_id'     => $productId,
                'product_name'   => $product['name'],
                'type'           => $type,
                'quantity'       => $quantity,
                'stock_before'   => $before,
                'stock_after'    => $after,
                'reason'         => $reason,
                'reference_type' => $referenceType,
                'reference_id'   => $referenceId,
                'created_by'     => $userId,
                'created_at'     => date('Y-m-d H:i:s'),
            );
        } catch (HttpException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('[INVENTORY] Falha ao criar movimentacao: ' . $e->getMessage());
            throw new HttpException(500, 'INTERNAL_ERROR', 'Falha ao registrar movimentacao de estoque.');
        }
    }
}
