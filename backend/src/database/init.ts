import { pool } from "./index.js";

export const createTablesSQL = `
-- 1. TABELAS DE DICIONARIO (ENUMS)
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

-- 2. TABELAS DE NEGOCIO
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type_id INTEGER NOT NULL REFERENCES account_types(id) DEFAULT 1,
  balance NUMERIC(12, 2) NOT NULL DEFAULT '0.00',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT 'wallet',
  credit_limit NUMERIC(12, 2),
  closing_day INTEGER,
  due_day INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type_id INTEGER NOT NULL REFERENCES transaction_types(id) DEFAULT 2,
  color TEXT NOT NULL DEFAULT '#EF4444',
  icon TEXT NOT NULL DEFAULT 'tag',
  parent_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  type_id INTEGER NOT NULL REFERENCES transaction_types(id) DEFAULT 2,
  status_id INTEGER NOT NULL REFERENCES transaction_statuses(id) DEFAULT 1,
  date TIMESTAMP NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  destination_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  recurrence_id INTEGER REFERENCES recurrence_types(id) DEFAULT 1,
  installment_number INTEGER,
  total_installments INTEGER,
  raw_bank_notification TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. SEED DOS ENUMS
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
    console.log("✅ Banco de dados e tabelas de dicionário inicializados com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao inicializar banco:", err);
  }
}
