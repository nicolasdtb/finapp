import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { accounts } from "../../database/schema.js";
import { eq } from "drizzle-orm";

export async function accountRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const list = await db.select().from(accounts);
    return reply.send(list);
  });

  app.post("/", async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      typeId: z.number().default(1),
      balance: z.string().default("0.00"),
      color: z.string().default("#3B82F6"),
      icon: z.string().default("wallet"),
      creditLimit: z.string().optional(),
      closingDay: z.number().optional(),
      dueDay: z.number().optional(),
    });

    const data = schema.parse(request.body);
    const [created] = await db.insert(accounts).values(data).returning();
    return reply.status(201).send(created);
  });

  app.put("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const schema = z.object({
      name: z.string().optional(),
      typeId: z.number().optional(),
      balance: z.string().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      creditLimit: z.string().optional(),
      closingDay: z.number().optional(),
      dueDay: z.number().optional(),
    });

    const data = schema.parse(request.body);
    const [updated] = await db.update(accounts).set({ ...data, updatedAt: new Date() }).where(eq(accounts.id, id)).returning();
    return reply.send(updated);
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    await db.delete(accounts).where(eq(accounts.id, id));
    return reply.send({ success: true, message: "Conta excluída" });
  });
}
