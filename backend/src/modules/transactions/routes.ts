import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, transactionItems, accounts, categories, tags } from "../../database/schema.js";
import { desc, eq, isNull, sql, and } from "drizzle-orm";

export async function transactionRoutes(app: FastifyInstance) {
  // Hook de autenticacao obrigatoria
  app.addHook("preHandler", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ success: false, message: "Não autorizado." });
    }
  });

  // Listar transacoes do usuario logado (ignora soft-deleted)
  app.get("/", async (request, reply) => {
    const user = request.user as { id: number };
    const all = await db.select().from(transactions)
      .where(and(isNull(transactions.deletedAt), eq(transactions.userId, user.id)))
      .orderBy(desc(transactions.date));
    
    const items = await db.select().from(transactionItems).where(isNull(transactionItems.deletedAt));
    const txMap = all.map(t => ({
      ...t,
      items: items.filter(i => i.transactionId === t.id)
    }));

    return reply.send(txMap);
  });

  // Criar transacao associada ao usuario logado
  app.post("/", async (request, reply) => {
    const user = request.user as { id: number };
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
      userId: user.id
    }).returning();

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

    // Atualiza saldo da conta garantindo que pertence ao usuario
    const amountNum = parseFloat(data.amount);
    if (data.typeId === 1) {
      await db.update(accounts)
        .set({ balance: sql`${accounts.balance} + ${amountNum}` })
        .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)));
    } else if (data.typeId === 2) {
      await db.update(accounts)
        .set({ balance: sql`${accounts.balance} - ${amountNum}` })
        .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)));
    }

    return reply.status(201).send(created);
  });

  // Atualizar transacao do usuario
  app.put("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const schema = z.object({
      description: z.string().min(1).optional(),
      amount: z.string().optional(),
      typeId: z.number().optional(),
      statusId: z.number().optional(),
      date: z.string().optional(),
      accountId: z.number().optional(),
      categoryId: z.number().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(request.body);
    const [updated] = await db.update(transactions)
      .set({
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        updatedAt: new Date()
      })
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning();

    return reply.send(updated);
  });

  // SOFT DELETE de transacao (marca deleted_at e estorna saldo)
  app.delete("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    const [tx] = await db.select().from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .limit(1);

    if (tx) {
      // Estorna saldo na conta
      const amountNum = parseFloat(tx.amount);
      if (tx.typeId === 1) {
        // Estorno de receita: subtrai do saldo
        await db.update(accounts)
          .set({ balance: sql`${accounts.balance} - ${amountNum}` })
          .where(and(eq(accounts.id, tx.accountId), eq(accounts.userId, user.id)));
      } else if (tx.typeId === 2) {
        // Estorno de despesa: devolve para a conta
        await db.update(accounts)
          .set({ balance: sql`${accounts.balance} + ${amountNum}` })
          .where(and(eq(accounts.id, tx.accountId), eq(accounts.userId, user.id)));
      }

      // Marca como deletado
      await db.update(transactions)
        .set({ deletedAt: new Date() })
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));

      await db.update(transactionItems)
        .set({ deletedAt: new Date() })
        .where(eq(transactionItems.transactionId, id));
    }

    return reply.send({ success: true, message: "Transação excluída (soft delete)" });
  });

  // Confirmar transacao pendente de notificacao bancaria
  app.patch("/:id/confirm", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const schema = z.object({
      categoryId: z.number().optional(),
      accountId: z.number().optional(),
      description: z.string().optional()
    });

    const updates = schema.parse(request.body);
    const [updated] = await db.update(transactions)
      .set({
        ...updates,
        statusId: 1,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning();

    return reply.send(updated);
  });
}
