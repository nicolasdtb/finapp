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
  - Sistema de Login planejado para a proxima fase (tabela `users`).

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

## 5. Roteiro de Proximos Passos (Roadmap para as Proximas Sessoes)

### ✅ FASE 1 - Fundacao Concluida:
- [x] Repositorio Git versionado e conectado ao GitHub.
- [x] Docker Compose multi-servico (Postgres, Backend Fastify, Frontend PWA).
- [x] ZeroTier configurado e conectado entre VM, Windows e Celular Android.
- [x] Modelo relacional com lookups, IDs inteiros e Soft Deletes.
- [x] Detalhamento de itens de compra (Supermercado / NF).
- [x] CRUD completo de contas, categorias, tags e transacoes com auto-calculo de saldo.
- [x] Suporte a seguranca com `.env` para credenciais do Postgres.

---

### 🚀 FASE 2 - Autenticacao & Compartilhamento (PROXIMA ETAPA):
1. **Tabela `users`**:
   - `id SERIAL PRIMARY KEY`, `name TEXT`, `email TEXT UNIQUE`, `password_hash TEXT`, `created_at`, `deleted_at`.
2. **Backend**:
   - Rotas `/api/v1/auth/register` e `/api/v1/auth/login`.
   - Criptografia com `bcryptjs` e geracao de tokens JWT.
   - Associar `user_id` nas transacoes, contas e categorias.
   - Permitir compartilhar a mesma carteira familiar entre ate 3 usuarios com permissoes simples.
3. **Frontend**:
   - Tela limpa de Login / Cadastro estilo mobile-first.
   - Armazenar token no `localStorage` e manter sessao conectada.

---

### 📷 FASE 3 - Leitura de Nota Fiscal (QR Code / Danfe):
1. **Scanner de Camera no PWA**:
   - Integrar biblioteca de leitura de QR Code (`html5-qrcode` ou nativo do navegador).
   - Ao apontar a camera do celular para o QR Code da nota fiscal (NFC-e do supermercado), extrair a URL da receita estadual (SEFAZ).
2. **Parser de Nota Fiscal no Backend**:
   - O backend busca os dados da nota e extrai: nome dos produtos, quantidades, valores e o total exato, populando automaticamente o modal de itens!

---

### 📊 FASE 4 - Relatorios & Graficos Avancados:
- Grafico de pizza por categoria (onde foi meu dinheiro neste mes?).
- Grafico de evolucao de patrimonico e saldo ao longo dos meses.
- Gestao de orcamentos mensais com barra de progresso (ex: gastei 80% do orcamento de Lazer).
