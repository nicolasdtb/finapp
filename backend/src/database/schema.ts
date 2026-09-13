import { pgTable, text, timestamp, numeric, integer, uuid, pgEnum } from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type", [
  "CHECKING",    // Conta Corrente
  "SAVINGS",     // Poupanca / Investimentos
  "CREDIT_CARD", // Cartao de Credito
  "CASH"         // Carteira / Dinheiro fisico
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "INCOME",   // Receita
  "EXPENSE",  // Despesa
  "TRANSFER"  // Transferencia entre contas
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "CONFIRMED",             // Confirmado e consolidado
  "PENDING_CONFIRMATION"   // Capturado automaticamente por notificacao bancaria
]);

export const recurrenceEnum = pgEnum("recurrence_type", [
  "NONE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "ANNUAL",
  "INSTALLMENT"
]);

// 1. Contas e Cartoes
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull().default("CHECKING"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  color: text("color").notNull().default("#3B82F6"),
  icon: text("icon").notNull().default("wallet"),
  // Campos especificos para Cartao de Credito:
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),
  closingDay: integer("closing_day"),
  dueDay: integer("due_day"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Categorias e Subcategorias
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull().default("EXPENSE"), // INCOME ou EXPENSE
  color: text("color").notNull().default("#EF4444"),
  icon: text("icon").notNull().default("tag"),
  parentId: uuid("parent_id"), // Para hierarquia de subcategorias
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Transacoes / Lancamentos
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull().default("EXPENSE"),
  date: timestamp("date").notNull(),
  status: transactionStatusEnum("status").notNull().default("CONFIRMED"),
  
  // Relacionamentos
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  destinationAccountId: uuid("destination_account_id").references(() => accounts.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),

  // Parcelamentos e Recorrencias
  recurrence: recurrenceEnum("recurrence").notNull().default("NONE"),
  installmentNumber: integer("installment_number"),
  totalInstallments: integer("total_installments"),

  // Metadados adicionais (ex: texto bruto da notificacao bancaria que gerou o gasto)
  rawBankNotification: text("raw_bank_notification"),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 4. Orcamentos por Categoria (estilo Minhas Financas)
export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
  monthYear: text("month_year").notNull(), // Formato "YYYY-MM"
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
