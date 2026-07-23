<?php
declare(strict_types=1);

namespace SoulERP\Controllers;

use SoulERP\Http\Request;
use SoulERP\Http\Response;

final class HealthController
{
    public function index(Request $_request): void
    {
        // Nada de versão PHP, servidor, DB name, etc. Só status.
        Response::json(['status' => 'ok']);
    }
}
