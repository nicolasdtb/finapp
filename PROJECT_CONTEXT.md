# PROJECT CONTEXT: FinApp (Controle Financeiro Pessoal)

## 1. Visao Geral do Projeto
Aplicativo de controle financeiro pessoal moderno, responsivo (Mobile First / PWA e Desktop), inspirado no aplicativo **Minhas Financas**.
Hospedado em VM Linux propria acessivel de forma segura via **ZeroTier**, com suporte a sincronizacao continua e cadastro automatico de transacoes via webhook de notificacoes bancarias.

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

## 3. REGRA OBRIGATORIA DE BANCO DE DADOS: Tabelas de Dicionario / ENUMs Tabulares
> **IMPORTANTE PARA A IA**: Qualquer campo de status, tipo, categoria de sistema ou discriminador numerico/codigo DEVE possuir uma tabela de lookup dedicada (tabela de dicionario/enum) contendo `id` (inteiro) e `description`/`name` (texto legivel), com Foreign Key apontando para ela.
>
> **Exemplo:** Em vez de guardar apenas `type: 1` ou um enum solto na aplicacao:
> - Tabela `account_types` (`id: 1, code: 'CHECKING', name: 'Conta Corrente'`, `id: 2, code: 'CREDIT_CARD', name: 'Cartao de Credito'`)
> - Tabela `transaction_types` (`id: 1, code: 'INCOME', name: 'Receita'`, `id: 2, code: 'EXPENSE', name: 'Despesa'`)
> - Tabela `transaction_statuses` (`id: 1, code: 'CONFIRMED', name: 'Confirmado'`, `id: 2, code: 'PENDING_CONFIRMATION', name: 'Pendente'`)
>
> Isso garante total clareza, integridade referencial e legibilidade imediata ao consultar o banco via DBeaver, BI ou SQL puro.

---

## 4. Modelo de Dados Principal (Entidades)
1. **Users (Multi-usuario)**:
   - `id`, `name`, `email`, `password_hash`, `created_at`.
2. **Lookup Tables (Tabelas de Dominio / Enum)**:
   - `account_types`: id, code, name
   - `transaction_types`: id, code, name
   - `transaction_statuses`: id, code, name
   - `recurrence_types`: id, code, name
3. **Accounts (Contas/Cartoes)**:
   - `id`, `name`, `type_id` (FK account_types), `balance`, `color`, `icon`, `credit_limit`, `closing_day`, `due_day`, `user_id` (FK users).
4. **Categories (Categorias & Subcategorias)**:
   - `id`, `name`, `type_id` (FK transaction_types), `color`, `icon`, `parent_id`, `user_id` (FK users).
5. **Tags (Etiquetas/Marcadores)**:
   - `id`, `name`, `color`, `user_id` (FK users).
6. **Transactions (Lancamentos)**:
   - `id`, `description`, `amount`, `type_id` (FK transaction_types), `status_id` (FK transaction_statuses), `date`, `account_id`, `destination_account_id`, `category_id`, `recurrence_id`, `installment_number`, `total_installments`, `user_id` (FK users).
7. **Budgets (Orcamentos)**:
   - `id`, `category_id`, `month_year`, `target_amount`, `user_id` (FK users).

---

## 5. Requisitos Funcionais Futuros (Backlog de Fases)
1. **CRUD Completo de Gestao Financeira**:
   - Modal/Tela completa de edicao e remocao de transacoes (com atualizacao de saldo da conta).
   - Gerenciamento de Contas e Cartoes (criar, editar limite/datas, arquivar).
   - Gerenciamento de Categorias e Tags personalizadas com seletor de cor e icone.
   - Opcoes completas para Entradas (Receitas), Saidas (Despesas) e Transferencias.
2. **Autenticacao & Compartilhamento**:
   - Tela de Login / Cadastro simples e segura (com hash bcrypt e token JWT).
   - Permitir que ate 3 usuarios cadastrados possam compartilhar a mesma carteira ou ter espacos separados.
