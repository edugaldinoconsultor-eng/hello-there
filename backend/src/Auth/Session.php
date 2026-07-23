<?php
declare(strict_types=1);

namespace SoulERP\Auth;

use SoulERP\Http\HttpException;
use SoulERP\Http\Request;

/**
 * Sessão do usuário autenticado.
 *
 * Nesta etapa NÃO há login real. A sessão é resolvida via um cabeçalho
 * de desenvolvimento `X-Dev-User` (aceito apenas quando SOULERP_ENV=dev),
 * o que permite testar autorização antes de existir tela de login.
 *
 * Em produção, este resolve() precisa passar a ler o cookie httpOnly
 * `soulerp_sid`, validar contra a tabela de sessões e devolver o vínculo
 * ativo em company_users. Toda a API dependa daqui — nunca do frontend.
 */
final class Session
{
    private static ?AuthenticatedUser $current = null;

    public static function requireUser(Request $request): AuthenticatedUser
    {
        if (self::$current instanceof AuthenticatedUser) {
            return self::$current;
        }
        // TODO produção: ler cookie httpOnly + validar CSRF em métodos mutadores.
        // Placeholder dev-only:
        if (\SoulERP\Config\AppConfig::isDev()) {
            $devUserId = $request->header('x-dev-user');
            $devCompany = $request->header('x-dev-company');
            $devRole = $request->header('x-dev-role');
            if ($devUserId !== null && $devCompany !== null && $devRole !== null) {
                self::$current = new AuthenticatedUser(
                    userId: $devUserId,
                    companyId: $devCompany,
                    role: $devRole,
                );
                return self::$current;
            }
        }
        throw new HttpException(401, 'UNAUTHORIZED', 'Sessão inválida ou expirada.');
    }

    public static function reset(): void
    {
        self::$current = null;
    }
}
