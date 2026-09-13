import { db } from "./index.js";
import { accountTypes, transactionTypes, transactionStatuses, recurrenceTypes } from "./schema.js";

export async function seedLookups() {
  console.log("🌱 Populando tabelas de dicionario / ENUMs...");

  await db.insert(accountTypes).values([
    { id: 1, code: "CHECKING", name: "Conta Corrente" },
    { id: 2, code: "CREDIT_CARD", name: "Cartão de Crédito" },
    { id: 3, code: "SAVINGS", name: "Poupança / Investimento" },
    { id: 4, code: "CASH", name: "Dinheiro Físico / Carteira" }
  ]).onConflictDoNothing();

  await db.insert(transactionTypes).values([
    { id: 1, code: "INCOME", name: "Receita" },
    { id: 2, code: "EXPENSE", name: "Despesa" },
    { id: 3, code: "TRANSFER", name: "Transferência" }
  ]).onConflictDoNothing();

  await db.insert(transactionStatuses).values([
    { id: 1, code: "CONFIRMED", name: "Confirmado" },
    { id: 2, code: "PENDING_CONFIRMATION", name: "Pendente (Notificação Bancária)" }
  ]).onConflictDoNothing();

  await db.insert(recurrenceTypes).values([
    { id: 1, code: "NONE", name: "Única" },
    { id: 2, code: "DAILY", name: "Diária" },
    { id: 3, code: "WEEKLY", name: "Semanal" },
    { id: 4, code: "MONTHLY", name: "Mensal" },
    { id: 5, code: "ANNUAL", name: "Anual" },
    { id: 6, code: "INSTALLMENT", name: "Parcelada" }
  ]).onConflictDoNothing();

  console.log("✅ Tabelas de dicionario populadas com sucesso!");
}
