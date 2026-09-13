import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions } from "../../database/schema.js";
import { desc, eq } from "drizzle-orm";

export async function transactionRoutes(app: FastifyInstance) {
  // Listar transacoes
  app.get("/", async (request, reply) => {
    const all = await db.select().from(transactions).orderBy(desc(transactions.date));
    return reply.send(all);
  });

  // Criar transacao manual
  app.post("/", async (request, reply) => {
    const schema = z.object({
      description: z.string().min(1),
      amount: z.string(),
      typeId: z.number().default(2), // 1: Receita, 2: Despesa, 3: Transferencia
      statusId: z.number().default(1), // 1: Confirmado, 2: Pendente
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
      typeId: data.typeId,
      statusId: data.statusId,
      date: new Date(data.date),
      accountId: data.accountId,
      categoryId: data.categoryId,
      destinationAccountId: data.destinationAccountId,
      notes: data.notes,
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
        statusId: 1, // 1 = CONFIRMED
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();

    return reply.send(updated);
  });
}
