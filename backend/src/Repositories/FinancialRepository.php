<?php
declare(strict_types=1);

namespace SoulERP\Repositories;

use PDO;
use SoulERP\Database\Connection;
use SoulERP\Http\HttpException;

/**
 * Repositorio do modulo Financeiro (etapa 1).
 *
 * Tabelas reais (migration 006_financial.sql):
 *
 *  accounts_receivable
 *    id, company_id, customer_id, order_id, installment_id, parent_id,
 *    description, issue_date, due_date, amount, amount_paid,
 *    status ENUM('open','partial','paid','renegotiated','cancelled'),
 *    notes, created_by, created_at, updated_at
 *
 *  accounts_payable
 *    id, company_id, supplier_name, category, description,
 *    issue_date, due_date, amount, amount_paid,
 *    status ENUM('open','partial','paid','cancelled'),
 *    notes, created_by, created_at, updated_at
 *
 *  financial_payments  (append-only; estorno = amount negativo)
 *    id, company_id, entry_type ENUM('receivable','payable'), entry_id,
 *    method ENUM('pix','dinheiro','boleto','cartao','transferencia','outro'),
 *    amount, paid_at, notes, created_by, created_at
 *
 * Regras:
 *  - company_id vem SEMPRE da sessao (nunca do payload).
 *  - Sem FK fisica: o vinculo e validado aqui.
 *  - Baixa recalcula amount_paid/status na MESMA transacao, com FOR UPDATE.
 *  - Pagamento nunca e editado nem apagado.
 *  - `overdue` e derivado na consulta, nao persistido.
 *
 * Estilo conservador validado na Hostinger (PHP 8.3):
 *  - sem named arguments
 *  - sem arrow function
 *  - sem trailing comma em parametros
 *  - variaveis ASCII
 *  - PDO::PARAM_INT em todo id
 */
final class FinancialRepository
{
    private const ENTRY_TYPES = array('receivable', 'payable');

    private const METHODS = array('pix', 'dinheiro', 'boleto', 'cartao', 'transferencia', 'outro');

    private const AR_STATUSES = array('open', 'partial', 'paid', 'renegotiated', 'cancelled');

    private const AP_STATUSES = array('open', 'partial', 'paid', 'cancelled');

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private function table(string $entryType): string
    {
        if ($entryType === 'receivable') {
            return 'accounts_receivable';
        }
        if ($entryType === 'payable') {
            return 'accounts_payable';
        }
        throw new HttpException(422, 'VALIDATION_ERROR', 'entry_type invalido.');
    }

    private function money(mixed $value): float
    {
        if (is_string($value)) {
            $value = str_replace(array('R$', ' '), '', $value);
            if (strpos($value, ',') !== false) {
                $value = str_replace('.', '', $value);
                $value = str_replace(',', '.', $value);
            }
        }
        if (!is_numeric($value)) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Valor monetario invalido.');
        }
        return round((float) $value, 2);
    }

    private function date(mixed $value, string $field): string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Campo obrigatorio: ' . $field);
        }
        if (strlen($raw) > 10) {
            $raw = substr($raw, 0, 10);
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw) !== 1) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Data invalida em ' . $field . ' (use YYYY-MM-DD).');
        }
        return $raw;
    }

    private function datetime(mixed $value): string
    {
        if ($value === null || $value === '') {
            return date('Y-m-d H:i:s');
        }
        $raw = trim((string) $value);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw) === 1) {
            return $raw . ' 00:00:00';
        }
        $raw = str_replace('T', ' ', $raw);
        if (strlen($raw) > 19) {
            $raw = substr($raw, 0, 19);
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $raw) !== 1) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'paid_at invalido.');
        }
        if (strlen($raw) === 16) {
            $raw .= ':00';
        }
        return $raw;
    }

    /**
     * Normaliza um titulo para saida da API.
     *
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    private function decorate(array $row, string $entryType): array
    {
        $amount = (float) $row['amount'];
        $paid = (float) $row['amount_paid'];
        $balance = round($amount - $paid, 2);

        $row['entry_type'] = $entryType;
        $row['amount'] = number_format($amount, 2, '.', '');
        $row['amount_paid'] = number_format($paid, 2, '.', '');
        $row['balance'] = number_format($balance, 2, '.', '');

        $open = ($row['status'] === 'open' || $row['status'] === 'partial');
        $row['is_overdue'] = ($open && $balance > 0 && (string) $row['due_date'] < date('Y-m-d'));
        $row['display_status'] = $row['is_overdue'] ? 'overdue' : (string) $row['status'];

        return $row;
    }

    // -----------------------------------------------------------------
    // Contas a receber
    // -----------------------------------------------------------------

    /**
     * @return array<int,array<string,mixed>>
     */
    public function listReceivables(string $companyId, ?string $status, ?int $customerId, ?string $from, ?string $to, ?string $query, int $page, int $pageSize): array
    {
        $page = $page < 1 ? 1 : $page;
        $pageSize = $pageSize < 1 ? 50 : ($pageSize > 200 ? 200 : $pageSize);
        $offset = ($page - 1) * $pageSize;

        $where = 'CAST(ar.company_id AS CHAR) = :cid';
        $params = array(':cid' => $companyId);

        if ($status !== null && $status !== '' && $status !== 'all') {
            if ($status === 'overdue') {
                $where .= " AND ar.status IN ('open','partial') AND ar.due_date < CURDATE()";
            } elseif (in_array($status, self::AR_STATUSES, true)) {
                $where .= ' AND ar.status = :status';
                $params[':status'] = $status;
            }
        }
        if ($from !== null && $from !== '') {
            $where .= ' AND ar.due_date >= :from';
            $params[':from'] = $this->date($from, 'from');
        }
        if ($to !== null && $to !== '') {
            $where .= ' AND ar.due_date <= :to';
            $params[':to'] = $this->date($to, 'to');
        }
        if ($query !== null && $query !== '') {
            $where .= ' AND (ar.description LIKE :q OR c.name LIKE :q)';
            $params[':q'] = '%' . $query . '%';
        }
        if ($customerId !== null && $customerId > 0) {
            $where .= ' AND ar.customer_id = :customer_id';
        }

        $sql = 'SELECT ar.*,
                       c.name AS customer_name,
                       o.order_number AS order_number,
                       u.name AS created_by_name
                  FROM accounts_receivable ar
             LEFT JOIN customers c ON c.id = ar.customer_id
             LEFT JOIN orders o    ON o.id = ar.order_id
             LEFT JOIN users u     ON u.id = ar.created_by
                 WHERE ' . $where . '
                 ORDER BY ar.due_date ASC, ar.id ASC
                 LIMIT :lim OFFSET :off';

        $stmt = Connection::pdo()->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        if ($customerId !== null && $customerId > 0) {
            $stmt->bindValue(':customer_id', $customerId, PDO::PARAM_INT);
        }
        $stmt->bindValue(':lim', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll();
        $out = array();
        foreach ($rows as $row) {
            $out[] = $this->decorate($row, 'receivable');
        }
        return $out;
    }

    /**
     * @return array<string,mixed>
     */
    public function findReceivable(string $companyId, int $id): array
    {
        $sql = 'SELECT ar.*,
                       c.name AS customer_name,
                       o.order_number AS order_number,
                       u.name AS created_by_name
                  FROM accounts_receivable ar
             LEFT JOIN customers c ON c.id = ar.customer_id
             LEFT JOIN orders o    ON o.id = ar.order_id
             LEFT JOIN users u     ON u.id = ar.created_by
                 WHERE ar.id = :id AND CAST(ar.company_id AS CHAR) = :cid
                 LIMIT 1';

        $stmt = Connection::pdo()->prepare($sql);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':cid', $companyId);
        $stmt->execute();

        $row = $stmt->fetch();
        if ($row === false) {
            throw new HttpException(404, 'NOT_FOUND', 'Titulo a receber nao encontrado.');
        }

        $entry = $this->decorate($row, 'receivable');
        $entry['payments'] = $this->listPayments($companyId, 'receivable', $id);

        return $entry;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function createReceivable(string $companyId, string $userId, array $data): array
    {
        $customerId = (int) $data['customer_id'];
        $description = trim((string) $data['description']);
        $amount = $this->money($data['amount']);
        $dueDate = $this->date($data['due_date'], 'due_date');
        $issueDate = isset($data['issue_date']) && $data['issue_date'] !== null && $data['issue_date'] !== ''
            ? $this->date($data['issue_date'], 'issue_date')
            : date('Y-m-d');

        $orderId = isset($data['order_id']) && $data['order_id'] !== null ? (int) $data['order_id'] : null;
        $installmentId = isset($data['installment_id']) && $data['installment_id'] !== null ? (int) $data['installment_id'] : null;
        $parentId = isset($data['parent_id']) && $data['parent_id'] !== null ? (int) $data['parent_id'] : null;
        $notes = isset($data['notes']) && $data['notes'] !== null && $data['notes'] !== '' ? (string) $data['notes'] : null;

        if ($description === '') {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Descricao obrigatoria.');
        }
        if ($amount <= 0) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Valor deve ser maior que zero.');
        }

        $pdo = Connection::pdo();

        // Sem FK fisica: valida o vinculo aqui.
        $chk = $pdo->prepare('SELECT id FROM customers WHERE id = :id AND CAST(company_id AS CHAR) = :cid LIMIT 1');
        $chk->bindValue(':id', $customerId, PDO::PARAM_INT);
        $chk->bindValue(':cid', $companyId);
        $chk->execute();
        if ($chk->fetch() === false) {
            throw new HttpException(404, 'NOT_FOUND', 'Cliente nao encontrado nesta empresa.');
        }

        if ($orderId !== null && $orderId > 0) {
            $chkOrder = $pdo->prepare('SELECT id FROM orders WHERE id = :id AND CAST(company_id AS CHAR) = :cid LIMIT 1');
            $chkOrder->bindValue(':id', $orderId, PDO::PARAM_INT);
            $chkOrder->bindValue(':cid', $companyId);
            $chkOrder->execute();
            if ($chkOrder->fetch() === false) {
                throw new HttpException(404, 'NOT_FOUND', 'Pedido nao encontrado nesta empresa.');
            }
        } else {
            $orderId = null;
        }

        $sql = 'INSERT INTO accounts_receivable
                    (company_id, customer_id, order_id, installment_id, parent_id,
                     description, issue_date, due_date, amount, amount_paid,
                     status, notes, created_by, created_at, updated_at)
                VALUES
                    (:company_id, :customer_id, :order_id, :installment_id, :parent_id,
                     :description, :issue_date, :due_date, :amount, 0.00,
                     :status, :notes, :created_by, NOW(), NOW())';

        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':company_id', $companyId);
        $stmt->bindValue(':customer_id', $customerId, PDO::PARAM_INT);
        if ($orderId === null) {
            $stmt->bindValue(':order_id', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':order_id', $orderId, PDO::PARAM_INT);
        }
        if ($installmentId === null || $installmentId <= 0) {
            $stmt->bindValue(':installment_id', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':installment_id', $installmentId, PDO::PARAM_INT);
        }
        if ($parentId === null || $parentId <= 0) {
            $stmt->bindValue(':parent_id', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':parent_id', $parentId, PDO::PARAM_INT);
        }
        $stmt->bindValue(':description', $description);
        $stmt->bindValue(':issue_date', $issueDate);
        $stmt->bindValue(':due_date', $dueDate);
        $stmt->bindValue(':amount', number_format($amount, 2, '.', ''));
        $stmt->bindValue(':status', 'open');
        if ($notes === null) {
            $stmt->bindValue(':notes', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':notes', $notes);
        }
        $stmt->bindValue(':created_by', $userId);
        $stmt->execute();

        $id = (int) $pdo->lastInsertId();

        return $this->findReceivable($companyId, $id);
    }

    // -----------------------------------------------------------------
    // Contas a pagar
    // -----------------------------------------------------------------

    /**
     * @return array<int,array<string,mixed>>
     */
    public function listPayables(string $companyId, ?string $status, ?string $category, ?string $from, ?string $to, ?string $query, int $page, int $pageSize): array
    {
        $page = $page < 1 ? 1 : $page;
        $pageSize = $pageSize < 1 ? 50 : ($pageSize > 200 ? 200 : $pageSize);
        $offset = ($page - 1) * $pageSize;

        $where = 'CAST(ap.company_id AS CHAR) = :cid';
        $params = array(':cid' => $companyId);

        if ($status !== null && $status !== '' && $status !== 'all') {
            if ($status === 'overdue') {
                $where .= " AND ap.status IN ('open','partial') AND ap.due_date < CURDATE()";
            } elseif (in_array($status, self::AP_STATUSES, true)) {
                $where .= ' AND ap.status = :status';
                $params[':status'] = $status;
            }
        }
        if ($category !== null && $category !== '') {
            $where .= ' AND ap.category = :category';
            $params[':category'] = $category;
        }
        if ($from !== null && $from !== '') {
            $where .= ' AND ap.due_date >= :from';
            $params[':from'] = $this->date($from, 'from');
        }
        if ($to !== null && $to !== '') {
            $where .= ' AND ap.due_date <= :to';
            $params[':to'] = $this->date($to, 'to');
        }
        if ($query !== null && $query !== '') {
            $where .= ' AND (ap.description LIKE :q OR ap.supplier_name LIKE :q)';
            $params[':q'] = '%' . $query . '%';
        }

        $sql = 'SELECT ap.*, u.name AS created_by_name
                  FROM accounts_payable ap
             LEFT JOIN users u ON u.id = ap.created_by
                 WHERE ' . $where . '
                 ORDER BY ap.due_date ASC, ap.id ASC
                 LIMIT :lim OFFSET :off';

        $stmt = Connection::pdo()->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':lim', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll();
        $out = array();
        foreach ($rows as $row) {
            $out[] = $this->decorate($row, 'payable');
        }
        return $out;
    }

    /**
     * @return array<string,mixed>
     */
    public function findPayable(string $companyId, int $id): array
    {
        $sql = 'SELECT ap.*, u.name AS created_by_name
                  FROM accounts_payable ap
             LEFT JOIN users u ON u.id = ap.created_by
                 WHERE ap.id = :id AND CAST(ap.company_id AS CHAR) = :cid
                 LIMIT 1';

        $stmt = Connection::pdo()->prepare($sql);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':cid', $companyId);
        $stmt->execute();

        $row = $stmt->fetch();
        if ($row === false) {
            throw new HttpException(404, 'NOT_FOUND', 'Titulo a pagar nao encontrado.');
        }

        $entry = $this->decorate($row, 'payable');
        $entry['payments'] = $this->listPayments($companyId, 'payable', $id);

        return $entry;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function createPayable(string $companyId, string $userId, array $data): array
    {
        $supplier = trim((string) $data['supplier_name']);
        $description = trim((string) $data['description']);
        $amount = $this->money($data['amount']);
        $dueDate = $this->date($data['due_date'], 'due_date');
        $issueDate = isset($data['issue_date']) && $data['issue_date'] !== null && $data['issue_date'] !== ''
            ? $this->date($data['issue_date'], 'issue_date')
            : date('Y-m-d');
        $category = isset($data['category']) && $data['category'] !== null && $data['category'] !== '' ? (string) $data['category'] : null;
        $notes = isset($data['notes']) && $data['notes'] !== null && $data['notes'] !== '' ? (string) $data['notes'] : null;

        if ($supplier === '') {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Fornecedor obrigatorio.');
        }
        if ($description === '') {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Descricao obrigatoria.');
        }
        if ($amount <= 0) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Valor deve ser maior que zero.');
        }

        $pdo = Connection::pdo();

        $sql = 'INSERT INTO accounts_payable
                    (company_id, supplier_name, category, description,
                     issue_date, due_date, amount, amount_paid,
                     status, notes, created_by, created_at, updated_at)
                VALUES
                    (:company_id, :supplier_name, :category, :description,
                     :issue_date, :due_date, :amount, 0.00,
                     :status, :notes, :created_by, NOW(), NOW())';

        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':company_id', $companyId);
        $stmt->bindValue(':supplier_name', $supplier);
        if ($category === null) {
            $stmt->bindValue(':category', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':category', $category);
        }
        $stmt->bindValue(':description', $description);
        $stmt->bindValue(':issue_date', $issueDate);
        $stmt->bindValue(':due_date', $dueDate);
        $stmt->bindValue(':amount', number_format($amount, 2, '.', ''));
        $stmt->bindValue(':status', 'open');
        if ($notes === null) {
            $stmt->bindValue(':notes', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':notes', $notes);
        }
        $stmt->bindValue(':created_by', $userId);
        $stmt->execute();

        $id = (int) $pdo->lastInsertId();

        return $this->findPayable($companyId, $id);
    }

    // -----------------------------------------------------------------
    // Pagamentos / baixas (append-only)
    // -----------------------------------------------------------------

    /**
     * @return array<int,array<string,mixed>>
     */
    public function listPayments(string $companyId, string $entryType, int $entryId): array
    {
        if (!in_array($entryType, self::ENTRY_TYPES, true)) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'entry_type invalido.');
        }

        $sql = 'SELECT fp.*, u.name AS created_by_name
                  FROM financial_payments fp
             LEFT JOIN users u ON u.id = fp.created_by
                 WHERE CAST(fp.company_id AS CHAR) = :cid
                   AND fp.entry_type = :etype
                   AND fp.entry_id = :eid
                 ORDER BY fp.id ASC';

        $stmt = Connection::pdo()->prepare($sql);
        $stmt->bindValue(':cid', $companyId);
        $stmt->bindValue(':etype', $entryType);
        $stmt->bindValue(':eid', $entryId, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll();
        $out = array();
        foreach ($rows as $row) {
            $row['amount'] = number_format((float) $row['amount'], 2, '.', '');
            $row['is_reversal'] = ((float) $row['amount']) < 0;
            $out[] = $row;
        }
        return $out;
    }

    /**
     * Registra baixa (ou estorno, com amount negativo) e recalcula o titulo.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function createPayment(string $companyId, string $userId, array $data): array
    {
        $entryType = (string) $data['entry_type'];
        if (!in_array($entryType, self::ENTRY_TYPES, true)) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'entry_type deve ser receivable ou payable.');
        }

        $entryId = (int) $data['entry_id'];
        $amount = $this->money($data['amount']);
        $method = isset($data['method']) && $data['method'] !== null && $data['method'] !== '' ? (string) $data['method'] : 'outro';
        $paidAt = $this->datetime(isset($data['paid_at']) ? $data['paid_at'] : null);
        $notes = isset($data['notes']) && $data['notes'] !== null && $data['notes'] !== '' ? (string) $data['notes'] : null;

        if (!in_array($method, self::METHODS, true)) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Forma de pagamento invalida.');
        }
        if ($amount === 0.0) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Valor da baixa nao pode ser zero.');
        }
        if ($amount < 0 && $notes === null) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Estorno exige justificativa em notes.');
        }

        $table = $this->table($entryType);
        $pdo = Connection::pdo();

        try {
            $pdo->beginTransaction();

            $lock = $pdo->prepare(
                'SELECT id, amount, amount_paid, status
                   FROM ' . $table . '
                  WHERE id = :id AND CAST(company_id AS CHAR) = :cid
                  LIMIT 1 FOR UPDATE'
            );
            $lock->bindValue(':id', $entryId, PDO::PARAM_INT);
            $lock->bindValue(':cid', $companyId);
            $lock->execute();
            $entry = $lock->fetch();

            if ($entry === false) {
                $pdo->rollBack();
                throw new HttpException(404, 'NOT_FOUND', 'Titulo nao encontrado nesta empresa.');
            }

            $status = (string) $entry['status'];
            if ($status === 'cancelled' || $status === 'renegotiated') {
                $pdo->rollBack();
                throw new HttpException(422, 'INVALID_STATE', 'Titulo ' . $status . ' nao aceita baixa.');
            }

            $total = round((float) $entry['amount'], 2);
            $paid = round((float) $entry['amount_paid'], 2);
            $newPaid = round($paid + $amount, 2);

            if ($amount > 0 && $newPaid - $total > 0.001) {
                $balance = round($total - $paid, 2);
                $pdo->rollBack();
                throw new HttpException(
                    422,
                    'AMOUNT_EXCEEDS_BALANCE',
                    'Valor maior que o saldo em aberto (' . number_format($balance, 2, '.', '') . ').',
                    array('balance' => number_format($balance, 2, '.', ''), 'requested' => number_format($amount, 2, '.', ''))
                );
            }
            if ($newPaid < -0.001) {
                $pdo->rollBack();
                throw new HttpException(422, 'VALIDATION_ERROR', 'Estorno maior que o total ja recebido/pago.');
            }
            if ($newPaid < 0) {
                $newPaid = 0.0;
            }

            $newStatus = 'open';
            if ($newPaid >= $total - 0.001 && $total > 0) {
                $newStatus = 'paid';
            } elseif ($newPaid > 0) {
                $newStatus = 'partial';
            }

            $ins = $pdo->prepare(
                'INSERT INTO financial_payments
                    (company_id, entry_type, entry_id, method, amount, paid_at, notes, created_by, created_at)
                 VALUES
                    (:company_id, :entry_type, :entry_id, :method, :amount, :paid_at, :notes, :created_by, NOW())'
            );
            $ins->bindValue(':company_id', $companyId);
            $ins->bindValue(':entry_type', $entryType);
            $ins->bindValue(':entry_id', $entryId, PDO::PARAM_INT);
            $ins->bindValue(':method', $method);
            $ins->bindValue(':amount', number_format($amount, 2, '.', ''));
            $ins->bindValue(':paid_at', $paidAt);
            if ($notes === null) {
                $ins->bindValue(':notes', null, PDO::PARAM_NULL);
            } else {
                $ins->bindValue(':notes', $notes);
            }
            $ins->bindValue(':created_by', $userId);
            $ins->execute();

            $paymentId = (int) $pdo->lastInsertId();

            $upd = $pdo->prepare(
                'UPDATE ' . $table . '
                    SET amount_paid = :paid, status = :status, updated_at = NOW()
                  WHERE id = :id'
            );
            $upd->bindValue(':paid', number_format($newPaid, 2, '.', ''));
            $upd->bindValue(':status', $newStatus);
            $upd->bindValue(':id', $entryId, PDO::PARAM_INT);
            $upd->execute();

            $pdo->commit();

            $payment = array(
                'id'          => $paymentId,
                'company_id'  => $companyId,
                'entry_type'  => $entryType,
                'entry_id'    => $entryId,
                'method'      => $method,
                'amount'      => number_format($amount, 2, '.', ''),
                'paid_at'     => $paidAt,
                'notes'       => $notes,
                'created_by'  => $userId,
                'is_reversal' => $amount < 0,
            );

            if ($entryType === 'receivable') {
                $payment['entry'] = $this->findReceivable($companyId, $entryId);
            } else {
                $payment['entry'] = $this->findPayable($companyId, $entryId);
            }

            return $payment;
        } catch (HttpException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('[FINANCE PAYMENT] ' . $e->getMessage());
            throw new HttpException(500, 'INTERNAL_ERROR', 'Falha ao registrar baixa.');
        }
    }

    // -----------------------------------------------------------------
    // Resumo financeiro
    // -----------------------------------------------------------------

    /**
     * Totais em aberto, pagos, vencidos e proximos vencimentos.
     *
     * @return array<string,mixed>
     */
    public function summary(string $companyId, int $upcomingDays): array
    {
        if ($upcomingDays < 1) {
            $upcomingDays = 7;
        }
        if ($upcomingDays > 365) {
            $upcomingDays = 365;
        }

        $pdo = Connection::pdo();

        $result = array(
            'receivable' => $this->summaryFor($pdo, 'accounts_receivable', $companyId),
            'payable'    => $this->summaryFor($pdo, 'accounts_payable', $companyId),
        );

        $result['balance'] = number_format(
            (float) $result['receivable']['total_open'] - (float) $result['payable']['total_open'],
            2,
            '.',
            ''
        );

        $result['upcoming_days'] = $upcomingDays;
        $result['upcoming_receivables'] = $this->upcoming($pdo, 'receivable', $companyId, $upcomingDays);
        $result['upcoming_payables'] = $this->upcoming($pdo, 'payable', $companyId, $upcomingDays);

        return $result;
    }

    /**
     * @return array<string,mixed>
     */
    private function summaryFor(PDO $pdo, string $table, string $companyId): array
    {
        $sql = "SELECT
                    COUNT(*) AS total_count,
                    COALESCE(SUM(CASE WHEN status IN ('open','partial') THEN amount - amount_paid ELSE 0 END), 0) AS total_open,
                    COALESCE(SUM(amount_paid), 0) AS total_paid,
                    COALESCE(SUM(CASE WHEN status IN ('open','partial') AND due_date < CURDATE() THEN amount - amount_paid ELSE 0 END), 0) AS total_overdue,
                    COALESCE(SUM(CASE WHEN status IN ('open','partial') AND due_date < CURDATE() THEN 1 ELSE 0 END), 0) AS overdue_count
                  FROM " . $table . '
                 WHERE CAST(company_id AS CHAR) = :cid';

        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':cid', $companyId);
        $stmt->execute();
        $row = $stmt->fetch();

        if ($row === false) {
            $row = array(
                'total_count'   => 0,
                'total_open'    => 0,
                'total_paid'    => 0,
                'total_overdue' => 0,
                'overdue_count' => 0,
            );
        }

        return array(
            'total_count'   => (int) $row['total_count'],
            'total_open'    => number_format((float) $row['total_open'], 2, '.', ''),
            'total_paid'    => number_format((float) $row['total_paid'], 2, '.', ''),
            'total_overdue' => number_format((float) $row['total_overdue'], 2, '.', ''),
            'overdue_count' => (int) $row['overdue_count'],
        );
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private function upcoming(PDO $pdo, string $entryType, string $companyId, int $days): array
    {
        if ($entryType === 'receivable') {
            $sql = "SELECT ar.id, ar.description, ar.due_date, ar.amount, ar.amount_paid, ar.status,
                           c.name AS counterpart
                      FROM accounts_receivable ar
                 LEFT JOIN customers c ON c.id = ar.customer_id
                     WHERE CAST(ar.company_id AS CHAR) = :cid
                       AND ar.status IN ('open','partial')
                       AND ar.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL :days DAY)
                     ORDER BY ar.due_date ASC, ar.id ASC
                     LIMIT 50";
        } else {
            $sql = "SELECT ap.id, ap.description, ap.due_date, ap.amount, ap.amount_paid, ap.status,
                           ap.supplier_name AS counterpart
                      FROM accounts_payable ap
                     WHERE CAST(ap.company_id AS CHAR) = :cid
                       AND ap.status IN ('open','partial')
                       AND ap.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL :days DAY)
                     ORDER BY ap.due_date ASC, ap.id ASC
                     LIMIT 50";
        }

        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':cid', $companyId);
        $stmt->bindValue(':days', $days, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll();
        $out = array();
        foreach ($rows as $row) {
            $balance = round((float) $row['amount'] - (float) $row['amount_paid'], 2);
            $row['entry_type'] = $entryType;
            $row['amount'] = number_format((float) $row['amount'], 2, '.', '');
            $row['amount_paid'] = number_format((float) $row['amount_paid'], 2, '.', '');
            $row['balance'] = number_format($balance, 2, '.', '');
            $out[] = $row;
        }
        return $out;
    }
}
