# Módulo Estoque — SoulERP

Documento de referência do módulo. Escrito antes do código e mantido junto
com ele. Nada aqui altera clientes, pedidos, orçamento, autenticação ou os
endpoints já existentes — o módulo é **aditivo**.

## 1. Conceito

Duas visões complementares:

| Visão | Fonte | Descrição |
|-------|-------|-----------|
| **Saldo atual** | `products.stock` / `products.minimum_stock` | Quanto existe hoje de cada produto |
| **Kardex** | `inventory_movements` | Histórico imutável de toda entrada/saída |

**Regra de ouro:** o saldo só muda através de uma movimentação. Nunca se edita
`products.stock` diretamente pela UI de estoque. Toda movimentação registra
usuário responsável, data/hora, motivo e (opcionalmente) o pedido de origem.

## 2. Tipos de movimentação

| Tipo | Sinal | Uso |
|------|-------|-----|
| `IN`         | + | Compra, recebimento de fornecedor |
| `OUT`        | − | Saída manual, venda sem pedido |
| `RETURN`     | + | Devolução de cliente |
| `LOSS`       | − | Perda, quebra, vencimento |
| `ADJUSTMENT` | ± | Acerto de inventário (define o saldo final) |

`quantity` é **sempre positivo**. O sinal é derivado do `type`.
Para `ADJUSTMENT`, `quantity` representa o **saldo final desejado**.

## 3. Regras de negócio

1. `reason` (motivo) é obrigatório em toda movimentação.
2. Saída (`OUT`, `LOSS`) que deixaria o saldo negativo é rejeitada com
   `422 INSUFFICIENT_STOCK`.
3. Produto inativo não aceita movimentação (`422 PRODUCT_INACTIVE`).
4. Produto de outra empresa retorna `404 NOT_FOUND` (isolamento multi-empresa).
5. Movimentação **nunca** é editada ou apagada. Correção = nova movimentação.
6. `stock_before` e `stock_after` são gravados na própria linha — o histórico
   continua auditável mesmo que o saldo mude depois.
7. A gravação roda em transação com `SELECT ... FOR UPDATE` no produto,
   evitando corrida entre dois usuários.

## 4. Permissões

Reaproveita a matriz existente (`src/lib/permissions.ts` e
`backend/src/Auth/Permissions.php`), sem criar perfis novos:

| Ação | Permissão | Perfis |
|------|-----------|--------|
| Ver saldos e histórico | `stock.view`  | owner, admin, manager, stock |
| Registrar movimentação | `stock.adjust`| owner, admin, stock |

Frontend esconde o botão; **backend autoriza de fato** via
`Permissions::require`.

## 5. Vínculo com pedidos

Nesta etapa o vínculo é declarativo: a movimentação pode apontar para um
pedido através de `reference_type = 'order'` + `reference_id = orders.id`.
A tela exibe o número do pedido quando disponível.

A baixa automática de estoque na confirmação do pedido fica para a etapa
seguinte, deliberadamente, para não tocar em `OrderRepository` /
`OrderController`, que já estão estáveis em produção.

## 6. Erros

| HTTP | code | Quando |
|------|------|--------|
| 401 | `UNAUTHENTICATED`   | sem sessão |
| 403 | `FORBIDDEN`         | sem `stock.view` / `stock.adjust` |
| 404 | `NOT_FOUND`         | produto inexistente ou de outra empresa |
| 422 | `VALIDATION_ERROR`  | campo obrigatório ausente / tipo inválido |
| 422 | `INSUFFICIENT_STOCK`| saída maior que o saldo |
| 422 | `PRODUCT_INACTIVE`  | produto desativado |

## 7. Arquitetura

```text
src/routes/estoque.tsx
  ├─ aba Saldos        → useStockBalances()
  ├─ aba Movimentações → useInventoryMovements()
  └─ MovimentacaoModal → inventoryService.createMovement()
              │
              ▼
src/services/inventory.service.ts   (mapeia snake_case ↔ camelCase)
              │  apiFetch — cookie HttpOnly + CSRF
              ▼
backend/routes/api.php
  └─ InventoryController  (Session::requireUser + Permissions + AuditLogger)
        └─ InventoryRepository  (transação + FOR UPDATE)
              └─ MySQL: products, inventory_movements
```

## 8. Migration

`backend/database/005_inventory_movements.sql` — idempotente
(`CREATE TABLE IF NOT EXISTS`), InnoDB, IDs `BIGINT UNSIGNED` para bater com
o padrão já corrigido em `orders` / `order_items`. Não altera tabela alguma
existente.
