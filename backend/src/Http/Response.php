<?php
declare(strict_types=1);

namespace SoulERP\Http;

/**
 * Emissor de respostas JSON no formato padrão do SoulERP.
 *
 * Sucesso:   { "data": ..., "meta"?: {...} }
 * Erro:      { "error": { "code", "message", "details"? } }
 */
final class Response
{
    public static function json(mixed $data, int $status = 200, ?array $meta = null): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        $payload = ['data' => $data];
        if ($meta !== null) {
            $payload['meta'] = $meta;
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function error(int $status, string $code, string $message, ?array $details = null): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        $err = ['code' => $code, 'message' => $message];
        if ($details !== null) {
            $err['details'] = $details;
        }
        echo json_encode(['error' => $err], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function noContent(): void
    {
        http_response_code(204);
    }
}
