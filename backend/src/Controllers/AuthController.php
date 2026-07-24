<?php
declare(strict_types=1);

namespace SoulERP\Controllers;

use SoulERP\Auth\AuthenticatedUser;
use SoulERP\Auth\PasswordHasher;
use SoulERP\Auth\Session;
use SoulERP\Auth\SessionCookie;
use SoulERP\Auth\SessionStore;
use SoulERP\Auth\TokenGenerator;
use SoulERP\Config\AppConfig;
use SoulERP\Database\Connection;
use SoulERP\Http\HttpException;
use SoulERP\Http\Request;
use SoulERP\Http\Response;
use SoulERP\Services\AuditLogger;
use SoulERP\Services\LoginRateLimiter;
use SoulERP\Validation\V;

/**
 * Login, logout, "quem sou eu" e troca de empresa.
 *
 * Nenhuma resposta vaza se o email existe. Todo caminho de erro devolve
 * mensagem genérica e registra a tentativa em `login_attempts`.
 */
final class AuthController
{
    public function login(Request $request): void
    {
        $body = $request->body ?? [];
        $email    = strtolower((string) V::require($body, 'email'));
        $password = (string) V::require($body, 'password');
        $wantedCompany = V::optional($body, 'companyId'); // opcional

        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
        LoginRateLimiter::check($email, $ip);

        $pdo = Connection::pdo();
        $stmt = $pdo->prepare(
            'SELECT id, name, email, password_hash, active
               FROM users WHERE email = :e LIMIT 1'
        );
        $stmt->execute([':e' => $email]);
        $user = $stmt->fetch();

        // Sempre roda password_verify para não vazar por timing se o email existe.
        $dummyHash = '$2y$12$abcdefghijklmnopqrstuvCTfLnCeBqhtOZFxSlHkKPz/S2rZ.qHK';
        $hash = $user !== false ? (string) $user['password_hash'] : $dummyHash;
        $ok   = PasswordHasher::verify($password, $hash);

        if ($user === false || !$ok || (int) $user['active'] !== 1) {
            LoginRateLimiter::record($email, $ip, false);
            throw new HttpException(401, 'UNAUTHORIZED', 'Email ou senha inválidos.');
        }

        // Empresas ativas do usuário.
        $memberships = $this->listMemberships((string) $user['id']);
        if (count($memberships) === 0) {
            LoginRateLimiter::record($email, $ip, false);
            throw new HttpException(403, 'FORBIDDEN', 'Usuário sem empresa vinculada.');
        }

        $active = $this->pickActiveCompany($memberships, is_string($wantedCompany) ? $wantedCompany : null);

        // Emite sessão.
        $lifetime = (int) AppConfig::get('session.lifetime_seconds', 60 * 60 * 8);
        $raw   = TokenGenerator::raw();
        $csrf  = TokenGenerator::csrf();
        $sid   = SessionStore::create(
            userId: (string) $user['id'],
            companyId: (string) $active['company_id'],
            tokenHash: TokenGenerator::hash($raw),
            lifetimeSeconds: $lifetime,
            ip: $ip,
            userAgent: $_SERVER['HTTP_USER_AGENT'] ?? null,
        );
        SessionCookie::issue($raw, $lifetime, $csrf);
        LoginRateLimiter::record($email, $ip, true);

        AuditLogger::log(
            new AuthenticatedUser((string) $user['id'], (string) $active['company_id'], (string) $active['role']),
            'LOGIN_SUCCESS', 'user', (string) $user['id'],
            null, ['session_id' => $sid],
        );

        Response::json([
            'user' => [
                'id'    => $user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $active['role'],
                'active'=> true,
            ],
            'company'   => ['id' => $active['company_id'], 'name' => $active['company_name']],
            'companies' => array_map(static fn(array $m) => [
                'id' => $m['company_id'], 'name' => $m['company_name'], 'role' => $m['role'],
            ], $memberships),
            'csrf_token' => $csrf, // ecoar no header X-CSRF-Token nas mutações
        ]);
    }

    public function me(Request $request): void
    {
        $user = Session::requireUser($request);
        $memberships = $this->listMemberships($user->userId);

        // Nome/empresa vêm sempre do banco — nunca do frontend.
        $pdo = Connection::pdo();
        $u = $pdo->prepare('SELECT id, name, email, active FROM users WHERE id = :id');
        $u->execute([':id' => $user->userId]);
        $urow = $u->fetch();
        $c = $pdo->prepare('SELECT id, name FROM companies WHERE id = :id');
        $c->execute([':id' => $user->companyId]);
        $crow = $c->fetch();

        if ($urow === false || $crow === false) {
            throw new HttpException(401, 'UNAUTHORIZED', 'Sessão inválida.');
        }

        Response::json([
            'user' => [
                'id'     => $urow['id'],
                'name'   => $urow['name'],
                'email'  => $urow['email'],
                'role'   => $user->role,
                'active' => (int) $urow['active'] === 1,
            ],
            'company'   => ['id' => $crow['id'], 'name' => $crow['name']],
            'companies' => array_map(static fn(array $m) => [
                'id' => $m['company_id'], 'name' => $m['company_name'], 'role' => $m['role'],
            ], $memberships),
        ]);
    }

    public function logout(Request $request): void
    {
        // Tenta identificar a sessão e apagar.
        try {
            Session::requireUser($request);
            $sid = Session::currentSessionId();
            if ($sid !== null) {
                SessionStore::deleteById($sid);
            }
        } catch (HttpException) {
            // Mesmo sem sessão válida limpamos cookies do lado do navegador.
        }
        SessionCookie::clear();
        Response::json(['ok' => true]);
    }

    public function switchCompany(Request $request): void
    {
        $current = Session::requireUser($request);
        $body = $request->body ?? [];
        $companyId = (string) V::require($body, 'companyId');

        // Precisa ter vínculo ativo naquela empresa.
        $stmt = Connection::pdo()->prepare(
            'SELECT cu.role, c.name AS company_name
               FROM company_users cu
               JOIN companies c ON c.id = cu.company_id
              WHERE cu.user_id = :uid AND cu.company_id = :cid
                AND cu.active = 1 AND c.active = 1
              LIMIT 1'
        );
        $stmt->execute([':uid' => $current->userId, ':cid' => $companyId]);
        $row = $stmt->fetch();
        if ($row === false) {
            throw new HttpException(403, 'FORBIDDEN', 'Você não tem acesso a esta empresa.');
        }

        // Rotação: apaga a sessão antiga e emite uma nova para a empresa nova.
        $oldSid = Session::currentSessionId();
        if ($oldSid !== null) {
            SessionStore::deleteById($oldSid);
        }

        $lifetime = (int) AppConfig::get('session.lifetime_seconds', 60 * 60 * 8);
        $raw   = TokenGenerator::raw();
        $csrf  = TokenGenerator::csrf();
        SessionStore::create(
            userId: $current->userId,
            companyId: $companyId,
            tokenHash: TokenGenerator::hash($raw),
            lifetimeSeconds: $lifetime,
            ip: $_SERVER['REMOTE_ADDR'] ?? null,
            userAgent: $_SERVER['HTTP_USER_AGENT'] ?? null,
        );
        SessionCookie::issue($raw, $lifetime, $csrf);

        AuditLogger::log(
            new AuthenticatedUser($current->userId, $companyId, (string) $row['role']),
            'COMPANY_SWITCH', 'company', $companyId,
            ['from' => $current->companyId], ['to' => $companyId],
        );

        Response::json([
            'company'    => ['id' => $companyId, 'name' => $row['company_name']],
            'role'       => $row['role'],
            'csrf_token' => $csrf,
        ]);
    }

    /** @return list<array{company_id:string,company_name:string,role:string}> */
    private function listMemberships(string $userId): array
    {
        $stmt = Connection::pdo()->prepare(
            'SELECT c.id AS company_id, c.name AS company_name, cu.role
               FROM company_users cu
               JOIN companies c ON c.id = cu.company_id
              WHERE cu.user_id = :uid AND cu.active = 1 AND c.active = 1
              ORDER BY c.name'
        );
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll();
    }

    /** @param list<array{company_id:string,role:string,company_name:string}> $memberships */
    private function pickActiveCompany(array $memberships, ?string $wanted): array
    {
        if ($wanted !== null && $wanted !== '') {
            foreach ($memberships as $m) {
                if ($m['company_id'] === $wanted) return $m;
            }
            throw new HttpException(403, 'FORBIDDEN', 'Você não tem acesso a esta empresa.');
        }
        return $memberships[0];
    }
}
