import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { authRoutes } from "./modules/auth/routes.js";
import { webhookRoutes } from "./modules/webhooks/routes.js";
import { transactionRoutes } from "./modules/transactions/routes.js";
import { accountRoutes } from "./modules/accounts/routes.js";
import { categoryRoutes } from "./modules/categories/routes.js";
import { tagRoutes } from "./modules/tags/routes.js";
import { budgetRoutes } from "./modules/budgets/routes.js";
import { initDatabase } from "./database/init.js";

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, {
    origin: true
  });

  // JWT Plugin
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "finapp_super_secret_jwt_key_2026_change_in_env"
  });

  // Inicializa tabelas, usuarios e seeds
  await initDatabase();

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Modulos da aplicacao
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(webhookRoutes, { prefix: "/api/v1/webhooks" });
  await app.register(transactionRoutes, { prefix: "/api/v1/transactions" });
  await app.register(accountRoutes, { prefix: "/api/v1/accounts" });
  await app.register(categoryRoutes, { prefix: "/api/v1/categories" });
  await app.register(tagRoutes, { prefix: "/api/v1/tags" });
  await app.register(budgetRoutes, { prefix: "/api/v1/budgets" });

  const port = Number(process.env.PORT) || 3001;
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
    console.log(`🚀 FinApp Backend rodando em http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
