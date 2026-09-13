import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, categories, accounts } from "../../database/schema.js";
import { desc, eq } from "drizzle-orm";

export async function transactionRoutes(app: FastifyInstance) {
  // Listar transacoes
  app.get("/", async (request, reply) => {
    const all = await db.query.transactions.findMany({
      orderBy: [desc(transactions.date)],
      with: {
        account: true,
        category: true,
      }
    });
    return reply.send(all);
  });

  // Criar transacao manual
  app.post("/", async (request, reply) => {
    const schema = z.object({
      description: z.string().min(1),
      amount: z.string(),
      type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
      date: z.string(), // ISO string
      accountId: z.string().uuid(),
      categoryId: z.string().uuid().optional(),
      destinationAccountId: z.string().uuid().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(request.body);

    const [created] = await db.insert(transactions).values({
      description: data.description,
      amount: data.amount,
      type: data.type,
      date: new Date(data.date),
      accountId: data.accountId,
      categoryId: data.categoryId,
      destinationAccountId: data.destinationAccountId,
      notes: data.notes,
      status: "CONFIRMED"
    }).returning();

    return reply.status(201).send(created);
  });

  // Confirmar transacao pendente de notificacao bancaria
  app.patch("/:id/confirm", async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({
      categoryId: z.string().uuid().optional(),
      accountId: z.string().uuid().optional(),
      description: z.string().optional()
    });

    const { id } = paramsSchema.parse(request.params);
    const updates = bodySchema.parse(request.body);

    const [updated] = await db.update(transactions)
      .set({
        ...updates,
        status: "CONFIRMED",
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();

    return reply.send(updated);
  });
}
