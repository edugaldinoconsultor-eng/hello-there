<?php
declare(strict_types=1);

namespace SoulERP\Auth;

use SoulERP\Database\Connection;
use SoulERP\Support\Uuid;

/**
 * Acesso à tabela `auth_sessions`.
 *
 * O token BRUTO nunca é armazenado — só o hash SHA-256. Uma sessão só existe
 * enquanto (a) `expires_at > NOW()` e (b) o hash bate. Trocar de empresa
 * emite uma nova sessão e revoga a anterior (rotação de token).
 */
final class SessionStore
{
    /**
     * @return array{
     *   id:string,user_id:string,company_id:string,expires_at:string
     * }|null
     */
    public static function findByHash(string $tokenHash): ?array
    {
        $sql = 'SELECT id, user_id, company_id, expires_at
                  FROM auth_sessions
                 WHERE token_hash = :h
                   AND expires_at > NOW()
                 LIMIT 1';
        $stmt = Connection::pdo()->prepare($sql);
        $stmt->execute([':h' => $tokenHash]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public static function create(
        string $userId,
        string $companyId,
        string $tokenHash,
        int $lifetimeSeconds,
        ?string $ip,
        ?string $userAgent,
    ): string {
        $id = Uuid::v4();
        $sql = 'INSERT INTO auth_sessions
                  (id, user_id, company_id, token_hash, expires_at, last_used_at, ip_address, user_agent, created_at)
                VALUES
                  (:id, :uid, :cid, :h, DATE_ADD(NOW(), INTERVAL :life SECOND), NOW(), :ip, :ua, NOW())';
        $stmt = Connection::pdo()->prepare($sql);
        $stmt->execute([
            ':id'   => $id,
            ':uid'  => $userId,
            ':cid'  => $companyId,
            ':h'    => $tokenHash,
            ':life' => $lifetimeSeconds,
            ':ip'   => $ip,
            ':ua'   => $userAgent !== null ? substr($userAgent, 0, 255) : null,
        ]);
        return $id;
    }

    public static function touch(string $sessionId, ?string $ip): void
    {
        $sql = 'UPDATE auth_sessions
                   SET last_used_at = NOW(),
                       ip_address = COALESCE(:ip, ip_address)
                 WHERE id = :id';
        $stmt = Connection::pdo()->prepare($sql);
        $stmt->execute([':id' => $sessionId, ':ip' => $ip]);
    }

    public static function updateCompany(string $sessionId, string $companyId): void
    {
        $stmt = Connection::pdo()->prepare(
            'UPDATE auth_sessions SET company_id = :cid WHERE id = :id'
        );
        $stmt->execute([':id' => $sessionId, ':cid' => $companyId]);
    }

    public static function deleteById(string $sessionId): void
    {
        $stmt = Connection::pdo()->prepare('DELETE FROM auth_sessions WHERE id = :id');
        $stmt->execute([':id' => $sessionId]);
    }

    public static function purgeExpired(): void
    {
        Connection::pdo()->exec('DELETE FROM auth_sessions WHERE expires_at < NOW()');
    }
}
