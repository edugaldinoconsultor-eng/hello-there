<?php
declare(strict_types=1);

namespace SoulERP\Services;

use SoulERP\Auth\AuthenticatedUser;
use SoulERP\Database\Connection;
use SoulERP\Support\Uuid;

/**
 * Registro em audit_logs. Chamado por controllers/services que mutam dados
 * sensíveis (pedido, preço, cancelamento, permissão etc.).
 *
 * NUNCA logar senha, token, header Authorization ou payload de CSRF.
 */
final class AuditLogger
{
    public static function log(
        AuthenticatedUser $user,
        string $action,
        string $entityType,
        string $entityId,
        ?array $oldValues = null,
        ?array $newValues = null,
    ): void {
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
        // audit_logs.id no banco real é BIGINT UNSIGNED AUTO_INCREMENT — não
        // passamos :id, deixamos o MySQL gerar. company_id/user_id são BIGINT
        // UNSIGNED; PDO aceita string na bind e converte para o tipo da coluna.
        $sql = 'INSERT INTO audit_logs
                (company_id, user_id, action, entity_type, entity_id, diff, ip, user_agent, created_at)
                VALUES (:company_id, :user_id, :action, :entity_type, :entity_id, :diff, :ip, :ua, NOW())';
        try {
            $stmt = Connection::pdo()->prepare($sql);
            $stmt->execute([
                ':company_id' => $user->companyId,
                ':user_id' => $user->userId,
                ':action' => $action,
                ':entity_type' => $entityType,
                ':entity_id' => $entityId,
                ':diff' => json_encode(['before' => $oldValues, 'after' => $newValues], JSON_UNESCAPED_UNICODE),
                ':ip' => $ip,
                ':ua' => $ua ? substr($ua, 0, 255) : null,
            ]);

        } catch (\Throwable $e) {
            // Falha em audit nunca derruba a operação, mas gera log de servidor.
            error_log('[SoulERP] Audit log failed: ' . $e->getMessage());
        }
    }
}
