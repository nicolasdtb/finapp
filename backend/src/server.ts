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
import { invoiceRoutes } from "./modules/invoices/routes.js";
import { importRoutes } from "./modules/import/routes.js";
import { initDatabase } from "./database/init.js";

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, {
    origin: true
  });

  // JWT Plugin: o segredo e obrigatorio (sem valor padrao no codigo)
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET nao definido. Configure no .env antes de iniciar o backend.");
  }
  await app.register(fastifyJwt, {
    secret: jwtSecret,
    // Tokens de login expiram em 30 dias; depois disso o app pede login de novo.
    sign: { expiresIn: "30d" }
  });

  // Inicializa tabelas, usuarios e seeds
  await initDatabase();

  // Health check endpoints
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
  app.get("/api/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
  app.get("/api/v1/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Modulos da aplicacao
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(webhookRoutes, { prefix: "/api/v1/webhooks" });
  await app.register(transactionRoutes, { prefix: "/api/v1/transactions" });
  await app.register(accountRoutes, { prefix: "/api/v1/accounts" });
  await app.register(categoryRoutes, { prefix: "/api/v1/categories" });
  await app.register(tagRoutes, { prefix: "/api/v1/tags" });
  await app.register(budgetRoutes, { prefix: "/api/v1/budgets" });
  await app.register(invoiceRoutes, { prefix: "/api/v1/invoices" });
  await app.register(importRoutes, { prefix: "/api/v1/import" });

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
