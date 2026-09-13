# PROJECT CONTEXT: FinApp (Controle Financeiro Pessoal)

## 1. Visao Geral do Projeto
Aplicativo de controle financeiro pessoal moderno, responsivo (Mobile First / PWA e Desktop), inspirado no aplicativo **Minhas Financas**.
Hospedado em VM Linux propria acessivel de forma segura via **ZeroTier**, com suporte a sincronizacao continua e cadastro automatico de transacoes via webhook de notificacoes bancarias e leitura de Notas Fiscais (QR Code / Danfe).

---

## 2. Principios de Arquitetura & Stack
- **Monorepo Simples e Limpo**:
  - `backend/`: API REST em Node.js (TypeScript) com Fastify / Express e Drizzle ORM.
  - `frontend/`: Interface Web responsiva PWA (React + Tailwind CSS / Lucide Icons).
  - `docker/`: Configuracoes de conteineres e orquestracao com variaveis em `.env`.
- **Banco de Dados**: PostgreSQL 16 (executando via Docker na VM Linux).
- **Rede e Acesso**: ZeroTier VPN (comunicacao segura entre Celular Android, Computador e VM Linux).
- **Acesso para Analise / Suporte**: DBeaver via IP do ZeroTier da VM na porta 5432.
- **Autenticacao & Multi-usuario (ate 3 usuarios)**:
  - Sistema de Login seguro via JWT e `bcryptjs`.
  - Tabela `users` com soft delete e associacao aos registros financeiros.

---

## 3. REGRAS OBRIGATORIAS DE BANCO DE DADOS (Regras de Ouro para a IA)

### Regra A: Tabelas de Dicionario / ENUMs Tabulares
> Qualquer campo de status, tipo ou discriminador numerico/codigo DEVE possuir uma tabela de lookup dedicada (tabela de dicionario/enum) contendo `id` (inteiro) e `description`/`name` (texto legivel), com Foreign Key apontando para ela.
> - `account_types`: 1=Conta Corrente, 2=Cartao de Credito, 3=Poupanca, 4=Dinheiro
> - `transaction_types`: 1=Receita, 2=Despesa, 3=Transferencia
> - `transaction_statuses`: 1=Confirmado, 2=Pendente (Notificacao Bancaria)
> - `recurrence_types`: 1=Unica, 2=Diaria, 3=Semanal, 4=Mensal, 5=Anual, 6=Parcelada

### Regra B: Todos os IDs de Tabelas DEVEM ser Inteiros (SERIAL)
> Nao utilizar UUIDs. Sempre utilizar inteiros sequenciais autoincrementais (`SERIAL PRIMARY KEY`), facilitando consultas SQL no DBeaver e relatorios.

### Regra C: Soft Deletes Obrigatorios (deleted_at)
> Toda exclusao de dados de negocio (`accounts`, `categories`, `tags`, `transactions`, `transaction_items`, `budgets`) NUNCA deve ser um `DELETE` fisico.
> As tabelas possuem a coluna `deleted_at TIMESTAMP DEFAULT NULL`. A exclusao e feita com `UPDATE tabela SET deleted_at = NOW()`.
> Todas as queries de listagem filtram `WHERE deleted_at IS NULL`.
> No caso de exclusao de transacoes, o saldo da conta e estornado apropriadamente.

---

## 4. Dicionario de Tabelas
O esquema completo e documentado coluna por coluna esta disponivel em:
👉 **`docs/database-schema.md`**

---

## 5. Roteiro de Proximos Passos (Status do Roadmap)

### ✅ FASE 1 - Fundacao Concluida:
- [x] Repositorio Git versionado e conectado ao GitHub.
- [x] Docker Compose multi-servico (Postgres, Backend Fastify, Frontend PWA).
- [x] ZeroTier configurado e conectado entre VM, Windows e Celular Android.
- [x] Modelo relacional com lookups, IDs inteiros e Soft Deletes.
- [x] Detalhamento de itens de compra (Supermercado / NF).
- [x] CRUD completo de contas, categorias, tags e transacoes com auto-calculo de saldo.
- [x] Suporte a seguranca com `.env` para credenciais do Postgres.

---

### ✅ FASE 2 - Autenticacao & Compartilhamento Concluida:
- [x] Tabela `users` com soft delete e campos auditaveis.
- [x] Criptografia de senhas com `bcryptjs` (salt 10).
- [x] Autenticacao baseada em token JWT (`@fastify/jwt`).
- [x] Trava de seguranca limitando no maximo 3 usuarios registrados por instancia.
- [x] Tela de Login & Cadastro mobile-first com alternancia fluida.
- [x] Sessao persistente via `localStorage` e botao de Logout.

---

### 🚀 FASE 3 - Leitura de Nota Fiscal (QR Code / Danfe) - PROXIMA ETAPA:
1. **Scanner de Camera no PWA**:
   - Integrar leitor de QR Code via camera do celular.
   - Ao apontar para o QR Code da NFC-e (nota de supermercado/posto), ler o link da SEFAZ.
2. **Parser de Nota Fiscal no Backend**:
   - Buscar e extrair a lista de produtos (nomes, quantidades e precos unitarios).
   - Preencher automaticamente a transacao e a lista de itens.

---

### 📊 FASE 4 - Relatorios & Graficos Avancados:
- Grafico de pizza por categoria.
- Grafico de evolucao de patrimonico e saldo mensal.
- Gestao de orcamentos mensais com barra de progresso.
