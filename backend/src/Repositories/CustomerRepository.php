<?php
declare(strict_types=1);

namespace SoulERP\Repositories;

use SoulERP\Database\Connection;
use SoulERP\Support\Uuid;

/**
 * Acesso a customers, sempre escopado por company_id.
 * NUNCA aceite company_id de fora — sempre venha da sessão autenticada.
 */
final class CustomerRepository
{
    public function listByCompany(string $companyId, ?string $query, int $page = 1, int $pageSize = 25): array
    {
        $offset = max(0, ($page - 1) * $pageSize);
        $params = [':cid' => $companyId];
        $where = 'company_id = :cid AND active = 1';
        if ($query !== null && $query !== '') {
            $where .= ' AND (name LIKE :q OR document LIKE :q OR phone LIKE :q)';
            $params[':q'] = '%' . $query . '%';
        }
        $sql = "SELECT * FROM customers WHERE {$where} ORDER BY name ASC LIMIT :lim OFFSET :off";
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
            'SELECT * FROM customers WHERE id = :id AND company_id = :cid LIMIT 1'
        );
        $stmt->execute([':id' => $id, ':cid' => $companyId]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /** @param array<string,mixed> $data */
    public function create(string $companyId, array $data): string
    {
        $id = Uuid::v4();
        $stmt = Connection::pdo()->prepare(
            'INSERT INTO customers
             (id, company_id, name, fantasy_name, person_type, document, phone, email,
              address_cep, address_street, address_number, address_complement,
              address_district, address_city, address_state,
              seller_id, price_table, credit_limit, payment_term, notes, active,
              created_at, updated_at)
             VALUES
             (:id, :cid, :name, :fantasy, :ptype, :doc, :phone, :email,
              :cep, :street, :number, :complement,
              :district, :city, :state,
              :seller, :ptable, :credit, :pterm, :notes, 1,
              NOW(), NOW())'
        );
        $stmt->execute([
            ':id' => $id,
            ':cid' => $companyId,
            ':name' => $data['name'],
            ':fantasy' => $data['fantasy_name'] ?? null,
            ':ptype' => $data['person_type'] ?? null,
            ':doc' => $data['document'] ?? null,
            ':phone' => $data['phone'],
            ':email' => $data['email'] ?? null,
            ':cep' => $data['address_cep'] ?? null,
            ':street' => $data['address_street'],
            ':number' => $data['address_number'] ?? null,
            ':complement' => $data['address_complement'] ?? null,
            ':district' => $data['address_district'] ?? null,
            ':city' => $data['address_city'] ?? null,
            ':state' => $data['address_state'] ?? null,
            ':seller' => $data['seller_id'] ?? null,
            ':ptable' => $data['price_table'] ?? null,
            ':credit' => $data['credit_limit'] ?? null,
            ':pterm' => $data['payment_term'] ?? null,
            ':notes' => $data['notes'] ?? null,
        ]);
        return $id;
    }
}
