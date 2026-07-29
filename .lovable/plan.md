## Módulo ESTOQUE — Plano técnico

Nada de clientes, pedidos, orçamento, autenticação ou endpoints existentes será alterado. O módulo é aditivo.

### 1. Conceito

Duas visões:
- **Saldo atual** — vem de `products.stock` / `products.minimum_stock` (já existe).
- **Kardex (histórico)** — nova tabela `inventory_movements`, fonte de verdade auditável de toda entrada/saída.

Regra: o saldo só muda por movimentação. Toda movimentação registra usuário, data/hora, motivo e referência opcional ao pedido.

### 2. Banco (MySQL / Hostinger)

Nova migration `backend/database/005_inventory_movements.sql`:

```text
inventory_movements
  id              BIGINT UNSIGNED AUTO_INCREMENT PK
  company_id      BIGINT UNSIGNED  NOT NULL
  product_id      BIGINT UNSIGNED  NOT NULL
  type            ENUM('IN','OUT','ADJUSTMENT','RETURN','LOSS')
  quantity        INT NOT NULL            -- sempre positivo
  stock_before    INT NOT NULL
  stock_after     INT NOT NULL
  reason          VARCHAR(160) NOT NULL   -- motivo obrigatório
  reference_type  VARCHAR(40) NULL        -- 'order' | 'manual' | 'import'
  reference_id    BIGINT UNSIGNED NULL    -- id do pedido, quando houver
  created_by      BIGINT UNSIGNED NOT NULL
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  INDEX (company_id, product_id, created_at), INDEX (company_id, reference_type, reference_id)
  ENGINE=InnoDB
```

IDs BIGINT UNSIGNED para bater com o padrão já corrigido em orders/order_items (evita o 1467). A migration é idempotente (`CREATE TABLE IF NOT EXISTS`) e não altera nenhuma tabela existente.

### 3. Backend PHP (novos arquivos, nada sobrescrito)

- `backend/src/Repositories/InventoryRepository.php`
  - `listMovements(companyId, filtros, page, pageSize)`
  - `listBalances(companyId, query, onlyBelowMinimum)` — join leve sobre `products`
  - `createMovement(...)` — dentro de transação: `SELECT ... FOR UPDATE` no produto, calcula `stock_after`, bloqueia saída que deixaria saldo negativo, faz `UPDATE products.stock` e insere o movimento.
- `backend/src/Controllers/InventoryController.php` — usa `Session::requireUser` + `Permissions::require` (`stock.view` para leitura, `stock.adjust` para escrita) exatamente como os controllers atuais. Registra `AuditLogger`.
- `backend/routes/api.php` — apenas **acrescentar** linhas:
  - `GET  /api/v1/inventory/balances`
  - `GET  /api/v1/inventory/movements`
  - `GET  /api/v1/inventory/products/{id}/movements`
  - `POST /api/v1/inventory/movements`
- Estilo conservador já validado no servidor: sem named arguments, sem trailing comma, sem arrow function, variáveis ASCII, `PDO::PARAM_INT` nos ids.

### 4. Frontend

- `src/services/inventory.service.ts` — tipos `StockBalance` e `InventoryMovement`, mapeamento snake_case ↔ camelCase, hooks `useStockBalances()`, `useInventoryMovements()`, e `createMovement()`. Usa o `apiFetch` central (cookie + CSRF já resolvidos).
- `src/services/index.ts` — uma linha de export.
- `src/routes/estoque.tsx` — substitui o EmptyState por duas abas: **Saldos** (busca, badge "abaixo do mínimo", ação Movimentar) e **Movimentações** (histórico com tipo, quantidade, motivo, pedido, usuário, data/hora). Mantém `RequirePermission permission="stock.view"`.
- `src/components/inventory/MovimentacaoModal.tsx` — entrada/saída/ajuste, quantidade, motivo obrigatório, pedido opcional; visível só com `stock.adjust`.
- `src/components/inventory/MovementBadge.tsx` — badge de tipo.

### 5. Documentação (criada antes do código)

- `docs/inventory-module.md` — regras de negócio, estados, permissões por perfil, casos de erro (saldo insuficiente, produto inativo).
- `docs/api-contract.md` — acrescentar a seção Inventory (request/response de cada endpoint).
- `docs/database-schema.md` — acrescentar a tabela `inventory_movements`.

### 6. Vínculo com pedidos

Nesta etapa o vínculo é **somente leitura/manual**: uma movimentação pode apontar para um pedido (`reference_type='order'`), e a tela mostra o número do pedido. A baixa automática de estoque na confirmação do pedido fica para etapa seguinte, para não tocar em `OrderRepository`/`OrderController` que já estão funcionando.

### 7. Ordem de execução

1. Documentação (`docs/*`).
2. Migration 005 + repositório/controller/rotas PHP.
3. Service + telas React.
4. Teste no preview com sessão real.

### Arquivos criados
`docs/inventory-module.md`, `backend/database/005_inventory_movements.sql`, `backend/src/Repositories/InventoryRepository.php`, `backend/src/Controllers/InventoryController.php`, `src/services/inventory.service.ts`, `src/components/inventory/MovimentacaoModal.tsx`, `src/components/inventory/MovementBadge.tsx`

### Arquivos alterados (aditivo)
`backend/routes/api.php`, `src/services/index.ts`, `src/routes/estoque.tsx`, `docs/api-contract.md`, `docs/database-schema.md`
