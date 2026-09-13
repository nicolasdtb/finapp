import { pool } from "./index.js";

export const createTablesSQL = `
-- 1. TABELA DE USUARIOS
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

-- 2. TABELAS DE DICIONARIO (ENUMS)
CREATE TABLE IF NOT EXISTS account_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_statuses (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurrence_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

-- 3. TABELAS DE NEGOCIO
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type_id INTEGER NOT NULL REFERENCES account_types(id) DEFAULT 1,
  balance NUMERIC(12, 2) NOT NULL DEFAULT '0.00',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT 'wallet',
  credit_limit NUMERIC(12, 2),
  closing_day INTEGER,
  due_day INTEGER,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type_id INTEGER NOT NULL REFERENCES transaction_types(id) DEFAULT 2,
  color TEXT NOT NULL DEFAULT '#EF4444',
  icon TEXT NOT NULL DEFAULT 'tag',
  parent_id INTEGER,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748B',
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
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
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS transaction_items (
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

CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  month_year TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  user_id INTEGER REFERENCES users(id),
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
`;

export async function initDatabase() {
  try {
    await pool.query(createTablesSQL);
    console.log("✅ Banco de dados e tabela de usuários inicializados com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao inicializar banco:", err);
  }
}
