<?php
/**
 * SoulERP — front-controller.
 *
 * Todo request HTTP entra por aqui. O .htaccess reescreve QUALQUER URL
 * para /index.php mantendo o path original em $_SERVER['REQUEST_URI'].
 *
 * Esta é a ÚNICA pasta que deve ficar exposta em public_html no servidor.
 * Nada aqui deve ler credenciais direto — quem faz isso é o bootstrap.
 */

declare(strict_types=1);

// Caminho para o backend fora do public_html.
// Ajuste conforme a estrutura escolhida no servidor.
$bootstrap = __DIR__ . '/../src/bootstrap.php';
if (!is_file($bootstrap)) {
    // fallback quando o backend fica em ../soulerp-backend/src/
    $bootstrap = __DIR__ . '/../../soulerp-backend/src/bootstrap.php';
}

require $bootstrap;

\SoulERP\Http\Kernel::handle();
