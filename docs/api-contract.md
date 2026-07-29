# SoulERP — Contrato da API (proposta futura, Hostinger)

Documento de referência. **Nenhum endpoint está implementado.** Descreve o
contrato HTTP/REST genérico que o backend próprio na Hostinger deverá
oferecer. Frontend não deve depender de SDK proprietário (Supabase,
Lovable Cloud etc.) — apenas `fetch`.

Base URL futura: `https://api.soulerp.com.br` (a definir).

---

## Autenticação

- `POST /auth/login` — recebe `{ email, password }`, devolve token
  (JWT ou cookie httpOnly `Set-Cookie`).
- `POST /auth/logout` — invalida sessão.
- `GET  /auth/me` — devolve `{ user, companies: CompanyMembership[], activeCompanyId }`.
- `POST /auth/switch-company` — recebe `{ companyId }`, valida vínculo
  ativo em `company_users`, devolve novo token com `company_id` embutido.

Todo request autenticado envia `Authorization: Bearer <token>` **ou**
cookie httpOnly. Preferência pela abordagem cookie httpOnly + SameSite,
para reduzir superfície de XSS.

## Formato padrão de resposta

Sucesso:
```json
{ "data": <payload>, "meta": { "page": 1, "total": 42 } }
```
Erro:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { … } } }
```

Códigos de erro padronizados:
`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`,
`INTERNAL_ERROR`.

HTTP status alinhado: 401, 403, 422, 404, 409, 500.

## Endpoints planejados

### Empresas
- `GET    /companies` — empresas do usuário logado.
- `GET    /companies/:id`
- `PATCH  /companies/:id` (permissão `company.manage`)

### Clientes
- `GET    /customers?query=&sellerId=&page=`
- `GET    /customers/:id`
- `POST   /customers` — body mínimo `{ name, phone, address.street }`.
- `PATCH  /customers/:id`
- `DELETE /customers/:id` (permissão `customers.delete`)

### Produtos
- `GET    /products?query=&category=&active=`
- `GET    /products/:id`
- `POST   /products` (permissão `products.edit`)
- `PATCH  /products/:id`
- `PATCH  /products/:id/price` (permissão `products.price.edit`)

### Pedidos
- `GET    /orders?status=&sellerId=&customerId=&from=&to=&page=`
  - Vendedor sem `orders.view.all` recebe apenas os próprios (backend
    aplica a regra; não confia em filtro do cliente).
- `GET    /orders/:id`
- `POST   /orders`
- `PATCH  /orders/:id` (permissão `orders.edit`, respeitando status)
- `POST   /orders/:id/cancel` (permissão `orders.cancel`)

### Financeiro (futuro)
- `GET  /accounts-receivable?status=&from=&to=`
- `POST /payments` — registra pagamento parcial/total
- `POST /payments/:id/refund` — estorno como pagamento negativo

### Estoque (futuro)
- `GET  /inventory/movements?productId=&type=&from=&to=`
- `POST /inventory/movements` — permissão `stock.adjust`

### Soul AI (futuro)
- `POST /ai/query` — recebe pergunta em linguagem natural. O servidor
  resolve o escopo autorizado (ver §Soul AI) antes de qualquer consulta.
  A IA nunca recebe SQL bruto do cliente nem executa contra o banco
  diretamente.

## Paginação, ordenação, filtros

- Query params: `page` (1-based), `pageSize` (default 25, max 200),
  `sort=field:asc|desc`.
- Filtros passam como query params tipados. Nunca aceitar `companyId`
  do cliente para reescrever escopo (ver §Segurança).

## Segurança

Regra dura: **companyId enviado pelo navegador nunca é confiado.**

Toda request autenticada resolve:

1. Sessão válida → `user_id`.
2. `active_company_id` do token (setado no login/switch-company).
3. Vínculo `company_users(user_id, active_company_id, active=true)`
   → determina `role`.
4. Matriz de permissões (espelha `src/lib/permissions.ts`).
5. Autorização do recurso específico:
   - `order.company_id === active_company_id` (obrigatório sempre).
   - Se sem `orders.view.all`, também `order.seller_id === user_id`.

Endpoints devem retornar `403 FORBIDDEN` antes mesmo de consultar o
recurso quando a permissão base falha. `404 NOT_FOUND` para recursos de
outra empresa — nunca vazar existência cross-tenant.

Todo endpoint mutador grava `audit_logs` (ver database-schema §13).

## Idempotência

- `POST /orders` e `POST /payments` aceitam header opcional
  `Idempotency-Key`. Mesma chave dentro de 24h devolve o mesmo resultado
  sem duplicar registro. Evita pedidos duplicados por double-click ou
  retry de rede.

## Versionamento

- Prefixo `/v1/` quando o contrato estabilizar (ainda não).
- Mudanças breaking exigem `/v2/` em paralelo, nunca alteração silenciosa.

---

## Soul AI — fluxo autorizado

```
Usuário
  └─► Soul AI (UI)
        └─► POST /ai/query        (com sessão do usuário)
              └─► Backend Hostinger
                    ├─ resolve user, active_company, role
                    ├─ getAIDataScope(role) → company | team | self | none
                    ├─ compõe queries limitadas ao escopo
                    ├─ (se ação crítica) exige confirmação humana
                    │   antes de mutar
                    └─ devolve apenas dados permitidos
```

A IA nunca:
- recebe credenciais de banco,
- executa SQL vindo do cliente,
- ultrapassa o escopo do usuário que perguntou,
- cancela/edita pedido sem confirmação humana explícita.

## Independência de fornecedor

- Frontend fala apenas HTTP/JSON. Zero SDK proprietário.
- `src/services/*` é a única camada que conhece o transporte. Trocar de
  `mock` para `http` é uma mudança local nesses arquivos.
- Autenticação prefere cookie httpOnly + CSRF token, o que funciona em
  qualquer stack (Node/Express, PHP/Laravel, Go, etc.) que a Hostinger
  suportar no plano final.

---

## Inventory (Estoque)

Sessão obrigatória. Leitura exige `stock.view`; escrita exige `stock.adjust`.
`company_id` nunca vem do cliente — é derivado da sessão.

### `GET /inventory/balances`
Query: `query`, `belowMinimum=1`, `page`, `pageSize`.
```json
[{ "id": 12, "sku": "ABC-1", "name": "Produto", "category": "Bebidas",
   "price": "19.90", "stock": 40, "minimum_stock": 10,
   "last_movement_at": "2026-07-29 21:10:00" }]
```

### `GET /inventory/movements`
Query: `productId`, `type`, `page`, `pageSize`. Ordenado por `id DESC`.
```json
[{ "id": 88, "product_id": 12, "product_name": "Produto", "product_sku": "ABC-1",
   "type": "IN", "quantity": 10, "stock_before": 30, "stock_after": 40,
   "reason": "Recebimento NF 1234", "reference_type": "order",
   "reference_id": 209, "order_number": "PED-2026-0006",
   "user_name": "Ana", "created_at": "2026-07-29 21:10:00" }]
```

### `GET /inventory/products/{id}/movements`
Mesmo shape, filtrado por produto.

### `POST /inventory/movements`
```json
{ "product_id": 12, "type": "OUT", "quantity": 5,
  "reason": "Quebra no transporte",
  "reference_type": "order", "reference_id": 209 }
```
`201` devolve a movimentação criada com `stock_before` / `stock_after`.

Erros: `422 VALIDATION_ERROR`, `422 INSUFFICIENT_STOCK`,
`422 PRODUCT_INACTIVE`, `404 NOT_FOUND`, `403 FORBIDDEN`.
