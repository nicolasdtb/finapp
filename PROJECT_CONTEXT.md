# PROJECT CONTEXT: FinApp (Controle Financeiro Pessoal)

## 1. Visao Geral do Projeto
Aplicativo de controle financeiro pessoal moderno, responsivo (Mobile First / PWA e Desktop), inspirado no aplicativo **Minhas Financas**.
Hospedado em VM Linux propria acessivel de forma segura via **ZeroTier**, com suporte a sincronizacao continua e cadastro automatico de transacoes via webhook de notificacoes bancarias e leitura de Notas Fiscais (QR Code / Danfe).

---

## 2. Principios de Arquitetura & Stack
- **Monorepo Simples e Limpo**:
  - `backend/`: API REST em Node.js (TypeScript) com Fastify / Express e Drizzle ORM.
  - `frontend/`: Interface Web responsiva PWA (React + Tailwind CSS / Lucide Icons).
  - `docker/`: Configuracoes de conteineres e orquestracao.
- **Banco de Dados**: PostgreSQL (executando via Docker na VM Linux).
- **Rede e Acesso**: ZeroTier VPN (comunicacao segura entre Celular Android, Computador e VM Linux).
- **Acesso para Analise / Suporte**: Acessivel diretamente via DBeaver usando o IP do ZeroTier da VM na porta 5432.
- **Autenticacao & Multi-usuario (ate 3 usuarios)**:
  - Sistema de Login (JWT / Sessao) com tabela `users`.
  - Suporte a contas compartilhadas entre a familia/parceiro(a) ou dados segregados por `user_id`.

---

## 3. REGRAS OBRIGATORIAS DE BANCO DE DADOS

### Regra A: Tabelas de Dicionario / ENUMs Tabulares
> **IMPORTANTE PARA A IA**: Qualquer campo de status, tipo, categoria de sistema ou discriminador numerico/codigo DEVE possuir uma tabela de lookup dedicada (tabela de dicionario/enum) contendo `id` (inteiro) e `description`/`name` (texto legivel), com Foreign Key apontando para ela.
>
> **Exemplo:** Em vez de guardar apenas `type: 1` ou um enum solto na aplicacao:
> - Tabela `account_types` (`id: 1, code: 'CHECKING', name: 'Conta Corrente'`, `id: 2, code: 'CREDIT_CARD', name: 'Cartao de Credito'`)
> - Tabela `transaction_types` (`id: 1, code: 'INCOME', name: 'Receita'`, `id: 2, code: 'EXPENSE', name: 'Despesa'`)
> - Tabela `transaction_statuses` (`id: 1, code: 'CONFIRMED', name: 'Confirmado'`, `id: 2, code: 'PENDING_CONFIRMATION', name: 'Pendente'`)

### Regra B: Todos os IDs de Tabelas DEVEM ser Inteiros (SERIAL)
> **IMPORTANTE PARA A IA**: Nunca utilizar UUIDs como primary keys. Sempre utilizar inteiros sequenciais (`SERIAL PRIMARY KEY` no PostgreSQL ou `serial("id")` no Drizzle), facilitando a analise no DBeaver e relatorios.

### Regra C: Soft Deletes Obrigatórios
> **IMPORTANTE PARA A IA**: Toda exclusão de dados de negócio (`accounts`, `categories`, `tags`, `transactions`, `transaction_items`, `budgets`) NUNCA deve ser um `DELETE` físico direto no banco de dados.
> As tabelas devem possuir a coluna `deleted_at TIMESTAMP DEFAULT NULL`. A exclusão é feita atualizando `deleted_at = NOW()`. Todas as queries de listagem e leitura devem filtrar `WHERE deleted_at IS NULL`.
> No caso de exclusão de transações, o saldo da conta deve ser estornado apropriadamente.

---

## 4. Modelo de Dados Principal (Entidades)
1. **Users (Multi-usuario)**:
   - `id` (INT), `name`, `email`, `password_hash`, `created_at`, `deleted_at`.
2. **Lookup Tables (Tabelas de Dominio / Enum)**:
   - `account_types`: id, code, name
   - `transaction_types`: id, code, name
   - `transaction_statuses`: id, code, name
   - `recurrence_types`: id, code, name
3. **Accounts (Contas/Cartoes)**:
   - `id` (INT SERIAL), `name`, `type_id` (FK account_types), `balance`, `color`, `icon`, `credit_limit`, `closing_day`, `due_day`, `user_id`, `deleted_at`.
4. **Categories (Categorias & Subcategorias)**:
   - `id` (INT SERIAL), `name`, `type_id` (FK transaction_types), `color`, `icon`, `parent_id`, `user_id`, `deleted_at`.
5. **Tags (Etiquetas/Marcadores)**:
   - `id` (INT SERIAL), `name`, `color`, `user_id`, `deleted_at`.
6. **Transactions (Lancamentos)**:
   - `id` (INT SERIAL), `description`, `amount`, `type_id` (FK transaction_types), `status_id` (FK transaction_statuses), `date`, `account_id`, `destination_account_id`, `category_id`, `recurrence_id`, `installment_number`, `total_installments`, `user_id`, `deleted_at`.
7. **Transaction Items (Composicao de Itens da Despesa / Nota Fiscal)**:
   - `id` (INT SERIAL), `transaction_id` (FK transactions), `name`, `quantity`, `unit_price`, `total_price`, `category_id`, `deleted_at`.
8. **Budgets (Orcamentos)**:
   - `id` (INT SERIAL), `category_id`, `month_year`, `target_amount`, `user_id`, `deleted_at`.
