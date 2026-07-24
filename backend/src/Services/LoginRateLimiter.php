<?php
declare(strict_types=1);

namespace SoulERP\Services;

use SoulERP\Database\Connection;
use SoulERP\Http\HttpException;

/**
 * Rate limit simples de login baseado em MySQL.
 *
 * Regras padrão:
 *   - Máx 10 tentativas do mesmo IP em 15 min.
 *   - Máx  5 tentativas para o mesmo email em 15 min.
 * Tentativas com sucesso zeram o contador (apagamos falhas anteriores).
 */
final class LoginRateLimiter
{
    private const WINDOW_MINUTES  = 15;
    private const MAX_PER_IP      = 10;
    private const MAX_PER_EMAIL   = 5;

    public static function check(string $email, string $ip): void
    {
        $sqlEmail = 'SELECT COUNT(*) FROM login_attempts
                      WHERE email = :e AND success = 0
                        AND attempted_at > DATE_SUB(NOW(), INTERVAL :m MINUTE)';
        $sqlIp = 'SELECT COUNT(*) FROM login_attempts
                   WHERE ip_address = :ip AND success = 0
                     AND attempted_at > DATE_SUB(NOW(), INTERVAL :m MINUTE)';

        $pdo = Connection::pdo();

        $s = $pdo->prepare($sqlEmail);
        $s->execute([':e' => $email, ':m' => self::WINDOW_MINUTES]);
        if ((int) $s->fetchColumn() >= self::MAX_PER_EMAIL) {
            throw new HttpException(429, 'RATE_LIMITED', 'Muitas tentativas. Tente novamente em alguns minutos.');
        }

        $s = $pdo->prepare($sqlIp);
        $s->execute([':ip' => $ip, ':m' => self::WINDOW_MINUTES]);
        if ((int) $s->fetchColumn() >= self::MAX_PER_IP) {
            throw new HttpException(429, 'RATE_LIMITED', 'Muitas tentativas. Tente novamente em alguns minutos.');
        }
    }

    public static function record(string $email, string $ip, bool $success): void
    {
        $sql = 'INSERT INTO login_attempts (email, ip_address, success, attempted_at)
                VALUES (:e, :ip, :s, NOW())';
        $stmt = Connection::pdo()->prepare($sql);
        $stmt->execute([':e' => $email, ':ip' => $ip, ':s' => $success ? 1 : 0]);

        if ($success) {
            // Limpa falhas antigas do email — usuário recuperou acesso.
            $del = Connection::pdo()->prepare(
                'DELETE FROM login_attempts WHERE email = :e AND success = 0'
            );
            $del->execute([':e' => $email]);
        }
    }
}
