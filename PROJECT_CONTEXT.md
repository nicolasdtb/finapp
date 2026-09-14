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

### ✅ FASE 4 - Relatorios, Inteligencia & Metas de Orcamento Concluida:
- [x] Isolamento estrito de dados por usuario (`user_id` em todas as consultas e tabelas).
- [x] Motor de Ciclo Financeiro Dinamico (detecta salario real ou calcula 5o dia util).
- [x] Seletor de periodo global no topo (navegacao entre ciclos de salario).
- [x] Barra de navegacao inferior mobile-first nativa com botao central '+'.
- [x] Tela de Relatorios com distribuicao por categorias, taxa de poupanca e Top 5 ofensores.
- [x] Tela de Metas de Orcamento com calculo preditivo de estouro (Burn-Rate) e ritmo diario.
- [x] Webhook inteligente de notificacoes bancarias com identificacao por usuario e match de conta.
- [x] Guia de automacao mobile atualizado (Automate/Tasker/Termux).

---

### ✅ FASE 3 - Leitura de Nota Fiscal (QR Code / NFC-e) Concluida:
- [x] Scanner de camera no PWA com suporte a HTTPS para ler QR Code de notas de compra.
- [x] Parser de itens da SEFAZ para preenchimento automatico de supermercados com itens detalhados.
- [x] Correcao de extracao numerica de quantidades e precos com sanitizacao de rotulos.

---

### ✅ FASE 5 - Importador de Extrato Bancario (OFX / CSV) Concluida:
- [x] Upload de extratos do banco (.csv e .ofx) com preview e selecao de conta.
- [x] Sanitizacao automatica de Mojibake / encoding corrompido (DescriÃ§Ã£o -> Descricao).
- [x] Deteccao inteligente de duplicidade por Identificador unico (UUID / FITID) e Data + Valor.
- [x] Auto-categorizacao por palavras-chave conhecidas (Uber, mercados, farmacias, ifood).
- [x] Atualizacao atomica em lote no banco e ajuste consolidado de saldo com cast ::numeric.
- [x] Correcao de timezone (America/Sao_Paulo) e ajuste manual de saldo em Ajustes > Contas.

---

### 🚀 PROXIMOS PASSOS POTENCIAIS (Backlog / Melhorias Futuras):
1. **Exportacao de Dados (Backup)**:
   - Botao para exportar todas as transacoes cadastradas para CSV / Excel.
2. **Parcelamento de Compras (Recorrencia / Faturas de Cartao)**:
   - Gerador de parcelas automaticas para compras no cartao de credito (ex: 3x de R$ 100).
3. **App PWA Offline Cache (Service Worker)**:
   - Cache de assets estaticos para abertura instantanea em modo aviao.
