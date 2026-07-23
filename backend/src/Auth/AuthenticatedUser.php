<?php
declare(strict_types=1);

namespace SoulERP\Auth;

/**
 * Usuário resolvido a partir da sessão + vínculo em company_users.
 * Tudo daqui é confiável do ponto de vista do backend.
 */
final class AuthenticatedUser
{
    public function __construct(
        public readonly string $userId,
        public readonly string $companyId,
        public readonly string $role, // owner|admin|manager|seller|finance|stock
    ) {}
}
