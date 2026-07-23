<?php
declare(strict_types=1);

namespace SoulERP\Http;

/**
 * Snapshot imutável do request atual.
 */
final class Request
{
    /** @param array<string,string> $params rota params (ex.: {id}) */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $headers,
        public readonly ?array $body,
        public array $params = [],
    ) {}

    public static function fromGlobals(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?? '/';
        // Normaliza — sem trailing slash exceto na raiz.
        if ($path !== '/' && str_ends_with($path, '/')) {
            $path = rtrim($path, '/');
        }

        $headers = [];
        foreach ($_SERVER as $k => $v) {
            if (str_starts_with($k, 'HTTP_')) {
                $name = strtolower(str_replace('_', '-', substr($k, 5)));
                $headers[$name] = (string) $v;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }

        $body = null;
        $ct = $headers['content-type'] ?? '';
        if (str_contains($ct, 'application/json')) {
            $raw = file_get_contents('php://input') ?: '';
            if ($raw !== '') {
                try {
                    $body = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
                } catch (\JsonException) {
                    throw new HttpException(400, 'VALIDATION_ERROR', 'JSON inválido no corpo.');
                }
            }
        }

        return new self($method, $path, $_GET, $headers, is_array($body) ? $body : null);
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }
}
