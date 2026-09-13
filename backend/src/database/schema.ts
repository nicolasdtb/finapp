import { pgTable, text, timestamp, numeric, integer, serial } from "drizzle-orm/pg-core";

// ==========================================
// 1. TABELAS DE DICIONARIO / ENUM (LOOKUPS)
// ==========================================

export const accountTypes = pgTable("account_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

export const transactionTypes = pgTable("transaction_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

export const transactionStatuses = pgTable("transaction_statuses", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

export const recurrenceTypes = pgTable("recurrence_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

// ==========================================
// 2. TABELAS DE NEGOCIO (TODOS OS IDs COMO INTEIROS)
// ==========================================

// Contas e Cartoes
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  typeId: integer("type_id").references(() => accountTypes.id).notNull().default(1),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  color: text("color").notNull().default("#3B82F6"),
  icon: text("icon").notNull().default("wallet"),
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),
  closingDay: integer("closing_day"),
  dueDay: integer("due_day"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Categorias
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  typeId: integer("type_id").references(() => transactionTypes.id).notNull().default(2),
  color: text("color").notNull().default("#EF4444"),
  icon: text("icon").notNull().default("tag"),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tags / Marcadores
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748B"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transacoes / Lancamentos
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  typeId: integer("type_id").references(() => transactionTypes.id).notNull().default(2),
  statusId: integer("status_id").references(() => transactionStatuses.id).notNull().default(1),
  date: timestamp("date").notNull(),
  
  // Relacionamentos
  accountId: integer("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  destinationAccountId: integer("destination_account_id").references(() => accounts.id, { onDelete: "set null" }),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),

  // Recorrencia e Parcelas
  recurrenceId: integer("recurrence_id").references(() => recurrenceTypes.id).default(1),
  installmentNumber: integer("installment_number"),
  totalInstallments: integer("total_installments"),

  rawBankNotification: text("raw_bank_notification"),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Itens da Transacao (Detalhamento de Compras / Supermercado / Nota Fiscal)
export const transactionItems = pgTable("transaction_items", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull().default("1.000"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relacionamento Transacao <-> Tags
export const transactionTags = pgTable("transaction_tags", {
  transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: "cascade" }).notNull(),
  tagId: integer("tag_id").references(() => tags.id, { onDelete: "cascade" }).notNull(),
});

// Orcamentos
export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
  monthYear: text("month_year").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
