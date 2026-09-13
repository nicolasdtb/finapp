import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../../database/index.js";
import { users, accounts, categories } from "../../database/schema.js";
import { eq, isNull, count } from "drizzle-orm";

export async function authRoutes(app: FastifyInstance) {
  // CADASTRO DE USUARIO (Limite maximo: 3 usuarios)
  app.post("/register", async (request, reply) => {
    const schema = z.object({
      name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
      email: z.string().email("E-mail inválido"),
      password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    });

    const data = schema.parse(request.body);

    // 1. Verifica limite de 3 usuarios
    const [userCount] = await db.select({ value: count() }).from(users).where(isNull(users.deletedAt));
    if (userCount && userCount.value >= 3) {
      return reply.status(403).send({
        success: false,
        message: "Limite de 3 usuários atingido para esta instância do FinApp."
      });
    }

    // 2. Verifica se o e-mail ja existe
    const existing = await db.select().from(users).where(eq(users.email, data.email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      return reply.status(409).send({
        success: false,
        message: "Este e-mail já está cadastrado."
      });
    }

    // 3. Hash da senha
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // 4. Cria o usuario
    const [newUser] = await db.insert(users).values({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash: passwordHash
    }).returning({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt
    });

    // 5. Se for o primeiro usuario da instancia, cria contas e categorias iniciais associadas a ele
    if (userCount.value === 0) {
      await db.insert(accounts).values([
        { name: "Nubank (Cartão)", typeId: 2, balance: "0.00", color: "#820AD1", icon: "credit-card", userId: newUser.id },
        { name: "Banco Inter (Conta)", typeId: 1, balance: "2500.00", color: "#FF7A00", icon: "wallet", userId: newUser.id },
        { name: "Carteira Dinheiro", typeId: 4, balance: "100.00", color: "#10B981", icon: "banknote", userId: newUser.id }
      ]);

      await db.insert(categories).values([
        { name: "Alimentação & Restaurante", typeId: 2, color: "#EF4444", icon: "utensils", userId: newUser.id },
        { name: "Supermercado", typeId: 2, color: "#F59E0B", icon: "shopping-cart", userId: newUser.id },
        { name: "Transporte & Combustível", typeId: 2, color: "#3B82F6", icon: "car", userId: newUser.id },
        { name: "Moradia & Contas", typeId: 2, color: "#8B5CF6", icon: "home", userId: newUser.id },
        { name: "Salário & Renda", typeId: 1, color: "#10B981", icon: "dollar-sign", userId: newUser.id }
      ]);
    }

    // 6. Gera token JWT
    const token = app.jwt.sign({ id: newUser.id, name: newUser.name, email: newUser.email });

    return reply.status(201).send({
      success: true,
      user: newUser,
      token
    });
  });

  // LOGIN
  app.post("/login", async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string()
    });

    const data = schema.parse(request.body);

    const [user] = await db.select().from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1);

    if (!user || user.deletedAt) {
      return reply.status(401).send({
        success: false,
        message: "E-mail ou senha incorretos."
      });
    }

    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      return reply.status(401).send({
        success: false,
        message: "E-mail ou senha incorretos."
      });
    }

    const token = app.jwt.sign({ id: user.id, name: user.name, email: user.email });

    return reply.send({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      token
    });
  });

  // OBTER DADOS DO USUARIO LOGADO (TOKEN CHECK)
  app.get("/me", async (request, reply) => {
    try {
      await request.jwtVerify();
      return reply.send({ user: request.user });
    } catch (err) {
      return reply.status(401).send({ message: "Sessão expirada ou inválida." });
    }
  });
}
