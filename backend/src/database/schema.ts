import { pgTable, text, timestamp, numeric, integer, serial } from "drizzle-orm/pg-core";

// ==========================================
// 1. USUARIOS (AUTENTICACAO & MULTI-USUARIO)
// ==========================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft Delete
});

// ==========================================
// 2. TABELAS DE DICIONARIO / ENUM (LOOKUPS)
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
// 3. TABELAS DE NEGOCIO (COM SOFT DELETE)
// ==========================================

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
  userId: integer("user_id").references(() => users.id), // Criador da conta
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft Delete
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  typeId: integer("type_id").references(() => transactionTypes.id).notNull().default(2),
  color: text("color").notNull().default("#EF4444"),
  icon: text("icon").notNull().default("tag"),
  parentId: integer("parent_id"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft Delete
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748B"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft Delete
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  typeId: integer("type_id").references(() => transactionTypes.id).notNull().default(2),
  statusId: integer("status_id").references(() => transactionStatuses.id).notNull().default(1),
  date: timestamp("date").notNull(),
  
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  destinationAccountId: integer("destination_account_id").references(() => accounts.id),
  categoryId: integer("category_id").references(() => categories.id),

  recurrenceId: integer("recurrence_id").references(() => recurrenceTypes.id).default(1),
  installmentNumber: integer("installment_number"),
  totalInstallments: integer("total_installments"),

  rawBankNotification: text("raw_bank_notification"),
  notes: text("notes"),
  userId: integer("user_id").references(() => users.id), // Quem lançou

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft Delete
});

export const transactionItems = pgTable("transaction_items", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.id).notNull(),
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull().default("1.000"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft Delete
});

export const transactionTags = pgTable("transaction_tags", {
  transactionId: integer("transaction_id").references(() => transactions.id).notNull(),
  tagId: integer("tag_id").references(() => tags.id).notNull(),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  monthYear: text("month_year").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft Delete
});
