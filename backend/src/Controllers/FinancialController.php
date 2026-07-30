<?php
declare(strict_types=1);

namespace SoulERP\Controllers;

use SoulERP\Auth\Permissions;
use SoulERP\Auth\Session;
use SoulERP\Http\Request;
use SoulERP\Http\Response;
use SoulERP\Repositories\FinancialRepository;
use SoulERP\Services\AuditLogger;
use SoulERP\Validation\V;

/**
 * Financeiro: contas a receber, contas a pagar, baixas e resumo.
 *
 * Leitura -> finance.view
 * Escrita -> finance.manage
 *
 * A empresa vem SEMPRE da sessao. O cliente nunca envia company_id.
 */
final class FinancialController
{
    // -----------------------------------------------------------------
    // Contas a receber
    // -----------------------------------------------------------------

    public function receivables(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.view');

        $status = isset($request->query['status']) ? (string) $request->query['status'] : null;
        $customerId = isset($request->query['customerId']) ? (int) $request->query['customerId'] : null;
        $from = isset($request->query['from']) ? (string) $request->query['from'] : null;
        $to = isset($request->query['to']) ? (string) $request->query['to'] : null;
        $query = isset($request->query['query']) ? (string) $request->query['query'] : null;
        $page = isset($request->query['page']) ? (int) $request->query['page'] : 1;
        $pageSize = isset($request->query['pageSize']) ? (int) $request->query['pageSize'] : 50;

        $repo = new FinancialRepository();
        $rows = $repo->listReceivables($user->companyId, $status, $customerId, $from, $to, $query, $page, $pageSize);

        Response::json($rows, 200, array('count' => count($rows)));
    }

    public function showReceivable(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.view');

        $id = (int) $request->params['id'];

        $repo = new FinancialRepository();
        $entry = $repo->findReceivable($user->companyId, $id);

        Response::json($entry, 200);
    }

    public function createReceivable(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.manage');

        $body = $request->body !== null ? $request->body : array();

        $data = array(
            'customer_id'    => V::require($body, 'customer_id', 'int'),
            'description'    => V::require($body, 'description'),
            'amount'         => V::require($body, 'amount', 'raw'),
            'due_date'       => V::require($body, 'due_date'),
            'issue_date'     => V::optional($body, 'issue_date'),
            'order_id'       => V::optional($body, 'order_id', 'int'),
            'installment_id' => V::optional($body, 'installment_id', 'int'),
            'parent_id'      => V::optional($body, 'parent_id', 'int'),
            'notes'          => V::optional($body, 'notes'),
        );

        $repo = new FinancialRepository();
        $entry = $repo->createReceivable($user->companyId, $user->userId, $data);

        AuditLogger::log($user, 'AR_CREATED', 'accounts_receivable', (string) $entry['id'], null, $data);

        Response::json($entry, 201);
    }

    public function payReceivable(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.manage');

        $body = $request->body !== null ? $request->body : array();

        $data = array(
            'entry_type' => 'receivable',
            'entry_id'   => (int) $request->params['id'],
            'amount'     => V::require($body, 'amount', 'raw'),
            'method'     => V::optional($body, 'method'),
            'paid_at'    => V::optional($body, 'paid_at'),
            'notes'      => V::optional($body, 'notes'),
        );

        $repo = new FinancialRepository();
        $payment = $repo->createPayment($user->companyId, $user->userId, $data);

        AuditLogger::log($user, 'AR_PAYMENT_CREATED', 'financial_payment', (string) $payment['id'], null, $data);

        Response::json($payment, 201);
    }

    // -----------------------------------------------------------------
    // Contas a pagar
    // -----------------------------------------------------------------

    public function payables(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.view');

        $status = isset($request->query['status']) ? (string) $request->query['status'] : null;
        $category = isset($request->query['category']) ? (string) $request->query['category'] : null;
        $from = isset($request->query['from']) ? (string) $request->query['from'] : null;
        $to = isset($request->query['to']) ? (string) $request->query['to'] : null;
        $query = isset($request->query['query']) ? (string) $request->query['query'] : null;
        $page = isset($request->query['page']) ? (int) $request->query['page'] : 1;
        $pageSize = isset($request->query['pageSize']) ? (int) $request->query['pageSize'] : 50;

        $repo = new FinancialRepository();
        $rows = $repo->listPayables($user->companyId, $status, $category, $from, $to, $query, $page, $pageSize);

        Response::json($rows, 200, array('count' => count($rows)));
    }

    public function showPayable(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.view');

        $id = (int) $request->params['id'];

        $repo = new FinancialRepository();
        $entry = $repo->findPayable($user->companyId, $id);

        Response::json($entry, 200);
    }

    public function createPayable(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.manage');

        $body = $request->body !== null ? $request->body : array();

        $data = array(
            'supplier_name' => V::require($body, 'supplier_name'),
            'description'   => V::require($body, 'description'),
            'amount'        => V::require($body, 'amount', 'raw'),
            'due_date'      => V::require($body, 'due_date'),
            'issue_date'    => V::optional($body, 'issue_date'),
            'category'      => V::optional($body, 'category'),
            'notes'         => V::optional($body, 'notes'),
        );

        $repo = new FinancialRepository();
        $entry = $repo->createPayable($user->companyId, $user->userId, $data);

        AuditLogger::log($user, 'AP_CREATED', 'accounts_payable', (string) $entry['id'], null, $data);

        Response::json($entry, 201);
    }

    public function payPayable(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.manage');

        $body = $request->body !== null ? $request->body : array();

        $data = array(
            'entry_type' => 'payable',
            'entry_id'   => (int) $request->params['id'],
            'amount'     => V::require($body, 'amount', 'raw'),
            'method'     => V::optional($body, 'method'),
            'paid_at'    => V::optional($body, 'paid_at'),
            'notes'      => V::optional($body, 'notes'),
        );

        $repo = new FinancialRepository();
        $payment = $repo->createPayment($user->companyId, $user->userId, $data);

        AuditLogger::log($user, 'AP_PAYMENT_CREATED', 'financial_payment', (string) $payment['id'], null, $data);

        Response::json($payment, 201);
    }

    // -----------------------------------------------------------------
    // Pagamentos (append-only) e resumo
    // -----------------------------------------------------------------

    public function createPayment(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.manage');

        $body = $request->body !== null ? $request->body : array();

        $data = array(
            'entry_type' => V::require($body, 'entry_type'),
            'entry_id'   => V::require($body, 'entry_id', 'int'),
            'amount'     => V::require($body, 'amount', 'raw'),
            'method'     => V::optional($body, 'method'),
            'paid_at'    => V::optional($body, 'paid_at'),
            'notes'      => V::optional($body, 'notes'),
        );

        $repo = new FinancialRepository();
        $payment = $repo->createPayment($user->companyId, $user->userId, $data);

        $action = $data['entry_type'] === 'payable' ? 'AP_PAYMENT_CREATED' : 'AR_PAYMENT_CREATED';
        AuditLogger::log($user, $action, 'financial_payment', (string) $payment['id'], null, $data);

        Response::json($payment, 201);
    }

    public function payments(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.view');

        $entryType = isset($request->query['entryType']) ? (string) $request->query['entryType'] : 'receivable';
        $entryId = isset($request->query['entryId']) ? (int) $request->query['entryId'] : 0;

        $repo = new FinancialRepository();
        $rows = $repo->listPayments($user->companyId, $entryType, $entryId);

        Response::json($rows, 200, array('count' => count($rows)));
    }

    public function summary(Request $request): void
    {
        $user = Session::requireUser($request);
        Permissions::require($user, 'finance.view');

        $days = isset($request->query['days']) ? (int) $request->query['days'] : 7;

        $repo = new FinancialRepository();
        $summary = $repo->summary($user->companyId, $days);

        Response::json($summary, 200);
    }
}
