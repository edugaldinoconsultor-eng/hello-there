<?php
declare(strict_types=1);

namespace SoulERP\Repositories;

use SoulERP\Database\Connection;

/**
 * Acesso a customers, sempre escopado por company_id.
 * NUNCA aceite company_id de fora — sempre venha da sessão autenticada.
 *
 * Colunas reais no MySQL da Hostinger:
 *   id (BIGINT UNSIGNED AUTO_INCREMENT), company_id, name, fantasy_name,
 *   document, phone, email,
 *   address_street, address_number, address_complement,
 *   address_neighborhood, address_city, address_state, address_zip_code,
 *   seller_id, price_table, credit_limit, payment_term, notes,
 *   active, created_at, updated_at
 *
 * NÃO existem no banco: person_type, address_cep, address_district.
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
        $pdo = Connection::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO customers
             (company_id, name, fantasy_name, document, phone, email,
              address_street, address_number, address_complement,
              address_neighborhood, address_city, address_state, address_zip_code,
              seller_id, price_table, credit_limit, payment_term, notes, active,
              created_at, updated_at)
             VALUES
             (:cid, :name, :fantasy, :doc, :phone, :email,
              :street, :number, :complement,
              :neighborhood, :city, :state, :zip,
              :seller, :ptable, :credit, :pterm, :notes, 1,
              NOW(), NOW())'
        );
        $stmt->execute([
            ':cid' => $companyId,
            ':name' => $data['name'],
            ':fantasy' => $data['fantasy_name'] ?? null,
            ':doc' => $data['document'] ?? null,
            ':phone' => $data['phone'],
            ':email' => $data['email'] ?? null,
            ':street' => $data['address_street'],
            ':number' => $data['address_number'] ?? null,
            ':complement' => $data['address_complement'] ?? null,
            ':neighborhood' => $data['address_neighborhood'] ?? null,
            ':city' => $data['address_city'] ?? null,
            ':state' => $data['address_state'] ?? null,
            ':zip' => $data['address_zip_code'] ?? null,
            ':seller' => $data['seller_id'] ?? null,
            ':ptable' => $data['price_table'] ?? null,
            ':credit' => $data['credit_limit'] ?? null,
            ':pterm' => $data['payment_term'] ?? null,
            ':notes' => $data['notes'] ?? null,
        ]);
        return (string) $pdo->lastInsertId();
    }
}
