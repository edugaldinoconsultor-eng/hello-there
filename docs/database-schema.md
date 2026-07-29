# SoulERP — Esquema de Banco (proposta futura, Hostinger)

Documento de referência. **Nada aqui está implementado.** Descreve como o
backend próprio hospedado na Hostinger deverá modelar os dados que hoje
existem como mocks no frontend.

Regras gerais:
- Toda tabela de negócio carrega `company_id` para isolamento multiempresa.
- Valores monetários → `DECIMAL(14,2)`. **Nunca `FLOAT`.**
- Datas → `TIMESTAMP` UTC. Todo registro tem `created_at` e `updated_at`.
- IDs → `UUID` (v4/v7) ou `BIGINT` autoincremental — decidir no momento da
  implementação, conforme SGBD escolhido (MySQL/MariaDB/Postgres).
- Exclusões preferem soft delete (`active BOOLEAN` ou `deleted_at`) para
  preservar histórico e auditoria.

---

## 1. `users` — identidade global

| Campo          | Tipo         | Notas                                    |
|----------------|--------------|------------------------------------------|
| id             | UUID PK      |                                          |
| name           | VARCHAR(120) | obrigatório                              |
| email          | VARCHAR(180) | UNIQUE, obrigatório                      |
| password_hash  | VARCHAR(255) | bcrypt/argon2, nunca em texto puro       |
| active         | BOOLEAN      | default true                             |
| created_at     | TIMESTAMP    |                                          |
| updated_at     | TIMESTAMP    |                                          |

Nenhuma `role` aqui. Perfil é sempre relação `company_users`.

## 2. `companies`

| Campo      | Tipo         | Notas                                     |
|------------|--------------|-------------------------------------------|
| id         | UUID PK      |                                           |
| name       | VARCHAR(160) | razão social                              |
| document   | VARCHAR(20)  | CNPJ, opcional na criação                 |
| active     | BOOLEAN      |                                           |
| created_at | TIMESTAMP    |                                           |
| updated_at | TIMESTAMP    |                                           |

## 3. `company_users` — vínculo usuário × empresa

**A ROLE VIVE AQUI.** Um mesmo `user_id` pode ser `owner` na empresa A e
`seller` na empresa B.

| Campo      | Tipo         | Notas                                             |
|------------|--------------|---------------------------------------------------|
| id         | UUID PK      |                                                   |
| company_id | UUID FK      | → companies.id                                    |
| user_id    | UUID FK      | → users.id                                        |
| role       | ENUM         | owner, admin, manager, seller, finance, stock     |
| active     | BOOLEAN      |                                                   |
| created_at | TIMESTAMP    |                                                   |

Índices: UNIQUE(`company_id`,`user_id`), INDEX(`user_id`).

## 4. `customers`

Regra definitiva do produto: **os únicos campos obrigatórios são `name`,
`phone` e `address` (pelo menos `street`).** Todo o resto é opcional,
inclusive `document` (CPF/CNPJ).

| Campo             | Tipo          | Obrigatório | Notas                          |
|-------------------|---------------|-------------|--------------------------------|
| id                | UUID PK       | ✓           |                                |
| company_id        | UUID FK       | ✓           |                                |
| name              | VARCHAR(160)  | ✓           |                                |
| fantasy_name      | VARCHAR(160)  |             | apenas PJ                      |
| person_type       | ENUM PF/PJ    |             |                                |
| document          | VARCHAR(20)   |             | **sem UNIQUE global** — só validar formato quando presente |
| phone             | VARCHAR(20)   | ✓           |                                |
| email             | VARCHAR(180)  |             |                                |
| address_cep       | VARCHAR(9)    |             |                                |
| address_street    | VARCHAR(180)  | ✓           |                                |
| address_number    | VARCHAR(20)   |             |                                |
| address_complement| VARCHAR(120)  |             |                                |
| address_district  | VARCHAR(120)  |             |                                |
| address_city      | VARCHAR(120)  |             |                                |
| address_state     | CHAR(2)       |             |                                |
| seller_id         | UUID FK NULL  |             | → users.id                     |
| price_table       | ENUM          |             | atacado, varejo, vip, diamante |
| credit_limit      | DECIMAL(14,2) |             |                                |
| payment_term      | ENUM          |             | a_vista, 7_dias, 30_dias …     |
| notes             | TEXT          |             |                                |
| active            | BOOLEAN       | ✓           |                                |
| created_at        | TIMESTAMP     | ✓           |                                |
| updated_at        | TIMESTAMP     | ✓           |                                |

Índices: INDEX(`company_id`,`name`), INDEX(`company_id`,`document`),
INDEX(`company_id`,`seller_id`).

Endereço pode virar tabela própria (`customer_addresses`) futuramente para
permitir múltiplos endereços de entrega.

## 5. `products`

| Campo         | Tipo          | Notas                              |
|---------------|---------------|------------------------------------|
| id            | UUID PK       |                                    |
| company_id    | UUID FK       |                                    |
| sku           | VARCHAR(60)   | UNIQUE(`company_id`,`sku`)         |
| name          | VARCHAR(180)  |                                    |
| category      | VARCHAR(80)   |                                    |
| price         | DECIMAL(14,2) | preço tabela padrão                |
| stock         | INT           | **derivado**, ver seção 8          |
| minimum_stock | INT           |                                    |
| active        | BOOLEAN       |                                    |
| created_at    | TIMESTAMP     |                                    |
| updated_at    | TIMESTAMP     |                                    |

`stock` é conveniência de leitura. A verdade absoluta são as movimentações
em `inventory_movements` (seção 8). No banco pode ser coluna materializada,
view, ou snapshot atualizado por trigger — decidir depois.

## 6. `orders`

| Campo                   | Tipo          | Notas                                   |
|-------------------------|---------------|-----------------------------------------|
| id                      | UUID PK       |                                         |
| order_number            | VARCHAR(20)   | `PED-YYYY-NNNN`, UNIQUE(`company_id`,`order_number`) |
| company_id              | UUID FK       |                                         |
| customer_id             | UUID FK       |                                         |
| seller_id               | UUID FK NULL  | → users.id                              |
| status                  | ENUM          | draft, confirmed, invoiced, delivered, cancelled |
| sale_type               | ENUM          | balcao, entrega, representante          |
| order_date              | DATE          |                                         |
| expected_delivery_date  | DATE NULL     |                                         |
| subtotal                | DECIMAL(14,2) |                                         |
| discount                | DECIMAL(14,2) |                                         |
| freight                 | DECIMAL(14,2) |                                         |
| total                   | DECIMAL(14,2) | invariante: subtotal - discount + freight |
| payment_condition       | VARCHAR(60)   | descrição livre da condição             |
| notes                   | TEXT          |                                         |
| created_at              | TIMESTAMP     |                                         |
| updated_at              | TIMESTAMP     |                                         |

Cancelamento não deleta — muda `status` e gera `audit_logs`.

## 7. `order_items`

**Snapshots são obrigatórios.** Mudanças futuras no produto NUNCA podem
alterar pedidos antigos.

| Campo                   | Tipo          | Notas                          |
|-------------------------|---------------|--------------------------------|
| id                      | UUID PK       |                                |
| order_id                | UUID FK       | CASCADE                        |
| product_id              | UUID FK       | referência histórica           |
| product_name_snapshot   | VARCHAR(180)  |                                |
| sku_snapshot            | VARCHAR(60)   |                                |
| category_snapshot       | VARCHAR(80)   |                                |
| quantity                | INT           |                                |
| unit_price              | DECIMAL(14,2) | preço praticado                |
| discount                | DECIMAL(14,2) | por item                       |
| subtotal                | DECIMAL(14,2) | (unit_price * quantity) - discount |
| stock_at_order          | INT           | fotografia do estoque na hora  |

## 8. `order_installments`

| Campo               | Tipo          | Notas                                     |
|---------------------|---------------|-------------------------------------------|
| id                  | UUID PK       |                                           |
| order_id            | UUID FK       | CASCADE                                   |
| installment_number  | INT           | 1, 2, 3…                                  |
| due_date            | DATE          |                                           |
| amount              | DECIMAL(14,2) |                                           |
| status              | ENUM          | pending, paid, overdue, cancelled         |
| paid                | BOOLEAN       | conveniência; verdade em `payments`       |
| paid_at             | TIMESTAMP NULL|                                           |

Invariante: `SUM(amount) = orders.total`. Arredondamento de centavos é
resolvido antes da persistência (regra já implementada em
`src/lib/order-calc.ts`).

## 9. `order_deliveries`

| Campo             | Tipo          | Notas                              |
|-------------------|---------------|------------------------------------|
| id                | UUID PK       |                                    |
| order_id          | UUID FK       |                                    |
| type              | ENUM          | balcao, entrega, representante     |
| address_snapshot  | JSON          | endereço no momento da venda       |
| freight           | DECIMAL(14,2) |                                    |
| scheduled_for     | DATE NULL     |                                    |
| delivered_at      | TIMESTAMP NULL|                                    |
| notes             | TEXT          |                                    |

## 10. `inventory_movements` (futuro)

Registro imutável de tudo que entra/sai. `products.stock` é derivado desta
tabela.

| Campo          | Tipo         | Notas                                      |
|----------------|--------------|--------------------------------------------|
| id             | UUID PK      |                                            |
| company_id     | UUID FK      |                                            |
| product_id     | UUID FK      |                                            |
| type           | ENUM         | IN, OUT, ADJUSTMENT, RETURN, TRANSFER      |
| quantity       | INT          | positivo; sinal vem de `type`              |
| reference_type | VARCHAR(40)  | 'order', 'purchase', 'manual', 'return'    |
| reference_id   | UUID NULL    | id do documento que originou               |
| created_by     | UUID FK      | → users.id                                 |
| created_at     | TIMESTAMP    |                                            |

Índices: INDEX(`company_id`,`product_id`,`created_at`).

## 11. `accounts_receivable` (futuro)

Um pedido confirmado gera 1..N contas a receber (normalmente 1 por
`order_installment`).

| Campo           | Tipo          | Notas                                     |
|-----------------|---------------|-------------------------------------------|
| id              | UUID PK       |                                           |
| company_id      | UUID FK       |                                           |
| customer_id     | UUID FK       |                                           |
| order_id        | UUID FK NULL  |                                           |
| installment_id  | UUID FK NULL  | → order_installments.id                   |
| due_date        | DATE          |                                           |
| amount          | DECIMAL(14,2) |                                           |
| amount_paid     | DECIMAL(14,2) | default 0                                 |
| status          | ENUM          | open, partial, paid, overdue, renegotiated, cancelled |
| created_at      | TIMESTAMP     |                                           |
| updated_at      | TIMESTAMP     |                                           |

## 12. `payments` (futuro)

**Nunca** representar pagamento como `boolean` dentro do pedido. Precisamos
de histórico de múltiplos pagamentos, parciais, estornos e renegociações.

| Campo                    | Tipo          | Notas                                     |
|--------------------------|---------------|-------------------------------------------|
| id                       | UUID PK       |                                           |
| company_id               | UUID FK       |                                           |
| accounts_receivable_id   | UUID FK       |                                           |
| method                   | ENUM          | pix, dinheiro, boleto, cartao, transferencia |
| amount                   | DECIMAL(14,2) | positivo = pagamento; negativo = estorno  |
| paid_at                  | TIMESTAMP     |                                           |
| notes                    | TEXT          |                                           |
| created_by               | UUID FK       |                                           |
| created_at               | TIMESTAMP     |                                           |

Estorno é uma linha de `amount` negativo — jamais UPDATE/DELETE em pagamento
anterior.

## 13. `audit_logs`

| Campo         | Tipo         | Notas                                            |
|---------------|--------------|--------------------------------------------------|
| id            | UUID PK      |                                                  |
| company_id    | UUID FK      |                                                  |
| user_id       | UUID FK      | quem executou                                    |
| action        | VARCHAR(60)  | customer.create, order.cancel, price.update …    |
| entity_type   | VARCHAR(40)  | customer, order, product, payment …              |
| entity_id     | UUID         |                                                  |
| diff          | JSON         | { before, after } quando aplicável               |
| ip            | VARCHAR(45)  |                                                  |
| user_agent    | VARCHAR(255) |                                                  |
| created_at    | TIMESTAMP    |                                                  |

Todo endpoint que muta dados sensíveis (pedido, preço, pagamento,
cancelamento, permissão) grava uma linha aqui — responsabilidade do
backend, não do frontend.

---

## Isolamento multiempresa

Toda query de leitura ou escrita deve incluir `WHERE company_id = :ctx`
(ou equivalente via ORM). O `company_id` **não vem do body/query** —
vem do vínculo `company_users` resolvido a partir do token autenticado.
Ver `docs/api-contract.md` §Segurança.

## 14. `inventory_movements` (Estoque — Kardex)

Migration: `backend/database/005_inventory_movements.sql`.

| Campo          | Tipo                | Notas                                              |
|----------------|---------------------|----------------------------------------------------|
| id             | BIGINT UNSIGNED PK  | AUTO_INCREMENT                                      |
| company_id     | BIGINT UNSIGNED     | isolamento multi-empresa                            |
| product_id     | BIGINT UNSIGNED     | produto movimentado                                 |
| type           | ENUM                | IN, OUT, ADJUSTMENT, RETURN, LOSS                   |
| quantity       | INT                 | sempre positivo; em ADJUSTMENT = saldo final        |
| stock_before   | INT                 | saldo antes da movimentação                         |
| stock_after    | INT                 | saldo depois (grava histórico auditável)            |
| reason         | VARCHAR(160)        | motivo obrigatório                                  |
| reference_type | VARCHAR(40) NULL    | 'order' \| 'manual' \| 'import'                     |
| reference_id   | BIGINT UNSIGNED NULL| id do pedido quando reference_type = 'order'        |
| created_by     | BIGINT UNSIGNED     | usuário responsável                                 |
| created_at     | TIMESTAMP           | data/hora                                           |

Linha de movimentação é imutável: correção se faz com nova movimentação,
nunca UPDATE/DELETE. O saldo atual continua em `products.stock` e só muda
dentro da transação que grava a movimentação (`SELECT ... FOR UPDATE`).
