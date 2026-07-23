<?php
/**
 * Bootstrap do backend.
 *
 * - Registra autoload PSR-4 simples (sem Composer, para simplificar deploy).
 * - Carrega config.
 * - Sobe timezone e modo de erro.
 * - Deixa tudo pronto para Kernel::handle() rodar o request.
 */

declare(strict_types=1);

date_default_timezone_set('America/Sao_Paulo');

$configPath = __DIR__ . '/../config/config.php';
if (!is_file($configPath)) {
    // Config real não existe no servidor. Devolve 500 sem vazar detalhes.
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => [
            'code' => 'INTERNAL_ERROR',
            'message' => 'Backend não configurado.',
        ],
    ]);
    exit;
}

/** @var array<string,mixed> $config */
$config = require $configPath;

$env = (getenv('SOULERP_ENV') ?: ($config['env'] ?? 'production'));
$isDev = $env === 'dev';

ini_set('display_errors', $isDev ? '1' : '0');
ini_set('display_startup_errors', $isDev ? '1' : '0');
error_reporting(E_ALL);

// Autoload PSR-4: SoulERP\* → src/*
spl_autoload_register(static function (string $class): void {
    $prefix = 'SoulERP\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

// Disponibiliza config para o Kernel via singleton.
\SoulERP\Config\AppConfig::set($config);
\SoulERP\Config\AppConfig::setEnv($env);
