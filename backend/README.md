# SoulERP — Backend PHP 8.3 (Hostinger)

Backend próprio do Soul ERP, preparado para rodar em **Hostinger Hospedagem
Web Premium** (PHP 8.3 + MySQL + Apache/LiteSpeed).

> Nada aqui conecta em banco real automaticamente. Nenhuma credencial vive
> no repositório. O deploy é manual, feito por você no hPanel.

---

## 1. O que este backend é

- API REST versionada em `/api/v1/`.
- PHP 8.3 puro, sem framework pesado. Usa PDO + roteador próprio simples.
- Multiempresa desde o início: toda query de negócio é escopada por
  `company_id` **derivado da sessão** — nunca do frontend.
- Preparado para autenticação com cookie httpOnly + CSRF (não implementado
  ainda; ver §Segurança).
- Espelha as permissões que já existem no frontend
  (`src/lib/permissions.ts`).

## 2. Estrutura de pastas

```
backend/
  public/           ← ÚNICA pasta que deve ficar pública no servidor
    index.php       ← front-controller (todo request cai aqui)
    .htaccess       ← reescreve URLs para index.php + headers de segurança
  src/
    Config/         ← leitura de configuração
    Database/       ← conexão PDO
    Http/           ← Request, Response, Router
    Controllers/    ← camadas HTTP (health, customers, products, orders)
    Services/       ← regras de negócio (order pricing, audit)
    Repositories/   ← acesso a dados (SQL preparado)
    Middleware/     ← autenticação, autorização, CORS, JSON
    Auth/           ← sessão, hashing (preparado)
    Validation/     ← validação de input
    Support/        ← helpers (dinheiro em centavos, uuid, etc.)
  routes/
    api.php         ← declaração dos endpoints
  config/
    config.example.php  ← modelo de config (SEM credenciais)
  database/
    schema.sql      ← espelho do modelo esperado (documentação)
  README.md
```

## 3. Deploy no hPanel da Hostinger — passo a passo (leigo)

> Você vai enviar arquivos para dois lugares diferentes: um público (que a
> internet enxerga) e um privado (que a internet NÃO enxerga).

### 3.1. Enviar arquivos

1. Entre no hPanel da Hostinger → **Gerenciador de Arquivos**.
2. Vá até a pasta `public_html`. Essa é a pasta pública do seu domínio.
3. Suba **apenas o conteúdo da pasta `backend/public/`** para dentro de
   `public_html/` (ou de uma subpasta `public_html/api/` se preferir
   `https://seusite.com/api/v1/health`).
   - Sim: `public_html/index.php`, `public_html/.htaccess`
   - Ou: `public_html/api/index.php`, `public_html/api/.htaccess`
4. Volte um nível (fora de `public_html/`). Suba as pastas `src/`,
   `routes/` e `config/` do backend nesse nível **fora do `public_html`**.
   Exemplo final:
   ```
   /home/USUARIO/
     public_html/         ← só o conteúdo de backend/public/ mora aqui
       index.php
       .htaccess
     soulerp-backend/     ← src/, routes/, config/ moram AQUI (fora do público)
       src/
       routes/
       config/
   ```
5. Isso garante que ninguém acesse `https://seusite.com/config/config.php`
   pela URL. Só o `public/index.php` é exposto.

### 3.2. Configurar credenciais do banco

1. Copie `config/config.example.php` para `config/config.php` **no servidor**
   (nunca no repositório).
2. Abra `config/config.php` pelo Gerenciador de Arquivos → Editar.
3. Preencha as credenciais que a Hostinger deu para você no hPanel →
   **Bancos de Dados → MySQL**:
   ```php
   'db' => [
       'host'     => 'localhost',
       'name'     => 'u123456789_soulerp',
       'user'     => 'u123456789_soul',
       'password' => 'A_SENHA_QUE_A_HOSTINGER_MOSTROU',
       'charset'  => 'utf8mb4',
   ],
   ```
4. Ajuste `'allowed_origins'` para o domínio do seu frontend (ex.:
   `https://app.seudominio.com.br`).
5. Salve. A senha nunca sai do servidor.

### 3.3. Apontar o `index.php` para a config

Abra `public_html/index.php` e confirme que a linha:

```php
require __DIR__ . '/../soulerp-backend/src/bootstrap.php';
```

aponta para a pasta onde você colocou `src/` no passo 3.1. Se sua estrutura
for diferente, ajuste esse caminho.

### 3.4. Testar

Abra no navegador:

```
https://seusite.com/api/v1/health
```

Resposta esperada:

```json
{ "data": { "status": "ok" } }
```

Se aparecer **500 Internal Server Error**:

1. No hPanel → **Avançado → Logs de erro do PHP**. Copie a última linha.
2. Erros comuns:
   - `could not find driver` → habilite a extensão `pdo_mysql` no hPanel →
     Configuração PHP.
   - `SQLSTATE[HY000] [1045] Access denied` → usuário/senha errado em
     `config/config.php`.
   - `SQLSTATE[HY000] [2002] No such file or directory` → `host` deve ser
     `localhost` na Hostinger.
   - `Class not found` → pasta `src/` não está no caminho que o
     `index.php` espera.

### 3.5. Habilitar logs sem vazar dados

Já configurado: em produção o backend responde com mensagem genérica e
grava o detalhe apenas no log do PHP. Nunca ative `display_errors = On`
em produção — deixe `Off` no painel PHP da Hostinger. Se precisar
depurar, defina `SOULERP_ENV=dev` como variável de ambiente PHP para
liberar mensagens detalhadas apenas para você.

## 4. Segurança embutida

- **PDO com prepared statements** e `ATTR_EMULATE_PREPARES = false`.
- **CORS** restrito ao domínio configurado.
- Headers padrão: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Strict-Transport-Security`.
- Erros nunca retornam stack trace para o navegador.
- Preparado para cookie httpOnly + SameSite=Strict + CSRF token (auth
  real ainda não ligada).
- Logs não gravam senha, token, nem valor de header `Authorization`.

## 5. O que **não** está implementado nesta etapa

- Login real (endpoint retorna sessão mock).
- Pagamentos, estoque real, Soul AI.
- Migrations automáticas. `database/schema.sql` existe só como referência.

Ver `routes/api.php` para o catálogo completo dos endpoints já declarados.
