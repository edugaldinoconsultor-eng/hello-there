<?php
declare(strict_types=1);

namespace SoulERP\Http;

/**
 * Roteador minimalista.
 *
 * - Suporta parâmetros {name} no path.
 * - Handler é [ControllerClass::class, 'method'] ou closure(Request).
 * - Middlewares são closures/callables que recebem (Request, next) e devolvem
 *   Request. Podem lançar HttpException para bloquear.
 */
final class Router
{
    /** @var array<int, array{method:string, pattern:string, regex:string, params:string[], handler:mixed, middlewares:array<int,callable>}> */
    private array $routes = [];

    /** @var array<int, callable> */
    private array $globalMiddlewares = [];

    public function use(callable $middleware): void
    {
        $this->globalMiddlewares[] = $middleware;
    }

    /** @param array<int,callable> $middlewares */
    public function add(string $method, string $pattern, mixed $handler, array $middlewares = []): void
    {
        $params = [];
        $regex = preg_replace_callback(
            '#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#',
            static function ($m) use (&$params): string {
                $params[] = $m[1];
                return '(?P<' . $m[1] . '>[^/]+)';
            },
            $pattern
        );
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'regex' => '#^' . $regex . '$#',
            'params' => $params,
            'handler' => $handler,
            'middlewares' => $middlewares,
        ];
    }

    public function get(string $p, mixed $h, array $mw = []): void    { $this->add('GET',    $p, $h, $mw); }
    public function post(string $p, mixed $h, array $mw = []): void   { $this->add('POST',   $p, $h, $mw); }
    public function patch(string $p, mixed $h, array $mw = []): void  { $this->add('PATCH',  $p, $h, $mw); }
    public function delete(string $p, mixed $h, array $mw = []): void { $this->add('DELETE', $p, $h, $mw); }

    public function dispatch(Request $request): void
    {
        $matchedAny = false;
        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $request->path, $m)) {
                continue;
            }
            $matchedAny = true;
            if ($route['method'] !== $request->method) {
                continue;
            }
            $params = [];
            foreach ($route['params'] as $name) {
                $params[$name] = $m[$name];
            }
            $request->params = $params;

            foreach ($this->globalMiddlewares as $mw) {
                $mw($request);
            }
            foreach ($route['middlewares'] as $mw) {
                $mw($request);
            }

            $handler = $route['handler'];
            if (is_array($handler) && count($handler) === 2) {
                [$class, $method] = $handler;
                $instance = new $class();
                $instance->{$method}($request);
                return;
            }
            if (is_callable($handler)) {
                $handler($request);
                return;
            }
            throw new HttpException(500, 'INTERNAL_ERROR', 'Handler inválido.');
        }

        if ($matchedAny) {
            throw new HttpException(405, 'VALIDATION_ERROR', 'Método não permitido.');
        }
        throw new HttpException(404, 'NOT_FOUND', 'Rota não encontrada.');
    }
}
