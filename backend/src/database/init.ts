import { pool } from "./index.js";

export const createTablesSQL = `
-- 1. RECRIA TABELAS COM SOFT DELETE (deleted_at)
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transaction_tags CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS recurrence_types CASCADE;
DROP TABLE IF EXISTS transaction_statuses CASCADE;
DROP TABLE IF EXISTS transaction_types CASCADE;
DROP TABLE IF EXISTS account_types CASCADE;

CREATE TABLE account_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE transaction_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE transaction_statuses (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE recurrence_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type_id INTEGER NOT NULL REFERENCES account_types(id) DEFAULT 1,
  balance NUMERIC(12, 2) NOT NULL DEFAULT '0.00',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT 'wallet',
  credit_limit NUMERIC(12, 2),
  closing_day INTEGER,
  due_day INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type_id INTEGER NOT NULL REFERENCES transaction_types(id) DEFAULT 2,
  color TEXT NOT NULL DEFAULT '#EF4444',
  icon TEXT NOT NULL DEFAULT 'tag',
  parent_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748B',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  type_id INTEGER NOT NULL REFERENCES transaction_types(id) DEFAULT 2,
  status_id INTEGER NOT NULL REFERENCES transaction_statuses(id) DEFAULT 1,
  date TIMESTAMP NOT NULL,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  destination_account_id INTEGER REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  recurrence_id INTEGER REFERENCES recurrence_types(id) DEFAULT 1,
  installment_number INTEGER,
  total_installments INTEGER,
  raw_bank_notification TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE transaction_items (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  name TEXT NOT NULL,
  quantity NUMERIC(10, 3) NOT NULL DEFAULT 1.000,
  unit_price NUMERIC(12, 2) NOT NULL,
  total_price NUMERIC(12, 2) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE transaction_tags (
  transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  month_year TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

-- SEED DOS ENUMS
INSERT INTO account_types (id, code, name) VALUES 
  (1, 'CHECKING', 'Conta Corrente'),
  (2, 'CREDIT_CARD', 'Cartão de Crédito'),
  (3, 'SAVINGS', 'Poupança / Investimento'),
  (4, 'CASH', 'Dinheiro Físico / Carteira')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transaction_types (id, code, name) VALUES 
  (1, 'INCOME', 'Receita'),
  (2, 'EXPENSE', 'Despesa'),
  (3, 'TRANSFER', 'Transferência')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transaction_statuses (id, code, name) VALUES 
  (1, 'CONFIRMED', 'Confirmado'),
  (2, 'PENDING_CONFIRMATION', 'Pendente (Notificação Bancária)')
ON CONFLICT (id) DO NOTHING;

INSERT INTO recurrence_types (id, code, name) VALUES 
  (1, 'NONE', 'Única'),
  (2, 'DAILY', 'Diária'),
  (3, 'WEEKLY', 'Semanal'),
  (4, 'MONTHLY', 'Mensal'),
  (5, 'ANNUAL', 'Anual'),
  (6, 'INSTALLMENT', 'Parcelada')
ON CONFLICT (id) DO NOTHING;

-- SEED INICIAL DE CONTAS E CATEGORIAS
INSERT INTO accounts (id, name, type_id, balance, color, icon) VALUES
  (1, 'Nubank (Cartão)', 2, 0.00, '#820AD1', 'credit-card'),
  (2, 'Banco Inter (Principal)', 1, 3500.00, '#FF7A00', 'wallet'),
  (3, 'Carteira (Dinheiro)', 4, 120.00, '#10B981', 'banknote')
ON CONFLICT (id) DO NOTHING;
SELECT setval('accounts_id_seq', 3);

INSERT INTO categories (id, name, type_id, color, icon) VALUES
  (1, 'Alimentação & Restaurante', 2, '#EF4444', 'utensils'),
  (2, 'Supermercado', 2, '#F59E0B', 'shopping-cart'),
  (3, 'Transporte & Combustível', 2, '#3B82F6', 'car'),
  (4, 'Moradia & Contas', 2, '#8B5CF6', 'home'),
  (5, 'Lazer & Entretenimento', 2, '#EC4899', 'film'),
  (6, 'Salário & Renda', 1, '#10B981', 'dollar-sign')
ON CONFLICT (id) DO NOTHING;
SELECT setval('categories_id_seq', 6);

INSERT INTO tags (id, name, color) VALUES
  (1, 'Essencial', '#3B82F6'),
  (2, 'Supérfluo', '#EF4444'),
  (3, 'Trabalho', '#10B981')
ON CONFLICT (id) DO NOTHING;
SELECT setval('tags_id_seq', 3);
`;

export async function initDatabase() {
  try {
    await pool.query(createTablesSQL);
    console.log("✅ Banco de dados recriado com suporte a SOFT DELETES (deleted_at)!");
  } catch (err) {
    console.error("❌ Erro ao inicializar banco:", err);
  }
}
