# Módulo Financeiro — SoulERP

Documento de referência do módulo, escrito **antes do código**. Nada aqui
altera clientes, produtos, pedidos, orçamento, estoque ou autenticação — o
módulo é **aditivo**, no mesmo padrão usado no Estoque.

Stack: PHP 8.3 + MySQL na Hostinger, IDs `BIGINT UNSIGNED AUTO_INCREMENT`,
empresa sempre vinda da sessão, cookie HttpOnly + CSRF nas mutações,
API em `/api/v1`, frontend com `credentials: 'include'`.

---

## 1. Conceito

O Financeiro é um **livro-razão de recebíveis e pagáveis**. Ele não recalcula
pedidos: consome o que o módulo de Pedidos já produziu (`order_installments`)
e passa a ser a fonte de verdade do que foi cobrado, pago e está em aberto.

| Visão | Fonte | Descrição |
|-------|-------|-----------|
| **Contas a receber** | `accounts_receivable` | Um título por parcela/cobrança de cliente |
| **Contas a pagar** | `accounts_payable` | Despesas, fornecedores, custos fixos |
| **Baixas / pagamentos** | `financial_payments` | Lançamentos imutáveis de recebimento ou pagamento |
| **Fluxo de caixa** | agregação das tabelas acima | Realizado (por `paid_at`) e previsto (por `due_date`) |

**Regra de ouro:** o saldo de um título nunca é editado à mão. Ele é sempre
derivado de `amount − SUM(financial_payments.amount)`. Estorno é um novo
lançamento com valor negativo — jamais `UPDATE` ou `DELETE` de pagamento.

Dinheiro em `DECIMAL(14,2)`. Nunca `FLOAT`. No backend a aritmética passa por
`SoulERP\Support\Money` (centavos inteiros), como já é feito em Pedidos.

---

## 2. Estados do título

```text
open ──parcial──> partial ──quita──> paid
 │                   │
 │                   └──vence──> overdue ──quita──> paid
 ├──vence──> overdue
 ├──renegocia──> renegotiated (gera novos títulos filhos)
 └──cancela──> cancelled
```

| Status | Significado |
|--------|-------------|
| `open` | Emitido, nada recebido/pago |
| `partial` | Recebido/pago parcialmente |
| `paid` | Quitado (`amount_paid >= amount`) |
| `overdue` | `due_date < hoje` e ainda não quitado |
| `renegotiated` | Substituído por novos títulos |
| `cancelled` | Anulado (pedido cancelado, erro de lançamento) |

`overdue` é **derivado em consulta**, não persistido por cron — evita depender
de agendador na Hostinger. O status gravado guarda apenas o ciclo de quitação.

---

## 3. Regras de negócio

1. Toda operação é escopada por `company_id` da **sessão**. Nunca do payload.
2. Título de outra empresa retorna `404 NOT_FOUND` (isolamento multi-empresa).
3. Baixa maior que o saldo em aberto é rejeitada com `422 AMOUNT_EXCEEDS_BALANCE`.
4. Baixa em título `cancelled` ou `renegotiated` é rejeitada (`422 INVALID_STATE`).
5. Pagamento nunca é editado nem apagado. Estorno = novo lançamento negativo,
   com `notes` obrigatório.
6. `amount_paid` e `status` do título são recalculados dentro da **mesma
   transação** da baixa, com `SELECT ... FOR UPDATE` no título (mesmo padrão
   do `InventoryRepository`).
7. Cancelar um pedido cancela os títulos abertos vinculados; títulos com
   pagamento já registrado **não** são cancelados — exigem estorno explícito.
8. Renegociação: título original vai para `renegotiated` e gera N títulos
   novos com `parent_id` apontando para ele. Soma dos filhos = saldo em aberto.
9. Toda mutação grava `AuditLogger` (`AR_CREATED`, `AR_PAYMENT_CREATED`,
   `AR_CANCELLED`, `AP_CREATED`, `AP_PAYMENT_CREATED`, `AR_RENEGOTIATED`).
10. Valores sensíveis (custo, margem, saldo devedor consolidado do cliente) só
    aparecem para quem tem `finance.view.sensitive`.

---

## 4. Tabelas necessárias

Migration `backend/database/006_financial.sql`, idempotente
(`CREATE TABLE IF NOT EXISTS`), InnoDB, utf8mb4, sem tocar em tabela existente.

### 4.1 `accounts_receivable`

```text
id                 BIGINT UNSIGNED AUTO_INCREMENT PK
company_id         BIGINT UNSIGNED NOT NULL
customer_id        BIGINT UNSIGNED NOT NULL
order_id           BIGINT UNSIGNED NULL      -- origem, quando vier de pedido
installment_id     BIGINT UNSIGNED NULL      -- parcela de origem
parent_id          BIGINT UNSIGNED NULL      -- renegociação

description        VARCHAR(180) NOT NULL
due_date           DATE NOT NULL
issue_date         DATE NOT NULL
amount             DECIMAL(14,2) NOT NULL
amount_paid        DECIMAL(14,2) NOT NULL DEFAULT 0
status             ENUM('open','partial','paid','renegotiated','cancelled') DEFAULT 'open'
notes              TEXT NULL
created_by         BIGINT UNSIGNED NOT NULL
created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
INDEX (company_id, due_date), INDEX (company_id, customer_id),
INDEX (company_id, status), INDEX (company_id, order_id)
```

### 4.2 `accounts_payable`

```text
id              BIGINT UNSIGNED AUTO_INCREMENT PK
company_id      BIGINT UNSIGNED NOT NULL
supplier_name   VARCHAR(160) NOT NULL     -- fornecedor textual nesta etapa
category        VARCHAR(80) NULL          -- texto livre; tabela de categorias só na etapa 2
description     VARCHAR(180) NOT NULL

due_date        DATE NOT NULL
issue_date      DATE NOT NULL
amount          DECIMAL(14,2) NOT NULL
amount_paid     DECIMAL(14,2) NOT NULL DEFAULT 0
status          ENUM('open','partial','paid','cancelled') DEFAULT 'open'
notes           TEXT NULL
created_by      BIGINT UNSIGNED NOT NULL
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
INDEX (company_id, due_date), INDEX (company_id, status)
```

### 4.3 `financial_payments` (baixas — imutável)

```text
id            BIGINT UNSIGNED AUTO_INCREMENT PK
company_id    BIGINT UNSIGNED NOT NULL
entry_type    ENUM('receivable','payable') NOT NULL
entry_id      BIGINT UNSIGNED NOT NULL       -- id em AR ou AP
method        ENUM('pix','dinheiro','boleto','cartao','transferencia','outro')
amount        DECIMAL(14,2) NOT NULL         -- negativo = estorno
paid_at       DATETIME NOT NULL
notes         VARCHAR(200) NULL
created_by    BIGINT UNSIGNED NOT NULL
created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
INDEX (company_id, entry_type, entry_id), INDEX (company_id, paid_at)
```

### 4.4 Tabelas descartadas nesta etapa

- `financial_categories` — o backend da etapa 1 não lê nem escreve nela.
  Enquanto não houver CRUD de plano de contas, `accounts_payable.category`
  resolve como texto. Entra na migration 007 se necessário.

Sem FKs cruzadas com `orders`/`customers`/`companies`/`users` na primeira
migration: o histórico do projeto mostra que FK em tabela legada com engine ou
tipo divergente gera erro 1467/1215. A integridade é garantida no repositório
(checagem por `company_id` + `SELECT` prévio), como já foi feito no Estoque.


---

## 5. Permissões

Reaproveita a matriz existente (`backend/src/Auth/Permissions.php` +
`src/lib/permissions.ts`), **sem criar perfis novos**:

| Ação | Permissão | Perfis |
|------|-----------|--------|
| Ver títulos, listas e totais | `finance.view` | owner, admin, finance |
| Ver margem/custo/saldo devedor consolidado | `finance.view.sensitive` | owner, admin, finance |
| Criar título, baixar, estornar, cancelar | `finance.receivables.manage` *(nova, a incluir)* | owner, admin, finance |

`finance.receivables.manage` é a única adição à matriz — necessária porque hoje `finance`
só tem permissões de leitura. Frontend esconde botão; o **backend autoriza de
fato** com `Permissions::require`.

`manager` e `seller` continuam **sem** acesso ao Financeiro.

---

## 6. Integração com Pedidos

Vínculo **explícito e não destrutivo** — `OrderRepository` e `OrderController`
não são reescritos.

1. **Geração de títulos:** ao confirmar um pedido, cada linha de
   `order_installments` vira um `accounts_receivable` com `order_id` e
   `installment_id` preenchidos. Idempotente: se já existe título para o par
   (`order_id`, `installment_id`), não duplica.
2. **Etapa 1 (esta):** a geração é acionada por endpoint explícito
   `POST /api/v1/finance/receivables/from-order/{orderId}` e por botão
   "Gerar financeiro" na tela do pedido. Nada roda automático dentro de
   `OrderController`, evitando regressão no fluxo que já funciona.
3. **Etapa 2 (futura):** chamada automática na confirmação do pedido.
4. **Cancelamento de pedido:** títulos abertos vinculados são cancelados;
   títulos com baixa exigem estorno manual.
5. **Leitura reversa:** a tela do pedido mostra o status financeiro
   (em aberto / parcial / quitado) consultando `accounts_receivable` por
   `order_id`.

---

## 7. Endpoints previstos (`/api/v1/finance`)

| Método | Rota | Permissão |
|--------|------|-----------|
| GET | `/finance/summary` | `finance.view` |
| GET | `/finance/receivables` | `finance.view` |
| GET | `/finance/receivables/{id}` | `finance.view` |
| POST | `/finance/receivables` | `finance.receivables.manage` |
| POST | `/finance/receivables/from-order/{orderId}` | `finance.receivables.manage` |
| POST | `/finance/receivables/{id}/payments` | `finance.receivables.manage` |
| POST | `/finance/receivables/{id}/cancel` | `finance.receivables.manage` |
| POST | `/finance/receivables/{id}/renegotiate` | `finance.receivables.manage` |
| GET | `/finance/payables` | `finance.view` |
| POST | `/finance/payables` | `finance.receivables.manage` |
| POST | `/finance/payables/{id}/payments` | `finance.receivables.manage` |
| GET | `/finance/cashflow` | `finance.view` |
| GET | `/finance/categories` | `finance.view` |

Filtros de listagem: `status`, `from`, `to`, `customer_id`, `q`, `overdue=1`,
`page`, `page_size`. Paginação no mesmo formato já usado em Pedidos.

Erros padronizados: `422 AMOUNT_EXCEEDS_BALANCE`, `422 INVALID_STATE`,
`404 NOT_FOUND`, `403 FORBIDDEN`.

---

## 8. Frontend previsto

- `src/services/finance.service.ts` — tipos, mapeamento snake_case ↔ camelCase,
  hooks de leitura e funções de mutação sobre o `apiFetch` central.
- `src/routes/financeiro.tsx` — substitui o EmptyState por abas:
  **Resumo**, **A receber**, **A pagar**, **Fluxo de caixa**.
- `src/components/finance/` — `BaixaModal.tsx`, `NovoTituloModal.tsx`,
  `RenegociarModal.tsx`, `FinanceStatusBadge.tsx`.
- Mantém `RequirePermission permission="finance.view"` já presente na rota.
- Valores exibidos em BRL com as máscaras já existentes em `src/lib/masks.ts`.

---

## 9. Preparação para IA (Soul AI)

O Financeiro é a principal fonte de sinal para a camada de inteligência. Por
isso o modelo já nasce pronto para consulta analítica:

1. **Dados normalizados e datados:** todo evento tem `paid_at`/`due_date` e
   `company_id`, permitindo séries temporais por empresa sem reprocessamento.
2. **Nada de estado destrutivo:** pagamentos e estornos são append-only, então
   é possível reconstruir qualquer data-base ("como estava em 30/06").
3. **Views de leitura previstas** (etapa futura, sem impacto agora):
   `vw_finance_daily` (recebido/pago por dia), `vw_customer_balance`
   (saldo devedor por cliente), `vw_aging` (faixas 0-30, 31-60, 61-90, 90+).
4. **Endpoint de contexto:** `GET /finance/summary` já devolve os agregados que
   a Soul AI consumirá — total em aberto, vencido, a vencer 7/30 dias,
   recebido no mês, ticket médio.
5. **Soul AI nunca acessa o banco direto.** Ela consome os mesmos endpoints
   autenticados, herdando sessão, empresa e permissões. Se o usuário não tem
   `finance.view`, a IA não vê o dado.
6. **Casos de uso alvo:** previsão de caixa, alerta de inadimplência crescente,
   sugestão de cobrança priorizada por valor × atraso × histórico do cliente.

---

## 10. Ordem de execução

1. Documentação (este arquivo) — **feito**.
2. `docs/database-schema.md` e `docs/api-contract.md`: seção Financeiro.
3. Migration `backend/database/006_financial.sql`.
4. `FinanceRepository.php` + `FinanceController.php` + rotas em `api.php`.
5. `finance.service.ts` + telas React.
6. Teste no preview com sessão real e conferência dos totais contra Pedidos.
