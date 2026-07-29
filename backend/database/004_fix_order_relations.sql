-- 004_fix_order_relations.sql
-- Corrige definitivamente a estrutura e os relacionamentos das tabelas de pedidos.
-- Idempotente: pode ser executado várias vezes com segurança.
-- MySQL 8 / Hostinger.

SET @db := DATABASE();

-- ---------------------------------------------------------------------------
-- 1) Remover TODAS as foreign keys existentes das tabelas de pedidos
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS soulerp_drop_order_fks;
DELIMITER //
CREATE PROCEDURE soulerp_drop_order_fks()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE t VARCHAR(64);
  DECLARE c VARCHAR(64);
  DECLARE cur CURSOR FOR
    SELECT TABLE_NAME, CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'
       AND TABLE_NAME IN ('orders','order_items','order_installments','order_deliveries');
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  drop_loop: LOOP
    FETCH cur INTO t, c;
    IF done = 1 THEN LEAVE drop_loop; END IF;
    SET @s := CONCAT('ALTER TABLE `', t, '` DROP FOREIGN KEY `', c, '`');
    PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END LOOP;
  CLOSE cur;
END //
DELIMITER ;

CALL soulerp_drop_order_fks();
DROP PROCEDURE IF EXISTS soulerp_drop_order_fks;

-- ---------------------------------------------------------------------------
-- 2) Garantir ENGINE=InnoDB
-- ---------------------------------------------------------------------------
ALTER TABLE `orders`              ENGINE = InnoDB;
ALTER TABLE `order_items`         ENGINE = InnoDB;
ALTER TABLE `order_installments`  ENGINE = InnoDB;
ALTER TABLE `order_deliveries`    ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- 3) Tipos das colunas (id auto-increment / order_id BIGINT UNSIGNED)
-- ---------------------------------------------------------------------------
ALTER TABLE `orders`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `order_items`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY COLUMN `order_id` BIGINT UNSIGNED NOT NULL;

ALTER TABLE `order_installments`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY COLUMN `order_id` BIGINT UNSIGNED NOT NULL;

ALTER TABLE `order_deliveries`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY COLUMN `order_id` BIGINT UNSIGNED NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Índices em order_id (necessários para as FKs)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS soulerp_ensure_order_id_index;
DELIMITER //
CREATE PROCEDURE soulerp_ensure_order_id_index(IN tbl VARCHAR(64))
BEGIN
  IF (SELECT COUNT(*) FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl
         AND COLUMN_NAME = 'order_id') = 0 THEN
    SET @s := CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `idx_', tbl, '_order_id` (`order_id`)');
    PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL soulerp_ensure_order_id_index('order_items');
CALL soulerp_ensure_order_id_index('order_installments');
CALL soulerp_ensure_order_id_index('order_deliveries');
DROP PROCEDURE IF EXISTS soulerp_ensure_order_id_index;

-- ---------------------------------------------------------------------------
-- 5) Limpar registros órfãos antes de recriar as FKs
-- ---------------------------------------------------------------------------
DELETE oi FROM `order_items` oi
  LEFT JOIN `orders` o ON o.id = oi.order_id WHERE o.id IS NULL;
DELETE oi FROM `order_installments` oi
  LEFT JOIN `orders` o ON o.id = oi.order_id WHERE o.id IS NULL;
DELETE od FROM `order_deliveries` od
  LEFT JOIN `orders` o ON o.id = od.order_id WHERE o.id IS NULL;

-- ---------------------------------------------------------------------------
-- 6) Recriar foreign keys com ON DELETE CASCADE
-- ---------------------------------------------------------------------------
ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_order_items_order`
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

ALTER TABLE `order_installments`
  ADD CONSTRAINT `fk_order_installments_order`
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

ALTER TABLE `order_deliveries`
  ADD CONSTRAINT `fk_order_deliveries_order`
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 7) Reposicionar AUTO_INCREMENT com MAX(id)+1
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS soulerp_reset_autoinc;
DELIMITER //
CREATE PROCEDURE soulerp_reset_autoinc(IN tbl VARCHAR(64))
BEGIN
  SET @nx := 1;
  SET @s := CONCAT('SELECT IFNULL(MAX(`id`),0) + 1 INTO @nx FROM `', tbl, '`');
  PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  SET @s := CONCAT('ALTER TABLE `', tbl, '` AUTO_INCREMENT = ', @nx);
  PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
END //
DELIMITER ;

CALL soulerp_reset_autoinc('orders');
CALL soulerp_reset_autoinc('order_items');
CALL soulerp_reset_autoinc('order_installments');
CALL soulerp_reset_autoinc('order_deliveries');
DROP PROCEDURE IF EXISTS soulerp_reset_autoinc;

-- Fim da migration 004.
