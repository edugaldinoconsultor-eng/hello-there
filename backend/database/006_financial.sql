-- ============================================================================
-- SoulERP :: Migration 006 :: Modulo Financeiro
-- ----------------------------------------------------------------------------
-- Cria SOMENTE: accounts_receivable, accounts_payable, financial_payments
--
-- Regras aplicadas:
--   * MySQL Hostinger / InnoDB / utf8mb4_unicode_ci
--   * IDs BIGINT UNSIGNED AUTO_INCREMENT (sem UUID)
--   * company_id BIGINT UNSIGNED em todas as tabelas
--   * Valores monetarios DECIMAL(14,2)
--   * Sem FOREIGN KEY fisica (integridade validada no Repository PHP)
--   * Idempotente: pode rodar mais de uma vez sem erro
--   * Nenhuma tabela existente e alterada
-- ============================================================================

SET NAMES utf8mb4;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- ----------------------------------------------------------------------------
-- 1) accounts_receivable :: titulos a receber (clientes / pedidos)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `accounts_receivable` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `company_id`     BIGINT UNSIGNED NOT NULL,
  `customer_id`    BIGINT UNSIGNED NOT NULL,
  `order_id`       BIGINT UNSIGNED NULL DEFAULT NULL,
  `installment_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `parent_id`      BIGINT UNSIGNED NULL DEFAULT NULL,

  `description`    VARCHAR(180) NOT NULL,
  `issue_date`     DATE NOT NULL,
  `due_date`       DATE NOT NULL,
  `amount`         DECIMAL(14,2) NOT NULL,
  `amount_paid`    DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status`         ENUM('open','partial','paid','renegotiated','cancelled')
                   NOT NULL DEFAULT 'open',
  `notes`          TEXT NULL DEFAULT NULL,

  `created_by`     BIGINT UNSIGNED NOT NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_ar_company_due`      (`company_id`, `due_date`),
  KEY `idx_ar_company_customer` (`company_id`, `customer_id`),
  KEY `idx_ar_company_status`   (`company_id`, `status`),
  KEY `idx_ar_company_order`    (`company_id`, `order_id`),
  KEY `idx_ar_parent`           (`parent_id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2) accounts_payable :: titulos a pagar (fornecedores / despesas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `accounts_payable` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `company_id`    BIGINT UNSIGNED NOT NULL,

  `supplier_name` VARCHAR(160) NOT NULL,
  `category`      VARCHAR(80) NULL DEFAULT NULL,
  `description`   VARCHAR(180) NOT NULL,

  `issue_date`    DATE NOT NULL,
  `due_date`      DATE NOT NULL,
  `amount`        DECIMAL(14,2) NOT NULL,
  `amount_paid`   DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status`        ENUM('open','partial','paid','cancelled')
                  NOT NULL DEFAULT 'open',
  `notes`         TEXT NULL DEFAULT NULL,

  `created_by`    BIGINT UNSIGNED NOT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_ap_company_due`    (`company_id`, `due_date`),
  KEY `idx_ap_company_status` (`company_id`, `status`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3) financial_payments :: baixas (imutaveis; estorno = valor negativo)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `financial_payments` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `company_id` BIGINT UNSIGNED NOT NULL,

  `entry_type` ENUM('receivable','payable') NOT NULL,
  `entry_id`   BIGINT UNSIGNED NOT NULL,

  `method`     ENUM('pix','dinheiro','boleto','cartao','transferencia','outro')
               NOT NULL DEFAULT 'outro',
  `amount`     DECIMAL(14,2) NOT NULL,
  `paid_at`    DATETIME NOT NULL,
  `notes`      VARCHAR(200) NULL DEFAULT NULL,

  `created_by` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_fp_company_entry`   (`company_id`, `entry_type`, `entry_id`),
  KEY `idx_fp_company_paid_at` (`company_id`, `paid_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4) Garantias idempotentes (re-execucao segura em base ja criada)
-- ----------------------------------------------------------------------------
ALTER TABLE `accounts_receivable` ENGINE=InnoDB;
ALTER TABLE `accounts_payable`    ENGINE=InnoDB;
ALTER TABLE `financial_payments`  ENGINE=InnoDB;

-- Fim da migration 006_financial.sql
