<?php
/**
 * SoulERP — modelo de configuração.
 *
 * Copie este arquivo para `config/config.php` NO SERVIDOR e preencha
 * os valores reais lá. NUNCA versione `config/config.php`.
 *
 * As credenciais reais serão fornecidas pelo hPanel da Hostinger em:
 * hPanel → Bancos de Dados → MySQL.
 */

return [
    'env' => 'production', // 'production' | 'dev'

    'db' => [
        'host'     => '', // ex.: 'localhost'
        'name'     => '', // ex.: 'u123456789_soulerp'
        'user'     => '', // ex.: 'u123456789_soul'
        'password' => '', // preencher no servidor, nunca aqui
        'charset'  => 'utf8mb4',
        'port'     => 3306,
    ],

    // Origens (domínios do frontend) autorizadas a chamar a API.
    // Nunca use '*' em produção.
    'allowed_origins' => [
        // 'https://app.seudominio.com.br',
        // 'http://localhost:8080',
    ],

    // Cookies de sessão futura.
    'session' => [
        'cookie_name'   => 'soulerp_sid',
        'cookie_secure' => true,   // exige HTTPS
        'cookie_http_only' => true,
        'cookie_samesite'  => 'Strict',
        'lifetime_seconds' => 60 * 60 * 8, // 8h
    ],

    // Rate limiting (documentação/preparação — ver Middleware/RateLimit).
    'rate_limit' => [
        'enabled' => false,
        'per_minute' => 120,
    ],
];
