<?php
/**
 * SoulERP — modelo de configuração.
 *
 * Copie este arquivo para `config/config.php` NO SERVIDOR e preencha os
 * valores reais lá. NUNCA versione `config/config.php`.
 */

return [
    // 'production' em produção; 'dev' habilita X-Dev-User/Company/Role e stack traces.
    'env' => 'production',

    'db' => [
        'host'     => '',           // ex.: 'localhost'
        'name'     => '',           // ex.: 'u123456789_soulerp'
        'user'     => '',           // ex.: 'u123456789_soul'
        'password' => '',           // preencher no servidor, nunca aqui
        'charset'  => 'utf8mb4',
        'port'     => 3306,
    ],

    // Origens (domínios do frontend) autorizadas a chamar a API.
    // NUNCA use '*' — cookies HttpOnly exigem origin explícito.
    // Estas origens do Lovable já estão embutidas como padrão no
    // Middleware/Cors.php, mas podem ser repetidas aqui sem problema:
    //   https://id-preview--d864102f-80f4-4268-87ac-bda274124536.lovable.app
    //   https://mellow-mutual-mix.lovable.app
    //   http://localhost:8080
    'allowed_origins' => [
        'https://id-preview--d864102f-80f4-4268-87ac-bda274124536.lovable.app',
        'https://mellow-mutual-mix.lovable.app',
        'http://localhost:8080',
        // 'https://app.infodanutri.com.br',
    ],

    // Cookie de sessão HttpOnly.
    'session' => [
        'cookie_name'      => 'soulerp_sid',
        // OBRIGATÓRIO em cross-site (frontend .lovable.app + API .infodanutri.com.br):
        // SameSite=None exige Secure=true, e ambos exigem HTTPS.
        'cookie_secure'    => true,   // exige HTTPS em produção
        'cookie_http_only' => true,   // (informativo — o backend sempre força HttpOnly)
        'cookie_samesite'  => 'None', // 'None' = cookie enviado em requisições cross-site
        'lifetime_seconds' => 60 * 60 * 8, // 8 horas
    ],

    // Bootstrap seguro do primeiro usuário owner.
    //
    //   1. Gere um token forte, ex.: `openssl rand -hex 32`.
    //   2. Cole aqui como string.
    //   3. Chame POST /api/v1/auth/bootstrap com header X-Bootstrap-Token.
    //   4. APAGUE esta linha do config/config.php depois de usar.
    //
    // Enquanto vazio/ausente, o endpoint retorna 404.
    // 'bootstrap_token' => '',

    // Rate limit HTTP genérico (reservado para uso futuro).
    // Login já tem rate limit próprio em Services\LoginRateLimiter.
    'rate_limit' => [
        'enabled'    => false,
        'per_minute' => 120,
    ],
];
