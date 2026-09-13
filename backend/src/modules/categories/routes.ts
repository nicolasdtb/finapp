import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { categories } from "../../database/schema.js";
import { eq, isNull, and } from "drizzle-orm";

export async function categoryRoutes(app: FastifyInstance) {
  // Hook de autenticacao obrigatoria
  app.addHook("preHandler", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ success: false, message: "Não autorizado." });
    }
  });

  app.get("/", async (request, reply) => {
    const user = request.user as { id: number };
    const list = await db.select().from(categories)
      .where(and(isNull(categories.deletedAt), eq(categories.userId, user.id)));
    return reply.send(list);
  });

  app.post("/", async (request, reply) => {
    const user = request.user as { id: number };
    const schema = z.object({
      name: z.string().min(1),
      typeId: z.number().default(2),
      color: z.string().default("#EF4444"),
      icon: z.string().default("tag"),
      parentId: z.number().optional(),
    });

    const data = schema.parse(request.body);
    const [created] = await db.insert(categories).values({
      ...data,
      userId: user.id
    }).returning();
    return reply.status(201).send(created);
  });

  app.put("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const schema = z.object({
      name: z.string().optional(),
      typeId: z.number().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      parentId: z.number().optional(),
    });

    const data = schema.parse(request.body);
    const [updated] = await db.update(categories)
      .set(data)
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
      .returning();
    return reply.send(updated);
  });

  app.delete("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    // SOFT DELETE
    await db.update(categories)
      .set({ deletedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)));
    return reply.send({ success: true, message: "Categoria excluída (soft delete)" });
  });
}
