# Dicionario de Dados & Estrutura do Banco de Dados: FinApp

Este documento e a referencia oficial de todas as tabelas, colunas, tipos de dados, relacionamentos e enums do FinApp para desenvolvedores, IAs e consultas via DBeaver.

---

## 1. REGRAS ARQUITETURAIS DO BANCO
1. **Primary Keys**: Todos os IDs sao inteiros sequenciais autoincrementais (`SERIAL PRIMARY KEY` no PostgreSQL).
2. **Lookups/ENUMs Tabulares**: Nenhum valor magico (ex: status 1 ou 2) e solto. Todo codigo possui tabela de lookup com `id`, `code` e `name`.
3. **Soft Deletes**: Todas as tabelas de negocio possuem a coluna `deleted_at TIMESTAMP DEFAULT NULL`. Exclusoes atualizam `deleted_at = NOW()`. Queries usam `WHERE deleted_at IS NULL`.

---

## 2. TABELAS DE DICIONARIO / LOOKUP (ENUMs)

### 2.1. `account_types` (Tipos de Contas e Cartoes)
Armazena a classificacao da conta financeira.
| Coluna | Tipo | Descricao / Valores |
| :--- | :--- | :--- |
| `id` | INTEGER PK | `1`: Conta Corrente, `2`: Cartao de Credito, `3`: Poupanca/Investimento, `4`: Dinheiro Fisico |
| `code` | TEXT UNIQUE | `CHECKING`, `CREDIT_CARD`, `SAVINGS`, `CASH` |
| `name` | TEXT | Nome amigavel em portugues |

### 2.2. `transaction_types` (Natureza da Movimentacao)
| Coluna | Tipo | Descricao / Valores |
| :--- | :--- | :--- |
| `id` | INTEGER PK | `1`: Receita, `2`: Despesa, `3`: Transferencia |
| `code` | TEXT UNIQUE | `INCOME`, `EXPENSE`, `TRANSFER` |
| `name` | TEXT | Nome amigavel em portugues |

### 2.3. `transaction_statuses` (Estado de Consolidacao)
| Coluna | Tipo | Descricao / Valores |
| :--- | :--- | :--- |
| `id` | INTEGER PK | `1`: Confirmado, `2`: Pendente de Confirmacao |
| `code` | TEXT UNIQUE | `CONFIRMED`, `PENDING_CONFIRMATION` (usado para compras vindas de notificacoes bancarias) |
| `name` | TEXT | Nome amigavel em portugues |

### 2.4. `recurrence_types` (Padrao de Repeticao)
| Coluna | Tipo | Descricao / Valores |
| :--- | :--- | :--- |
| `id` | INTEGER PK | `1`: Unica, `2`: Diaria, `3`: Semanal, `4`: Mensal, `5`: Anual, `6`: Parcelada |
| `code` | TEXT UNIQUE | `NONE`, `DAILY`, `WEEKLY`, `MONTHLY`, `ANNUAL`, `INSTALLMENT` |
| `name` | TEXT | Nome amigavel em portugues |

---

## 3. TABELAS DE NEGOCIO

### 3.1. `accounts` (Contas Bancarias, Carteiras e Cartoes)
| Coluna | Tipo | Nulo? | Descricao |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL PK | Nao | Identificador unico |
| `name` | TEXT | Nao | Nome (ex: Nubank, Inter, Carteira) |
| `type_id` | INTEGER FK | Nao | Referencia `account_types.id` |
| `balance` | NUMERIC(12,2)| Nao | Saldo atual (default: 0.00) |
| `color` | TEXT | Nao | Cor hexadecimal para interface |
| `icon` | TEXT | Nao | Nome do icone Lucide |
| `credit_limit`| NUMERIC(12,2)| Sim | Limite de credito (se for cartao) |
| `closing_day` | INTEGER | Sim | Dia de fechamento da fatura |
| `due_day` | INTEGER | Sim | Dia de vencimento da fatura |
| `user_id` | INTEGER FK | Sim | Usuario proprietario (fase auth) |
| `created_at` | TIMESTAMP | Nao | Data de criacao |
| `updated_at` | TIMESTAMP | Nao | Data da ultima alteracao |
| `deleted_at` | TIMESTAMP | Sim | Soft delete timestamp |

### 3.2. `categories` (Categorias de Gastos e Receitas)
| Coluna | Tipo | Nulo? | Descricao |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL PK | Nao | Identificador unico |
| `name` | TEXT | Nao | Nome (ex: Alimentacao, Supermercado) |
| `type_id` | INTEGER FK | Nao | Referencia `transaction_types.id` (1=Receita, 2=Despesa) |
| `color` | TEXT | Nao | Cor hexadecimal |
| `icon` | TEXT | Nao | Nome do icone Lucide |
| `parent_id` | INTEGER FK | Sim | Auto-relacionamento para subcategorias |
| `user_id` | INTEGER FK | Sim | Usuario proprietario |
| `created_at` | TIMESTAMP | Nao | Data de criacao |
| `deleted_at` | TIMESTAMP | Sim | Soft delete timestamp |

### 3.3. `tags` (Etiquetas / Marcadores)
| Coluna | Tipo | Nulo? | Descricao |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL PK | Nao | Identificador unico |
| `name` | TEXT | Nao | Nome (ex: Essencial, Viagem, Reforma) |
| `color` | TEXT | Nao | Cor hexadecimal |
| `user_id` | INTEGER FK | Sim | Usuario proprietario |
| `created_at` | TIMESTAMP | Nao | Data de criacao |
| `deleted_at` | TIMESTAMP | Sim | Soft delete timestamp |

### 3.4. `transactions` (Lancamentos Financeiros)
| Coluna | Tipo | Nulo? | Descricao |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL PK | Nao | Identificador unico |
| `description` | TEXT | Nao | Descricao do gasto/receita |
| `amount` | NUMERIC(12,2)| Nao | Valor total da transacao |
| `type_id` | INTEGER FK | Nao | Referencia `transaction_types.id` |
| `status_id` | INTEGER FK | Nao | Referencia `transaction_statuses.id` |
| `date` | TIMESTAMP | Nao | Data da realizacao |
| `account_id` | INTEGER FK | Nao | Conta debitada/creditada (`accounts.id`) |
| `destination_account_id`| INTEGER FK | Sim | Conta de destino (se for transferencia) |
| `category_id`| INTEGER FK | Sim | Categoria (`categories.id`) |
| `recurrence_id`| INTEGER FK| Sim | Referencia `recurrence_types.id` |
| `installment_number`| INTEGER | Sim | Numero da parcela (ex: 2 de 10) |
| `total_installments`| INTEGER | Sim | Total de parcelas |
| `raw_bank_notification`| TEXT | Sim | Texto bruto da notificacao do banco que gerou o gasto |
| `notes` | TEXT | Sim | Observacoes do usuario |
| `user_id` | INTEGER FK | Sim | Usuario criador |
| `created_at` | TIMESTAMP | Nao | Data de criacao |
| `updated_at` | TIMESTAMP | Nao | Data de edicao |
| `deleted_at` | TIMESTAMP | Sim | Soft delete timestamp |

### 3.5. `transaction_items` (Itens Detalhados de Compra / Nota Fiscal)
| Coluna | Tipo | Nulo? | Descricao |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL PK | Nao | Identificador unico do item |
| `transaction_id`| INTEGER FK | Nao | Vinculo com `transactions.id` |
| `name` | TEXT | Nao | Nome do produto (ex: Arroz 5kg) |
| `quantity` | NUMERIC(10,3)| Nao | Quantidade comprada (default 1.000) |
| `unit_price` | NUMERIC(12,2)| Nao | Preco unitario |
| `total_price`| NUMERIC(12,2)| Nao | Preco total do item (qtd * unit_price) |
| `category_id`| INTEGER FK | Sim | Subcategoria do item dentro da compra |
| `created_at` | TIMESTAMP | Nao | Data de inclusao |
| `deleted_at` | TIMESTAMP | Sim | Soft delete timestamp |

### 3.6. `transaction_tags` (Relacionamento Many-to-Many Transacao <-> Tags)
| Coluna | Tipo | Nulo? | Descricao |
| :--- | :--- | :--- | :--- |
| `transaction_id`| INTEGER FK | Nao | Chave composta para `transactions.id` |
| `tag_id` | INTEGER FK | Nao | Chave composta para `tags.id` |

### 3.7. `budgets` (Metas de Gastos / Orcamentos Mensais)
| Coluna | Tipo | Nulo? | Descricao |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL PK | Nao | Identificador unico |
| `category_id`| INTEGER FK | Nao | Vinculo com `categories.id` |
| `month_year` | TEXT | Nao | Mes de referencia formato `YYYY-MM` |
| `target_amount`| NUMERIC(12,2)| Nao | Teto orcamentario estipulado |
| `user_id` | INTEGER FK | Sim | Usuario proprietario |
| `created_at` | TIMESTAMP | Nao | Data de criacao |
| `deleted_at` | TIMESTAMP | Sim | Soft delete timestamp |
