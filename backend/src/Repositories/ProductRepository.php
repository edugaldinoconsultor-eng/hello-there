<?php
declare(strict_types=1);

namespace SoulERP\Repositories;

use SoulERP\Database\Connection;

final class ProductRepository
{
    public function listByCompany(string $companyId, ?string $query, int $page = 1, int $pageSize = 25): array
    {
        $offset = max(0, ($page - 1) * $pageSize);
        $params = [':cid' => $companyId];
        $where = 'company_id = :cid AND active = 1';
        if ($query !== null && $query !== '') {
            $where .= ' AND (name LIKE :q OR sku LIKE :q)';
            $params[':q'] = '%' . $query . '%';
        }
        $sql = "SELECT * FROM products WHERE {$where} ORDER BY name ASC LIMIT :lim OFFSET :off";
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
            'SELECT * FROM products WHERE id = :id AND company_id = :cid LIMIT 1'
        );
        $stmt->execute([':id' => $id, ':cid' => $companyId]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /** @param string[] $ids */
    public function findManyById(string $companyId, array $ids): array
    {
        if ($ids === []) return [];
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $sql = "SELECT * FROM products WHERE company_id = ? AND id IN ({$ph})";
        $stmt = Connection::pdo()->prepare($sql);
        $stmt->execute([$companyId, ...$ids]);
        return $stmt->fetchAll();
    }
}
