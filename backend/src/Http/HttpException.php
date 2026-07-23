<?php
declare(strict_types=1);

namespace SoulERP\Http;

use RuntimeException;

/**
 * Exceção HTTP com código de erro padronizado.
 * Códigos alinhados com src/services/http.ts do frontend.
 */
final class HttpException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly ?array $details = null,
    ) {
        parent::__construct($message);
    }
}
