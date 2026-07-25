-- =====================================================================
-- Diagnóstico SQLSTATE[HY000] 1467 — tabelas de pedidos
--
-- Este arquivo é somente leitura: NÃO altera banco, NÃO corrige schema,
-- NÃO muda AUTO_INCREMENT. Execute no phpMyAdmin/CLI da Hostinger para
-- confirmar triggers, engine, PK, AUTO_INCREMENT e compatibilidade de FKs.
-- =====================================================================

SET @db := DATABASE();

-- 1. Estado geral das tabelas envolvidas.
SELECT
  TABLE_NAME,
  ENGINE,
  AUTO_INCREMENT,
  TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME IN ('orders', 'order_items', 'order_installments', 'order_deliveries')
ORDER BY TABLE_NAME;

-- 2. Definição das colunas id/order_id/product_id/company_id/customer_id.
SELECT
  TABLE_NAME,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_KEY,
  EXTRA,
  CHARACTER_SET_NAME,
  COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME IN ('orders', 'order_items', 'order_installments', 'order_deliveries', 'products', 'customers', 'companies', 'users')
  AND COLUMN_NAME IN ('id', 'order_id', 'product_id', 'company_id', 'customer_id', 'seller_id', 'user_id')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 3. Triggers existentes nas tabelas de pedidos.
SELECT
  TRIGGER_NAME,
  EVENT_MANIPULATION,
  EVENT_OBJECT_TABLE,
  ACTION_TIMING,
  ACTION_STATEMENT
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = @db
  AND EVENT_OBJECT_TABLE IN ('orders', 'order_items', 'order_installments', 'order_deliveries')
ORDER BY EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION, TRIGGER_NAME;

-- 4. FKs das tabelas de pedidos com comparação de tipos entre origem e destino.
SELECT
  kcu.TABLE_NAME AS child_table,
  kcu.COLUMN_NAME AS child_column,
  child_cols.COLUMN_TYPE AS child_type,
  child_cols.CHARACTER_SET_NAME AS child_charset,
  child_cols.COLLATION_NAME AS child_collation,
  kcu.REFERENCED_TABLE_NAME AS parent_table,
  kcu.REFERENCED_COLUMN_NAME AS parent_column,
  parent_cols.COLUMN_TYPE AS parent_type,
  parent_cols.CHARACTER_SET_NAME AS parent_charset,
  parent_cols.COLLATION_NAME AS parent_collation,
  CASE
    WHEN child_cols.COLUMN_TYPE <> parent_cols.COLUMN_TYPE THEN 'TYPE_MISMATCH'
    WHEN COALESCE(child_cols.CHARACTER_SET_NAME, '') <> COALESCE(parent_cols.CHARACTER_SET_NAME, '') THEN 'CHARSET_MISMATCH'
    WHEN COALESCE(child_cols.COLLATION_NAME, '') <> COALESCE(parent_cols.COLLATION_NAME, '') THEN 'COLLATION_MISMATCH'
    ELSE 'OK'
  END AS compatibility_status,
  rc.CONSTRAINT_NAME,
  rc.UPDATE_RULE,
  rc.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE kcu
JOIN information_schema.COLUMNS child_cols
  ON child_cols.TABLE_SCHEMA = kcu.TABLE_SCHEMA
 AND child_cols.TABLE_NAME = kcu.TABLE_NAME
 AND child_cols.COLUMN_NAME = kcu.COLUMN_NAME
JOIN information_schema.COLUMNS parent_cols
  ON parent_cols.TABLE_SCHEMA = kcu.REFERENCED_TABLE_SCHEMA
 AND parent_cols.TABLE_NAME = kcu.REFERENCED_TABLE_NAME
 AND parent_cols.COLUMN_NAME = kcu.REFERENCED_COLUMN_NAME
JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
  ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
 AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
 AND rc.TABLE_NAME = kcu.TABLE_NAME
WHERE kcu.TABLE_SCHEMA = @db
  AND kcu.TABLE_NAME IN ('orders', 'order_items', 'order_installments', 'order_deliveries')
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME;

-- 5. Apenas possíveis incompatibilidades de FK.
SELECT
  kcu.TABLE_NAME AS child_table,
  kcu.COLUMN_NAME AS child_column,
  child_cols.COLUMN_TYPE AS child_type,
  kcu.REFERENCED_TABLE_NAME AS parent_table,
  kcu.REFERENCED_COLUMN_NAME AS parent_column,
  parent_cols.COLUMN_TYPE AS parent_type,
  child_cols.CHARACTER_SET_NAME AS child_charset,
  parent_cols.CHARACTER_SET_NAME AS parent_charset,
  child_cols.COLLATION_NAME AS child_collation,
  parent_cols.COLLATION_NAME AS parent_collation
FROM information_schema.KEY_COLUMN_USAGE kcu
JOIN information_schema.COLUMNS child_cols
  ON child_cols.TABLE_SCHEMA = kcu.TABLE_SCHEMA
 AND child_cols.TABLE_NAME = kcu.TABLE_NAME
 AND child_cols.COLUMN_NAME = kcu.COLUMN_NAME
JOIN information_schema.COLUMNS parent_cols
  ON parent_cols.TABLE_SCHEMA = kcu.REFERENCED_TABLE_SCHEMA
 AND parent_cols.TABLE_NAME = kcu.REFERENCED_TABLE_NAME
 AND parent_cols.COLUMN_NAME = kcu.REFERENCED_COLUMN_NAME
WHERE kcu.TABLE_SCHEMA = @db
  AND kcu.TABLE_NAME IN ('orders', 'order_items', 'order_installments', 'order_deliveries')
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
  AND (
    child_cols.COLUMN_TYPE <> parent_cols.COLUMN_TYPE
    OR COALESCE(child_cols.CHARACTER_SET_NAME, '') <> COALESCE(parent_cols.CHARACTER_SET_NAME, '')
    OR COALESCE(child_cols.COLLATION_NAME, '') <> COALESCE(parent_cols.COLLATION_NAME, '')
  )
ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME;