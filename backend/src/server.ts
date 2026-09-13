import Fastify from "fastify";
import cors from "@fastify/cors";
import { webhookRoutes } from "./modules/webhooks/routes.js";
import { transactionRoutes } from "./modules/transactions/routes.js";
import { accountRoutes } from "./modules/accounts/routes.js";
import { categoryRoutes } from "./modules/categories/routes.js";

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, {
    origin: true // Permite acesso do PWA via ZeroTier ou localhost
  });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Modulos da aplicacao
  await app.register(webhookRoutes, { prefix: "/api/v1/webhooks" });
  await app.register(transactionRoutes, { prefix: "/api/v1/transactions" });
  await app.register(accountRoutes, { prefix: "/api/v1/accounts" });
  await app.register(categoryRoutes, { prefix: "/api/v1/categories" });

  const port = Number(process.env.PORT) || 3001;
  const host = "0.0.0.0"; // Obrigatorio para escutar na interface do ZeroTier e Docker

  try {
    await app.listen({ port, host });
    console.log(`🚀 FinApp Backend rodando em http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
