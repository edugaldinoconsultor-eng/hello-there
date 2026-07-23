-- SoulERP — espelho do modelo esperado no MySQL da Hostinger.
--
-- ATENÇÃO: este arquivo é DOCUMENTAÇÃO. Não é executado automaticamente.
-- O banco real já foi criado no hPanel. Este SQL serve para consulta,
-- diffs e recriar o schema em ambiente de teste.
--
-- Convenções:
--   * IDs = CHAR(36) UUID v4.
--   * Dinheiro = DECIMAL(14,2). Nunca FLOAT.
--   * Datas UTC em TIMESTAMP; DATE puro para vencimento/pedido.
--   * Toda tabela de negócio carrega company_id.

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- 1. Identidade global
CREATE TABLE IF NOT EXISTS users (
    id             CHAR(36) PRIMARY KEY,
    name           VARCHAR(120) NOT NULL,
    email          VARCHAR(180) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    active         TINYINT(1) NOT NULL DEFAULT 1,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Empresas
CREATE TABLE IF NOT EXISTS companies (
    id         CHAR(36) PRIMARY KEY,
    name       VARCHAR(160) NOT NULL,
    document   VARCHAR(20) NULL,
    active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Vínculo usuário × empresa (a role vive AQUI)
CREATE TABLE IF NOT EXISTS company_users (
    id         CHAR(36) PRIMARY KEY,
    company_id CHAR(36) NOT NULL,
    user_id    CHAR(36) NOT NULL,
    role       ENUM('owner','admin','manager','seller','finance','stock') NOT NULL,
    active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_company_user (company_id, user_id),
    KEY idx_user (user_id),
    CONSTRAINT fk_cu_company FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT fk_cu_user    FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Clientes
CREATE TABLE IF NOT EXISTS customers (
    id                 CHAR(36) PRIMARY KEY,
    company_id         CHAR(36) NOT NULL,
    name               VARCHAR(160) NOT NULL,
    fantasy_name       VARCHAR(160) NULL,
    person_type        ENUM('PF','PJ') NULL,
    document           VARCHAR(20) NULL,
    phone              VARCHAR(20) NOT NULL,
    email              VARCHAR(180) NULL,
    address_cep        VARCHAR(9) NULL,
    address_street     VARCHAR(180) NOT NULL,
    address_number     VARCHAR(20) NULL,
    address_complement VARCHAR(120) NULL,
    address_district   VARCHAR(120) NULL,
    address_city       VARCHAR(120) NULL,
    address_state      CHAR(2) NULL,
    seller_id          CHAR(36) NULL,
    price_table        ENUM('atacado','varejo','vip','diamante') NULL,
    credit_limit       DECIMAL(14,2) NULL,
    payment_term       VARCHAR(30) NULL,
    notes              TEXT NULL,
    active             TINYINT(1) NOT NULL DEFAULT 1,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_c_name (company_id, name),
    KEY idx_c_doc  (company_id, document),
    KEY idx_c_sell (company_id, seller_id),
    CONSTRAINT fk_c_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Produtos
CREATE TABLE IF NOT EXISTS products (
    id            CHAR(36) PRIMARY KEY,
    company_id    CHAR(36) NOT NULL,
    sku           VARCHAR(60) NOT NULL,
    name          VARCHAR(180) NOT NULL,
    category      VARCHAR(80) NULL,
    price         DECIMAL(14,2) NOT NULL DEFAULT 0,
    stock         INT NOT NULL DEFAULT 0,
    minimum_stock INT NOT NULL DEFAULT 0,
    active        TINYINT(1) NOT NULL DEFAULT 1,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_p_sku (company_id, sku),
    CONSTRAINT fk_p_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Pedidos
CREATE TABLE IF NOT EXISTS orders (
    id                     CHAR(36) PRIMARY KEY,
    order_number           VARCHAR(20) NOT NULL,
    company_id             CHAR(36) NOT NULL,
    customer_id            CHAR(36) NOT NULL,
    seller_id              CHAR(36) NULL,
    status                 ENUM('draft','confirmed','invoiced','delivered','cancelled') NOT NULL DEFAULT 'draft',
    sale_type              ENUM('balcao','entrega','representante') NOT NULL DEFAULT 'balcao',
    order_date             DATE NOT NULL,
    expected_delivery_date DATE NULL,
    subtotal               DECIMAL(14,2) NOT NULL DEFAULT 0,
    discount               DECIMAL(14,2) NOT NULL DEFAULT 0,
    freight                DECIMAL(14,2) NOT NULL DEFAULT 0,
    total                  DECIMAL(14,2) NOT NULL DEFAULT 0,
    payment_condition      VARCHAR(60) NULL,
    notes                  TEXT NULL,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_o_num (company_id, order_number),
    KEY idx_o_cust (company_id, customer_id),
    KEY idx_o_sell (company_id, seller_id),
    CONSTRAINT fk_o_company  FOREIGN KEY (company_id)  REFERENCES companies(id),
    CONSTRAINT fk_o_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Itens do pedido
CREATE TABLE IF NOT EXISTS order_items (
    id                    CHAR(36) PRIMARY KEY,
    order_id              CHAR(36) NOT NULL,
    product_id            CHAR(36) NOT NULL,
    product_name_snapshot VARCHAR(180) NOT NULL,
    sku_snapshot          VARCHAR(60) NULL,
    category_snapshot     VARCHAR(80) NULL,
    quantity              INT NOT NULL,
    unit_price            DECIMAL(14,2) NOT NULL,
    discount              DECIMAL(14,2) NOT NULL DEFAULT 0,
    subtotal              DECIMAL(14,2) NOT NULL,
    stock_at_order        INT NULL,
    KEY idx_oi_order (order_id),
    CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Parcelas do pedido
CREATE TABLE IF NOT EXISTS order_installments (
    id                 CHAR(36) PRIMARY KEY,
    order_id           CHAR(36) NOT NULL,
    installment_number INT NOT NULL,
    due_date           DATE NOT NULL,
    amount             DECIMAL(14,2) NOT NULL,
    status             ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
    paid               TINYINT(1) NOT NULL DEFAULT 0,
    paid_at            TIMESTAMP NULL,
    KEY idx_oip_order (order_id),
    CONSTRAINT fk_oip_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Entregas
CREATE TABLE IF NOT EXISTS order_deliveries (
    id               CHAR(36) PRIMARY KEY,
    order_id         CHAR(36) NOT NULL,
    type             ENUM('balcao','entrega','representante') NOT NULL,
    address_snapshot JSON NULL,
    freight          DECIMAL(14,2) NOT NULL DEFAULT 0,
    scheduled_for    DATE NULL,
    delivered_at     TIMESTAMP NULL,
    notes            TEXT NULL,
    CONSTRAINT fk_od_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Movimentações de estoque (futuro)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id             CHAR(36) PRIMARY KEY,
    company_id     CHAR(36) NOT NULL,
    product_id     CHAR(36) NOT NULL,
    type           ENUM('IN','OUT','ADJUSTMENT','RETURN','TRANSFER') NOT NULL,
    quantity       INT NOT NULL,
    reference_type VARCHAR(40) NULL,
    reference_id   CHAR(36) NULL,
    created_by     CHAR(36) NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_im (company_id, product_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Contas a receber (futuro)
CREATE TABLE IF NOT EXISTS accounts_receivable (
    id             CHAR(36) PRIMARY KEY,
    company_id     CHAR(36) NOT NULL,
    customer_id    CHAR(36) NOT NULL,
    order_id       CHAR(36) NULL,
    installment_id CHAR(36) NULL,
    due_date       DATE NOT NULL,
    amount         DECIMAL(14,2) NOT NULL,
    amount_paid    DECIMAL(14,2) NOT NULL DEFAULT 0,
    status         ENUM('open','partial','paid','overdue','renegotiated','cancelled') NOT NULL DEFAULT 'open',
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Pagamentos (futuro) — estorno = amount negativo, jamais UPDATE
CREATE TABLE IF NOT EXISTS payments (
    id                     CHAR(36) PRIMARY KEY,
    company_id             CHAR(36) NOT NULL,
    accounts_receivable_id CHAR(36) NOT NULL,
    method                 ENUM('pix','dinheiro','boleto','cartao','transferencia') NOT NULL,
    amount                 DECIMAL(14,2) NOT NULL,
    paid_at                TIMESTAMP NOT NULL,
    notes                  TEXT NULL,
    created_by             CHAR(36) NOT NULL,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id          CHAR(36) PRIMARY KEY,
    company_id  CHAR(36) NOT NULL,
    user_id     CHAR(36) NOT NULL,
    action      VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id   CHAR(36) NOT NULL,
    diff        JSON NULL,
    ip          VARCHAR(45) NULL,
    user_agent  VARCHAR(255) NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_al_company (company_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
