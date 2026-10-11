import { pgTable, text, timestamp, numeric, integer, serial, boolean } from "drizzle-orm/pg-core";

// ==========================================
// 1. USUARIOS (AUTENTICACAO & MULTI-USUARIO)
// ==========================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  webhookToken: text("webhook_token").unique(), // Token proprio do webhook do celular deste usuario
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft Delete
});

// Convites de cadastro (uso unico, com validade), gerados por um administrador
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedBy: integer("used_by").references(() => users.id),
  usedAt: timestamp("used_at"),
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
  notificationBank: text("notification_bank"), // App do banco que envia notificacoes para esta conta (ex.: "Nubank")
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
  importId: text("import_id"),
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

export const transactionItemTags = pgTable("transaction_item_tags", {
  transactionItemId: integer("transaction_item_id").references(() => transactionItems.id).notNull(),
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

export const userSettings = pgTable("user_settings", {
  userId: integer("user_id").references(() => users.id).primaryKey(),
  cycleType: text("cycle_type").notNull().default("salary_transaction"), // 'salary_transaction' | 'fifth_business_day' | 'calendar_month' | 'fixed_day'
  customSalaryDay: integer("custom_salary_day").default(5),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


// Pagamentos de fatura de cartao: uma linha por (cartao, fatura). A fatura e identificada
// pelo mes de vencimento (ref = "AAAA-MM"). O dinheiro sai de fromAccountId como transferencia.
export const cardInvoicePayments = pgTable("card_invoice_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id).notNull(), // o cartao
  ref: text("ref").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  fromAccountId: integer("from_account_id").references(() => accounts.id).notNull(),
  transactionId: integer("transaction_id").references(() => transactions.id),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
});
