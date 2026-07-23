<?php
declare(strict_types=1);

namespace SoulERP\Controllers;

use SoulERP\Auth\Session;
use SoulERP\Http\Request;
use SoulERP\Http\Response;

final class AuthController
{
    public function me(Request $request): void
    {
        $user = Session::requireUser($request);
        Response::json([
            'user' => [
                'id' => $user->userId,
                'company_id' => $user->companyId,
                'role' => $user->role,
            ],
        ]);
    }
}
