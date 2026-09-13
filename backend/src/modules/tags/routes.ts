import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { tags } from "../../database/schema.js";
import { eq, isNull } from "drizzle-orm";

export async function tagRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const list = await db.select().from(tags).where(isNull(tags.deletedAt));
    return reply.send(list);
  });

  app.post("/", async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      color: z.string().default("#64748B"),
    });

    const data = schema.parse(request.body);
    const [created] = await db.insert(tags).values(data).returning();
    return reply.status(201).send(created);
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    // SOFT DELETE
    await db.update(tags).set({ deletedAt: new Date() }).where(eq(tags.id, id));
    return reply.send({ success: true, message: "Tag excluída (soft delete)" });
  });
}
