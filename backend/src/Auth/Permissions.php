<?php
declare(strict_types=1);

namespace SoulERP\Auth;

use SoulERP\Http\HttpException;

/**
 * Matriz de permissões. Espelha conceitualmente src/lib/permissions.ts.
 *
 * A FONTE DE VERDADE DE SEGURANÇA é este arquivo (backend). O frontend só
 * usa a matriz dele para esconder botões — nunca para autorizar de fato.
 */
final class Permissions
{
    /** @var array<string, string[]> role => permissions */
    private const MATRIX = [
        'owner' => [
            'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
            'products.view', 'products.edit', 'products.price.edit',
            'orders.view', 'orders.view.all', 'orders.create', 'orders.edit', 'orders.cancel',
            'stock.view', 'stock.adjust',
            'finance.view', 'finance.view.sensitive', 'finance.manage',
            'users.manage', 'company.manage',
        ],
        'admin' => [
            'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
            'products.view', 'products.edit', 'products.price.edit',
            'orders.view', 'orders.view.all', 'orders.create', 'orders.edit', 'orders.cancel',
            'stock.view', 'stock.adjust',
            'finance.view', 'finance.view.sensitive', 'finance.manage',
            'users.manage',
        ],
        'manager' => [
            'customers.view', 'customers.create', 'customers.edit',
            'products.view', 'products.edit',
            'orders.view', 'orders.view.all', 'orders.create', 'orders.edit', 'orders.cancel',
            'stock.view',
        ],
        'seller' => [
            'customers.view', 'customers.create',
            'products.view',
            'orders.view', 'orders.create',
        ],
        'finance' => [
            'customers.view',
            'products.view',
            'orders.view', 'orders.view.all',
            'finance.view', 'finance.view.sensitive', 'finance.manage',
        ],
        'stock' => [
            'products.view',
            'orders.view', 'orders.view.all',
            'stock.view', 'stock.adjust',
        ],
    ];

    public static function has(string $role, string $permission): bool
    {
        return in_array($permission, self::MATRIX[$role] ?? [], true);
    }

    public static function require(AuthenticatedUser $user, string $permission): void
    {
        if (!self::has($user->role, $permission)) {
            throw new HttpException(403, 'FORBIDDEN', 'Permissão insuficiente.');
        }
    }
}
