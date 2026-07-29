-- SoulERP — Migration 005: movimentações de estoque (Kardex)
--
-- Idempotente. Não altera nenhuma tabela existente.
-- Padrão de IDs: BIGINT UNSIGNED, igual a orders/order_items (evita erro 1467).
--
-- Aplicar no phpMyAdmin da Hostinger, banco de produção.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_movements (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id     BIGINT UNSIGNED NOT NULL,
    product_id     BIGINT UNSIGNED NOT NULL,
    type           ENUM('IN','OUT','ADJUSTMENT','RETURN','LOSS') NOT NULL,
    quantity       INT NOT NULL,
    stock_before   INT NOT NULL DEFAULT 0,
    stock_after    INT NOT NULL DEFAULT 0,
    reason         VARCHAR(160) NOT NULL,
    reference_type VARCHAR(40) NULL,
    reference_id   BIGINT UNSIGNED NULL,
    created_by     BIGINT UNSIGNED NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_im_company_product (company_id, product_id, created_at),
    KEY idx_im_company_created (company_id, created_at),
    KEY idx_im_reference (company_id, reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Garante engine correta caso a tabela já existisse como MyISAM.
ALTER TABLE inventory_movements ENGINE=InnoDB;

-- Conferência rápida após aplicar:
-- SHOW CREATE TABLE inventory_movements;
-- SELECT COUNT(*) FROM inventory_movements;
