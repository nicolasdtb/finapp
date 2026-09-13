import { pgTable, text, timestamp, numeric, integer, uuid } from "drizzle-orm/pg-core";

// ==========================================
// 1. TABELAS DE DICIONARIO / ENUM (LOOKUPS)
// ==========================================

export const accountTypes = pgTable("account_types", {
  id: integer("id").primaryKey(), // 1, 2, 3...
  code: text("code").notNull().unique(), // CHECKING, CREDIT_CARD...
  name: text("name").notNull(), // "Conta Corrente", "Cartao de Credito"
});

export const transactionTypes = pgTable("transaction_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(), // INCOME, EXPENSE, TRANSFER
  name: text("name").notNull(), // "Receita", "Despesa", "Transferencia"
});

export const transactionStatuses = pgTable("transaction_statuses", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(), // CONFIRMED, PENDING_CONFIRMATION
  name: text("name").notNull(), // "Confirmado", "Aguardando Confirmacao"
});

export const recurrenceTypes = pgTable("recurrence_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(), // NONE, DAILY, MONTHLY, INSTALLMENT...
  name: text("name").notNull(),
});

// ==========================================
// 2. TABELAS DE NEGOCIO
// ==========================================

// Contas e Cartoes
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  typeId: integer("type_id").references(() => accountTypes.id).notNull().default(1),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  color: text("color").notNull().default("#3B82F6"),
  icon: text("icon").notNull().default("wallet"),
  // Cartao de Credito
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),
  closingDay: integer("closing_day"),
  dueDay: integer("due_day"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Categorias
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  typeId: integer("type_id").references(() => transactionTypes.id).notNull().default(2), // 2 = Despesa
  color: text("color").notNull().default("#EF4444"),
  icon: text("icon").notNull().default("tag"),
  parentId: uuid("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transacoes
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  typeId: integer("type_id").references(() => transactionTypes.id).notNull().default(2),
  statusId: integer("status_id").references(() => transactionStatuses.id).notNull().default(1),
  date: timestamp("date").notNull(),
  
  // Relacionamentos
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  destinationAccountId: uuid("destination_account_id").references(() => accounts.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),

  // Recorrencia e Parcelas
  recurrenceId: integer("recurrence_id").references(() => recurrenceTypes.id).default(1),
  installmentNumber: integer("installment_number"),
  totalInstallments: integer("total_installments"),

  rawBankNotification: text("raw_bank_notification"),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Orcamentos
export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
  monthYear: text("month_year").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
