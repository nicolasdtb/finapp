import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { accounts } from "../../database/schema.js";

export async function accountRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const list = await db.select().from(accounts);
    return reply.send(list);
  });

  app.post("/", async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      typeId: z.number().default(1), // 1: CHECKING, 2: CREDIT_CARD, 3: SAVINGS, 4: CASH
      balance: z.string().default("0.00"),
      color: z.string().default("#3B82F6"),
      icon: z.string().default("wallet"),
      creditLimit: z.string().optional(),
      closingDay: z.number().optional(),
      dueDay: z.number().optional(),
    });

    const data = schema.parse(request.body);
    const [created] = await db.insert(accounts).values({
      name: data.name,
      typeId: data.typeId,
      balance: data.balance,
      color: data.color,
      icon: data.icon,
      creditLimit: data.creditLimit,
      closingDay: data.closingDay,
      dueDay: data.dueDay,
    }).returning();

    return reply.status(201).send(created);
  });
}
