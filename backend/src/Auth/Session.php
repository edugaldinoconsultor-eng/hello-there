<?php
declare(strict_types=1);

namespace SoulERP\Auth;

use SoulERP\Config\AppConfig;
use SoulERP\Database\Connection;
use SoulERP\Http\HttpException;
use SoulERP\Http\Request;

/**
 * Fonte única de verdade sobre "quem está autenticado".
 *
 * Fluxo em produção (APP_ENV != 'dev'):
 *   Request → cookie soulerp_sid → hash SHA-256 → tabela auth_sessions
 *          → users (active=1) → company_users (active=1, company_id da sessão)
 *          → role  → AuthenticatedUser
 *
 * A role NUNCA é lida do frontend. `X-Dev-User/Company/Role` só é aceito em
 * ambiente `dev` — em produção esses headers são silenciosamente ignorados.
 */
final class Session
{
    private static ?AuthenticatedUser $current = null;
    private static ?string $currentSessionId = null;

    public static function requireUser(Request $request): AuthenticatedUser
    {
        if (self::$current instanceof AuthenticatedUser) {
            return self::$current;
        }

        // 1. Cookie-based (produção e dev).
        $user = self::tryCookieAuth($request);
        if ($user !== null) {
            self::$current = $user;
            return $user;
        }

        // 2. Fallback DEV (jamais em produção).
        if (AppConfig::isDev()) {
            $devUserId  = $request->header('x-dev-user');
            $devCompany = $request->header('x-dev-company');
            $devRole    = $request->header('x-dev-role');
            if ($devUserId !== null && $devCompany !== null && $devRole !== null) {
                self::$current = new AuthenticatedUser(
                    userId: $devUserId,
                    companyId: $devCompany,
                    role: $devRole,
                );
                return self::$current;
            }
        }

        throw new HttpException(401, 'UNAUTHORIZED', 'Sessão inválida ou expirada.');
    }

    /** Usado por logout/switch-company para descobrir a sessão em curso. */
    public static function currentSessionId(): ?string
    {
        return self::$currentSessionId;
    }

    private static function tryCookieAuth(Request $request): ?AuthenticatedUser
    {
        $raw = SessionCookie::readSessionToken();
        if ($raw === null) {
            return null;
        }
        $hash = TokenGenerator::hash($raw);
        $session = SessionStore::findByHash($hash);
        if ($session === null) {
            return null;
        }

        // Junta user + membership em uma query — recusa se algum estiver inativo.
        $sql = 'SELECT u.id AS user_id, u.name, u.email, u.active AS user_active,
                       c.id AS company_id, c.name AS company_name, c.active AS company_active,
                       cu.role, cu.active AS membership_active
                  FROM users u
                  JOIN company_users cu ON cu.user_id = u.id
                  JOIN companies c      ON c.id = cu.company_id
                 WHERE u.id = :uid
                   AND c.id = :cid
                 LIMIT 1';
        $stmt = Connection::pdo()->prepare($sql);
        $stmt->execute([':uid' => $session['user_id'], ':cid' => $session['company_id']]);
        $row = $stmt->fetch();

        if ($row === false
            || (int) $row['user_active'] !== 1
            || (int) $row['company_active'] !== 1
            || (int) $row['membership_active'] !== 1
        ) {
            // Sessão órfã: apaga para forçar novo login.
            SessionStore::deleteById($session['id']);
            return null;
        }

        SessionStore::touch($session['id'], $_SERVER['REMOTE_ADDR'] ?? null);
        self::$currentSessionId = $session['id'];

        return new AuthenticatedUser(
            userId: (string) $row['user_id'],
            companyId: (string) $row['company_id'],
            role: (string) $row['role'],
        );
    }

    public static function reset(): void
    {
        self::$current = null;
        self::$currentSessionId = null;
    }
}
