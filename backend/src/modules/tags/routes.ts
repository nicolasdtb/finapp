import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { tags } from "../../database/schema.js";
import { eq, isNull, and } from "drizzle-orm";

export async function tagRoutes(app: FastifyInstance) {
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
    const list = await db.select().from(tags)
      .where(and(isNull(tags.deletedAt), eq(tags.userId, user.id)));
    return reply.send(list);
  });

  app.post("/", async (request, reply) => {
    const user = request.user as { id: number };
    const schema = z.object({
      name: z.string().min(1),
      color: z.string().default("#64748B"),
    });

    const data = schema.parse(request.body);
    const [created] = await db.insert(tags).values({
      ...data,
      userId: user.id
    }).returning();
    return reply.status(201).send(created);
  });

  app.delete("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    // SOFT DELETE
    await db.update(tags)
      .set({ deletedAt: new Date() })
      .where(and(eq(tags.id, id), eq(tags.userId, user.id)));
    return reply.send({ success: true, message: "Tag excluída (soft delete)" });
  });
}
