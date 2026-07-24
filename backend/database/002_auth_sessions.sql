-- SoulERP — Migração 002: sessões de autenticação e rate limit de login.
--
-- Executar MANUALMENTE no phpMyAdmin da Hostinger, na base do SoulERP.
-- Não roda automaticamente. Segura para rodar múltiplas vezes (IF NOT EXISTS).

SET NAMES utf8mb4;

-- Sessões ativas.
-- token_hash = SHA-256 hex (64 chars) do token bruto entregue no cookie.
-- O token bruto NUNCA é gravado. Se o banco vazar, ninguém consegue
-- reconstruir cookies válidos.
CREATE TABLE IF NOT EXISTS auth_sessions (
    id           CHAR(36) PRIMARY KEY,
    user_id      CHAR(36) NOT NULL,
    company_id   CHAR(36) NOT NULL,
    token_hash   CHAR(64) NOT NULL,
    expires_at   TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address   VARCHAR(45) NULL,
    user_agent   VARCHAR(255) NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_as_token (token_hash),
    KEY idx_as_user (user_id),
    KEY idx_as_expires (expires_at),
    CONSTRAINT fk_as_user    FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_as_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate limit de login. Uma linha por tentativa. Limpeza periódica opcional.
CREATE TABLE IF NOT EXISTS login_attempts (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email        VARCHAR(180) NOT NULL,
    ip_address   VARCHAR(45) NOT NULL,
    success      TINYINT(1) NOT NULL DEFAULT 0,
    attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_la_email_time (email, attempted_at),
    KEY idx_la_ip_time    (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
