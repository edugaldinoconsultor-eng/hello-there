<?php
declare(strict_types=1);

namespace SoulERP\Database;

use PDO;
use PDOException;
use SoulERP\Config\AppConfig;
use SoulERP\Http\HttpException;

/**
 * Conexão PDO singleton.
 *
 * - ERRMODE_EXCEPTION: qualquer erro vira PDOException, capturada acima.
 * - EMULATE_PREPARES = false: tipos reais + prepared statement de verdade
 *   no servidor MySQL. Anula praticamente toda a superfície de SQL injection
 *   desde que TODA query com input use placeholders (?, :nome).
 * - FETCH_ASSOC: nada de índice numérico duplicado.
 */
final class Connection
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $host = (string) AppConfig::get('db.host', '');
        $name = (string) AppConfig::get('db.name', '');
        $user = (string) AppConfig::get('db.user', '');
        $pass = (string) AppConfig::get('db.password', '');
        $charset = (string) AppConfig::get('db.charset', 'utf8mb4');
        $port = (int) AppConfig::get('db.port', 3306);

        if ($host === '' || $name === '' || $user === '') {
            throw new HttpException(500, 'INTERNAL_ERROR', 'Banco não configurado.');
        }

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";

        try {
            self::$pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset}, time_zone = '-03:00'",
            ]);
        } catch (PDOException $e) {
            // Log detalhado só no error_log; resposta genérica pro cliente.
            error_log('[SoulERP] DB connect failed: ' . $e->getMessage());
            throw new HttpException(500, 'INTERNAL_ERROR', 'Falha ao conectar no banco.');
        }

        return self::$pdo;
    }

    public static function beginTransaction(): void
    {
        self::pdo()->beginTransaction();
    }

    public static function commit(): void
    {
        self::pdo()->commit();
    }

    public static function rollBack(): void
    {
        if (self::pdo()->inTransaction()) {
            self::pdo()->rollBack();
        }
    }
}
