import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { categories } from "../../database/schema.js";

export async function categoryRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const list = await db.select().from(categories);
    return reply.send(list);
  });

  app.post("/", async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
      color: z.string().default("#EF4444"),
      icon: z.string().default("tag"),
      parentId: z.string().uuid().optional(),
    });

    const data = schema.parse(request.body);
    const [created] = await db.insert(categories).values(data).returning();
    return reply.status(201).send(created);
  });
}
