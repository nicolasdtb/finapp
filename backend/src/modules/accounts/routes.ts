import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { accounts } from "../../database/schema.js";
import { eq, isNull, and, asc, sql } from "drizzle-orm";

export async function accountRoutes(app: FastifyInstance) {
  // Hook de autenticacao obrigatoria para todas as rotas de contas
  app.addHook("preHandler", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ success: false, message: "Não autorizado." });
    }
  });

  app.get("/", async (request, reply) => {
    const user = request.user as { id: number };
    const list = await db.select().from(accounts)
      .where(and(isNull(accounts.deletedAt), eq(accounts.userId, user.id)))
      .orderBy(asc(accounts.sortOrder), asc(accounts.id));
    return reply.send(list);
  });

  app.post("/", async (request, reply) => {
    const user = request.user as { id: number };
    const schema = z.object({
      name: z.string().min(1),
      typeId: z.number().default(1),
      balance: z.string().default("0.00"),
      color: z.string().default("#3B82F6"),
      icon: z.string().default("wallet"),
      creditLimit: z.string().regex(/^\d+(\.\d{1,2})?$/, "Limite inválido").optional(),
      closingDay: z.number().int().min(1).max(31).optional(),
      dueDay: z.number().int().min(1).max(31).optional(),
      notificationBank: z.string().nullable().optional(),
    });

    const data = schema.parse(request.body);
    // Conta nova vai para o fim da lista
    const [{ next }] = await db.select({ next: sql<number>`coalesce(max(${accounts.sortOrder}), 0) + 1` })
      .from(accounts)
      .where(eq(accounts.userId, user.id));
    const [created] = await db.insert(accounts).values({
      ...data,
      sortOrder: Number(next),
      userId: user.id
    }).returning();
    return reply.status(201).send(created);
  });

  // Reordenar contas: recebe os ids na ordem desejada
  app.put("/order", async (request, reply) => {
    const user = request.user as { id: number };
    const { ids } = z.object({ ids: z.array(z.number().int()).min(1).max(100) }).parse(request.body);
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.update(accounts)
          .set({ sortOrder: i + 1 })
          .where(and(eq(accounts.id, ids[i]), eq(accounts.userId, user.id)));
      }
    });
    return reply.send({ success: true });
  });

  app.put("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const schema = z.object({
      name: z.string().optional(),
      typeId: z.number().optional(),
      balance: z.string().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      creditLimit: z.string().regex(/^\d+(\.\d{1,2})?$/, "Limite inválido").optional(),
      closingDay: z.number().int().min(1).max(31).optional(),
      dueDay: z.number().int().min(1).max(31).optional(),
      notificationBank: z.string().nullable().optional(),
    });

    const data = schema.parse(request.body);
    const [updated] = await db.update(accounts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
      .returning();
    return reply.send(updated);
  });

  app.delete("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    // SOFT DELETE restrito ao proprietário da conta
    await db.update(accounts)
      .set({ deletedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)));
    return reply.send({ success: true, message: "Conta excluída (soft delete)" });
  });
}
