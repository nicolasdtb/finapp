import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, transactionItems, accounts } from "../../database/schema.js";
import { desc, eq, sql } from "drizzle-orm";

export async function transactionRoutes(app: FastifyInstance) {
  // Listar transacoes completas com itens e conta
  app.get("/", async (request, reply) => {
    const all = await db.select().from(transactions).orderBy(desc(transactions.date));
    
    // Anexa itens a cada transacao
    const items = await db.select().from(transactionItems);
    const txMap = all.map(t => ({
      ...t,
      items: items.filter(i => i.transactionId === t.id)
    }));

    return reply.send(txMap);
  });

  // Criar transacao manual (com suporte a itens detalhados)
  app.post("/", async (request, reply) => {
    const schema = z.object({
      description: z.string().min(1),
      amount: z.string(),
      typeId: z.number().default(2),
      statusId: z.number().default(1),
      date: z.string(),
      accountId: z.number(),
      categoryId: z.number().optional(),
      destinationAccountId: z.number().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        name: z.string().min(1),
        quantity: z.string().default("1"),
        unitPrice: z.string(),
        totalPrice: z.string(),
        categoryId: z.number().optional(),
      })).optional()
    });

    const data = schema.parse(request.body);

    const [created] = await db.insert(transactions).values({
      description: data.description,
      amount: data.amount,
      typeId: data.typeId,
      statusId: data.statusId,
      date: new Date(data.date),
      accountId: data.accountId,
      categoryId: data.categoryId,
      destinationAccountId: data.destinationAccountId,
      notes: data.notes,
    }).returning();

    // Se houver itens detalhados de despesa (ex: compras de supermercado)
    if (data.items && data.items.length > 0) {
      await db.insert(transactionItems).values(
        data.items.map(item => ({
          transactionId: created.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          categoryId: item.categoryId || data.categoryId,
        }))
      );
    }

    // Atualiza saldo da conta automaticamente
    const amountNum = parseFloat(data.amount);
    if (data.typeId === 1) {
      // Receita: soma ao saldo
      await db.update(accounts)
        .set({ balance: sql`${accounts.balance} + ${amountNum}` })
        .where(eq(accounts.id, data.accountId));
    } else if (data.typeId === 2) {
      // Despesa: subtrai do saldo
      await db.update(accounts)
        .set({ balance: sql`${accounts.balance} - ${amountNum}` })
        .where(eq(accounts.id, data.accountId));
    }

    return reply.status(201).send(created);
  });

  // Atualizar / Editar transacao
  app.put("/:id", async (request, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number() });
    const { id } = paramsSchema.parse(request.params);

    const bodySchema = z.object({
      description: z.string().min(1).optional(),
      amount: z.string().optional(),
      typeId: z.number().optional(),
      statusId: z.number().optional(),
      date: z.string().optional(),
      accountId: z.number().optional(),
      categoryId: z.number().optional(),
      notes: z.string().optional(),
    });

    const data = bodySchema.parse(request.body);
    const [updated] = await db.update(transactions)
      .set({
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        updatedAt: new Date()
      })
      .where(eq(transactions.id, id))
      .returning();

    return reply.send(updated);
  });

  // Excluir transacao
  app.delete("/:id", async (request, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number() });
    const { id } = paramsSchema.parse(request.params);

    await db.delete(transactions).where(eq(transactions.id, id));
    return reply.send({ success: true, message: "Transação excluída com sucesso" });
  });

  // Confirmar transacao pendente de notificacao bancaria
  app.patch("/:id/confirm", async (request, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number() });
    const bodySchema = z.object({
      categoryId: z.number().optional(),
      accountId: z.number().optional(),
      description: z.string().optional()
    });

    const { id } = paramsSchema.parse(request.params);
    const updates = bodySchema.parse(request.body);

    const [updated] = await db.update(transactions)
      .set({
        ...updates,
        statusId: 1, // 1 = CONFIRMED
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();

    return reply.send(updated);
  });
}
