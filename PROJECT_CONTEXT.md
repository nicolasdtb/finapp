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
1. **Lookup Tables (Tabelas de Dominio / Enum)**:
   - `account_types`: id, code, name
   - `transaction_types`: id, code, name
   - `transaction_statuses`: id, code, name
   - `recurrence_types`: id, code, name
2. **Accounts (Contas/Cartoes)**:
   - `id`, `name`, `type_id` (FK account_types), `balance`, `color`, `icon`, `credit_limit`, `closing_day`, `due_day`.
3. **Categories (Categorias & Subcategorias)**:
   - `id`, `name`, `type_id` (FK transaction_types), `color`, `icon`, `parent_id`.
4. **Transactions (Lancamentos)**:
   - `id`, `description`, `amount`, `type_id` (FK transaction_types), `status_id` (FK transaction_statuses), `date`, `account_id`, `destination_account_id`, `category_id`, `recurrence_id`, `installment_number`, `total_installments`.
5. **Budgets (Orcamentos)**:
   - `id`, `category_id`, `month_year`, `target_amount`.

---

## 5. Estrutura de Pastas
```text
finapp/
+-- PROJECT_CONTEXT.md          # Manual de bordo e regras de ouro para IA
+-- docker-compose.yml          # Postgres (porta 5432 exposta para DBeaver), Backend e Frontend
+-- backend/                    # Fastify + Drizzle ORM
+-- frontend/                   # Interface PWA Responsiva
+-- docs/                       # Guias (zerotier, dbeaver, notificacoes)
```
