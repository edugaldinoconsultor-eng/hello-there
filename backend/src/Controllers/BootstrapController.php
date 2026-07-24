<?php
declare(strict_types=1);

namespace SoulERP\Controllers;

use SoulERP\Auth\PasswordHasher;
use SoulERP\Config\AppConfig;
use SoulERP\Database\Connection;
use SoulERP\Http\HttpException;
use SoulERP\Http\Request;
use SoulERP\Http\Response;
use SoulERP\Support\Uuid;
use SoulERP\Validation\V;

/**
 * Endpoint de bootstrap ÚNICO — cria a primeira empresa + primeiro owner.
 *
 * Regras de segurança:
 *   1. Desativado por padrão. Só responde se `bootstrap_token` estiver
 *      definido no `config/config.php` do SERVIDOR.
 *   2. Caller precisa enviar header `X-Bootstrap-Token` com o mesmo valor.
 *      Comparação com hash_equals.
 *   3. Se já existir QUALQUER usuário com vínculo `owner`, retorna 409 e
 *      não faz nada — bootstrap só serve para banco vazio.
 *   4. Nenhum email/senha/token é hardcoded. Tudo vem do request.
 *   5. Roda em transação: ou cria os 3 registros (company + user + company_user)
 *      ou não cria nenhum.
 *
 * Depois de usado:
 *   - Remova `bootstrap_token` de `config/config.php` (basta apagar a chave).
 *   - Opcionalmente delete este arquivo do servidor.
 */
final class BootstrapController
{
    public function run(Request $request): void
    {
        $configured = (string) AppConfig::get('bootstrap_token', '');
        if ($configured === '') {
            throw new HttpException(404, 'NOT_FOUND', 'Endpoint indisponível.');
        }
        $provided = $request->header('x-bootstrap-token') ?? '';
        if (!hash_equals($configured, $provided)) {
            throw new HttpException(403, 'FORBIDDEN', 'Bootstrap token inválido.');
        }

        $pdo = Connection::pdo();
        $exists = (int) $pdo->query(
            "SELECT COUNT(*) FROM company_users WHERE role = 'owner' AND active = 1"
        )->fetchColumn();
        if ($exists > 0) {
            throw new HttpException(409, 'CONFLICT', 'Bootstrap já foi executado.');
        }

        $body = $request->body ?? [];
        $companyName = (string) V::require($body, 'companyName');
        $userName    = (string) V::require($body, 'userName');
        $email       = strtolower((string) V::require($body, 'email'));
        $password    = (string) V::require($body, 'password');

        if (strlen($password) < 10) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Senha deve ter ao menos 10 caracteres.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'Email inválido.');
        }

        $companyId = Uuid::v4();
        $userId    = Uuid::v4();
        $cuId      = Uuid::v4();
        $hash      = PasswordHasher::hash($password);

        try {
            Connection::beginTransaction();

            $s = $pdo->prepare(
                'INSERT INTO companies (id, name, active, created_at, updated_at)
                 VALUES (:id, :n, 1, NOW(), NOW())'
            );
            $s->execute([':id' => $companyId, ':n' => $companyName]);

            $s = $pdo->prepare(
                'INSERT INTO users (id, name, email, password_hash, active, created_at, updated_at)
                 VALUES (:id, :n, :e, :h, 1, NOW(), NOW())'
            );
            $s->execute([':id' => $userId, ':n' => $userName, ':e' => $email, ':h' => $hash]);

            $s = $pdo->prepare(
                "INSERT INTO company_users (id, company_id, user_id, role, active, created_at)
                 VALUES (:id, :c, :u, 'owner', 1, NOW())"
            );
            $s->execute([':id' => $cuId, ':c' => $companyId, ':u' => $userId]);

            // Audit direto (sem AuthenticatedUser real — usa o próprio owner criado).
            $s = $pdo->prepare(
                'INSERT INTO audit_logs
                    (id, company_id, user_id, action, entity_type, entity_id, diff, ip, user_agent, created_at)
                 VALUES (:id, :c, :u, :a, :et, :eid, :d, :ip, :ua, NOW())'
            );
            $s->execute([
                ':id'  => Uuid::v4(),
                ':c'   => $companyId,
                ':u'   => $userId,
                ':a'   => 'BOOTSTRAP',
                ':et'  => 'company',
                ':eid' => $companyId,
                ':d'   => json_encode(['company' => $companyName, 'user_email' => $email]),
                ':ip'  => $_SERVER['REMOTE_ADDR'] ?? null,
                ':ua'  => isset($_SERVER['HTTP_USER_AGENT']) ? substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 255) : null,
            ]);

            Connection::commit();
        } catch (\Throwable $e) {
            Connection::rollBack();
            error_log('[SoulERP] Bootstrap failed: ' . $e->getMessage());
            throw new HttpException(500, 'INTERNAL_ERROR', 'Falha ao executar bootstrap.');
        }

        Response::json([
            'company' => ['id' => $companyId, 'name' => $companyName],
            'user'    => ['id' => $userId, 'email' => $email, 'name' => $userName],
            'notice'  => 'Remova bootstrap_token do config/config.php agora.',
        ], 201);
    }
}
