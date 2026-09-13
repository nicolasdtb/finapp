import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { categories } from "../../database/schema.js";
import { eq } from "drizzle-orm";

export async function categoryRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const list = await db.select().from(categories);
    return reply.send(list);
  });

  app.post("/", async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      typeId: z.number().default(2),
      color: z.string().default("#EF4444"),
      icon: z.string().default("tag"),
      parentId: z.number().optional(),
    });

    const data = schema.parse(request.body);
    const [created] = await db.insert(categories).values(data).returning();
    return reply.status(201).send(created);
  });

  app.put("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const schema = z.object({
      name: z.string().optional(),
      typeId: z.number().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      parentId: z.number().optional(),
    });

    const data = schema.parse(request.body);
    const [updated] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return reply.send(updated);
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    await db.delete(categories).where(eq(categories.id, id));
    return reply.send({ success: true, message: "Categoria excluída" });
  });
}
