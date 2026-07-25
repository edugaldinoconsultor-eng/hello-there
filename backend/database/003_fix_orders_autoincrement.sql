-- =====================================================================
-- Migration 003 — Corrige AUTO_INCREMENT das tabelas de pedidos
--
-- Motivo:
--   Erro SQLSTATE[HY000] 1467
--   "Failed to read auto-increment value from storage engine"
--   ocorreu no POST /orders. Sintoma clássico de contador AUTO_INCREMENT
--   corrompido/dessincronizado no InnoDB (pode acontecer após crashes,
--   restores parciais ou imports manuais).
--
-- Correção:
--   - Reforça engine InnoDB e a chave primária BIGINT UNSIGNED AUTO_INCREMENT
--     (idempotente — se já está correto, MySQL trata como no-op).
--   - Reposiciona o próximo AUTO_INCREMENT em 200, garantindo folga
--     acima de qualquer id já existente para produção atual (poucos pedidos).
--
-- Escopo:
--   - Não altera colunas de negócio.
--   - Não altera FKs.
--   - Não toca em application code.
--
-- Como aplicar (Hostinger phpMyAdmin ou CLI):
--   mysql -u USER -p DB_NAME < 003_fix_orders_autoincrement.sql
-- =====================================================================

-- ---------- 1. Diagnóstico (opcional — visualização apenas) ----------
-- Descomente para inspecionar antes de aplicar:
--   SELECT TABLE_NAME, ENGINE, AUTO_INCREMENT
--   FROM information_schema.TABLES
--   WHERE TABLE_SCHEMA = DATABASE()
--     AND TABLE_NAME IN ('orders','order_items','order_installments','order_deliveries');

-- ---------- 2. Garantir engine InnoDB ----------
ALTER TABLE orders              ENGINE = InnoDB;
ALTER TABLE order_items         ENGINE = InnoDB;
ALTER TABLE order_installments  ENGINE = InnoDB;
ALTER TABLE order_deliveries    ENGINE = InnoDB;

-- ---------- 3. Reforçar PK BIGINT UNSIGNED AUTO_INCREMENT ----------
-- MODIFY é idempotente: se a coluna já é BIGINT UNSIGNED AUTO_INCREMENT,
-- o statement passa sem efeito colateral.
ALTER TABLE orders
    MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE order_items
    MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE order_installments
    MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE order_deliveries
    MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

-- ---------- 4. Reposicionar contadores ----------
-- InnoDB só aceita AUTO_INCREMENT >= MAX(id)+1. Usar 200 dá folga segura
-- para qualquer id atual em ambiente de desenvolvimento/produção inicial.
ALTER TABLE orders              AUTO_INCREMENT = 200;
ALTER TABLE order_items         AUTO_INCREMENT = 200;
ALTER TABLE order_installments  AUTO_INCREMENT = 200;
ALTER TABLE order_deliveries    AUTO_INCREMENT = 200;

-- ---------- 5. Verificação final (opcional) ----------
-- SELECT TABLE_NAME, ENGINE, AUTO_INCREMENT
-- FROM information_schema.TABLES
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME IN ('orders','order_items','order_installments','order_deliveries');
