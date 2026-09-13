import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { budgets, categories } from "../../database/schema.js";
import { eq, isNull, and } from "drizzle-orm";

export async function budgetRoutes(app: FastifyInstance) {
  // Hook de autenticacao obrigatoria
  app.addHook("preHandler", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ success: false, message: "Não autorizado." });
    }
  });

  // Listar orçamentos ativos do usuário
  app.get("/", async (request, reply) => {
    const user = request.user as { id: number };
    const list = await db.select().from(budgets)
      .where(and(isNull(budgets.deletedAt), eq(budgets.userId, user.id)));
    return reply.send(list);
  });

  // Criar ou atualizar orçamento para uma categoria
  app.post("/", async (request, reply) => {
    const user = request.user as { id: number };
    const schema = z.object({
      categoryId: z.number(),
      targetAmount: z.string(),
      monthYear: z.string().default("default"),
    });

    const data = schema.parse(request.body);

    // Verifica se já existe um orçamento ativo para essa categoria do usuário
    const [existing] = await db.select().from(budgets)
      .where(and(
        isNull(budgets.deletedAt),
        eq(budgets.categoryId, data.categoryId),
        eq(budgets.userId, user.id)
      )).limit(1);

    if (existing) {
      const [updated] = await db.update(budgets)
        .set({
          targetAmount: data.targetAmount,
          monthYear: data.monthYear,
        })
        .where(eq(budgets.id, existing.id))
        .returning();
      return reply.send(updated);
    }

    const [created] = await db.insert(budgets).values({
      categoryId: data.categoryId,
      targetAmount: data.targetAmount,
      monthYear: data.monthYear,
      userId: user.id
    }).returning();

    return reply.status(201).send(created);
  });

  // Excluir orçamento (Soft Delete)
  app.delete("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    await db.update(budgets)
      .set({ deletedAt: new Date() })
      .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)));

    return reply.send({ success: true, message: "Orçamento excluído." });
  });
}