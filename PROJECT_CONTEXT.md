# PROJECT CONTEXT: FinApp (Controle Financeiro Pessoal)

## 1. Visao Geral do Projeto
Aplicativo de controle financeiro pessoal moderno, responsivo (Mobile First / PWA e Desktop), inspirado no aplicativo **Minhas Financas**.
Hospedado em VM Linux propria acessivel de forma segura via **ZeroTier**, com suporte a sincronizacao continua e cadastro automatico de transacoes via webhook de notificacoes bancarias.

---

## 2. Principios de Arquitetura & Stack
- **Monorepo Simples e Limpo**:
  - `backend/`: API REST em Node.js (TypeScript) com Fastify / Express e Drizzle ORM / Prisma.
  - `frontend/`: Interface Web responsiva PWA (React + Tailwind CSS / Lucide Icons).
  - `docker/`: Configuracoes de conteineres e orquestracao.
- **Banco de Dados**: PostgreSQL (executando via Docker na VM Linux).
- **Rede e Acesso**: ZeroTier VPN (comunicacao segura entre Celular Android, Computador e VM Linux).
- **Captura de Gastos Bancarios**:
  - Webhook endpoint `/api/v1/webhooks/bank-notification` que recebe payloads de apps de automacao (ex: MacroDroid, Tasker ou micro-app) e extrai com Regex o valor, cartao/conta e estabelecimento para pre-aprovacao de despesa.
  - Suporte a importacao manual de extratos OFX / CSV.

---

## 3. Modelo de Dados Principal (Entidades)
1. **Accounts (Contas/Cartoes)**:
   - `id`, `name` (ex: NuConta, Inter, Dinheiro), `type` (CHECKING, SAVINGS, CREDIT_CARD, CASH), `balance`, `color`, `icon`, `created_at`.
   - Se for cartao de credito: `limit`, `closing_day`, `due_day`.
2. **Categories (Categorias & Subcategorias)**:
   - `id`, `name` (ex: Alimentacao, Moradia, Transporte, Salario), `type` (INCOME, EXPENSE), `icon`, `color`, `parent_id` (para subcategorias).
3. **Transactions (Lancamentos)**:
   - `id`, `description`, `amount`, `type` (INCOME, EXPENSE, TRANSFER), `date`, `category_id`, `account_id`, `destination_account_id` (se for transferencia).
   - `status` (CONFIRMED, PENDING_CONFIRMATION - para gastos vindos de notificacoes bancarias).
   - `recurrence` (NONE, DAILY, WEEKLY, MONTHLY, ANNUAL, INSTALLMENTS).
   - `installment_number`, `total_installments` (para compras parceladas).
4. **Budgets (Orcamentos por Categoria / Mensal)**:
   - `id`, `category_id`, `month_year`, `target_amount`.

---

## 4. Estrutura de Pastas
```text
finapp/
+-- PROJECT_CONTEXT.md          # Este arquivo (Manual de bordo da IA)
+-- docker-compose.yml          # Subida rapida de PostgreSQL, Backend e Frontend na VM
+-- .gitignore
+-- backend/                    # API e Regras de Negocio
+-- frontend/                   # Interface PWA Responsiva
+-- docs/                       # Guias e diagramas
