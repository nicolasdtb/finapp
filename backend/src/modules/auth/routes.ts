import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../../database/index.js";
import { users, accounts, categories, invitations } from "../../database/schema.js";
import { eq, isNull, count, and, gt, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";

const INVITE_VALIDITY_MS = 48 * 60 * 60 * 1000;
const MAX_USERS = 3;

// Codigo de convite: 12 caracteres hexadecimais maiusculos (guardado sem tracos)
const normalizeInviteCode = (code: string) => code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const newInviteCode = () => randomBytes(6).toString("hex").toUpperCase();
const formatInviteCode = (code: string) => code.match(/.{1,4}/g)?.join("-") ?? code;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Limite de tentativas de login: apos MAX falhas em WINDOW, bloqueia aquele IP+e-mail por um tempo.
const MAX_FAILED_LOGINS = 8;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; first: number }>();

function pruneFailedLogins(now: number) {
  if (failedLogins.size < 500) return;
  for (const [key, v] of failedLogins) {
    if (now - v.first > FAILED_LOGIN_WINDOW_MS) failedLogins.delete(key);
  }
}

function isLoginBlocked(key: string): boolean {
  const now = Date.now();
  pruneFailedLogins(now);
  const entry = failedLogins.get(key);
  if (!entry) return false;
  if (now - entry.first > FAILED_LOGIN_WINDOW_MS) {
    failedLogins.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILED_LOGINS;
}

function registerFailedLogin(key: string) {
  const now = Date.now();
  const entry = failedLogins.get(key);
  if (!entry || now - entry.first > FAILED_LOGIN_WINDOW_MS) {
    failedLogins.set(key, { count: 1, first: now });
  } else {
    entry.count++;
  }
}

export async function authRoutes(app: FastifyInstance) {
  // Exige login e devolve o usuario atual (do banco); com admin=true exige administrador.
  async function requireUser(request: any, reply: any, admin = false) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ success: false, message: "Sessão expirada ou inválida." });
      return null;
    }
    const [u] = await db.select().from(users).where(eq(users.id, request.user.id)).limit(1);
    if (!u || u.deletedAt) {
      reply.status(401).send({ success: false, message: "Sessão expirada ou inválida." });
      return null;
    }
    if (admin && !u.isAdmin) {
      reply.status(403).send({ success: false, message: "Apenas o administrador pode fazer isso." });
      return null;
    }
    return u;
  }

  // A tela de cadastro precisa saber se ainda nao existe nenhum usuario (instalacao nova: sem convite)
  app.get("/status", async () => {
    const [c] = await db.select({ value: count() }).from(users).where(isNull(users.deletedAt));
    return { firstUser: !c || c.value === 0 };
  });

  // CADASTRO DE USUARIO (maximo de 3 usuarios). Exige convite valido, exceto para o primeiro usuario.
  app.post("/register", async (request, reply) => {
    const schema = z.object({
      name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
      email: z.string().email("E-mail inválido"),
      password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      inviteCode: z.string().optional().default(""),
    });

    const data = schema.parse(request.body);

    // Limite de tentativas de convite por IP (evita adivinhar codigos)
    const regKey = `register|${request.ip}`;
    if (isLoginBlocked(regKey)) {
      return reply.status(429).send({
        success: false,
        message: "Muitas tentativas. Aguarde alguns minutos e tente de novo."
      });
    }

    const email = data.email.toLowerCase();
    const code = normalizeInviteCode(data.inviteCode);
    const passwordHash = await bcrypt.hash(data.password, 10);

    try {
      const newUser = await db.transaction(async (tx) => {
        // Serializa cadastros simultaneos (limite de usuarios e convite de uso unico)
        const [userCount] = await tx.select({ value: count() }).from(users).where(isNull(users.deletedAt));
        const total = userCount?.value ?? 0;
        const isFirst = total === 0;

        if (total >= MAX_USERS) {
          throw new HttpError(403, `Limite de ${MAX_USERS} usuários atingido para esta instância do FinApp.`);
        }

        const existing = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        if (existing.length > 0) {
          throw new HttpError(409, "Este e-mail já está cadastrado.");
        }

        let inviteId: number | null = null;
        if (!isFirst) {
          if (!code) throw new HttpError(403, "O cadastro exige um código de convite.");
          const [inv] = await tx.select().from(invitations)
            .where(and(eq(invitations.code, code), isNull(invitations.usedAt), gt(invitations.expiresAt, new Date())))
            .limit(1)
            .for("update");
          if (!inv) {
            registerFailedLogin(regKey);
            throw new HttpError(403, "Convite inválido, já usado ou expirado.");
          }
          inviteId = inv.id;
        }

        const [created] = await tx.insert(users).values({
          name: data.name,
          email,
          passwordHash,
          isAdmin: isFirst,
          webhookToken: randomBytes(32).toString("hex"),
        }).returning({
          id: users.id,
          name: users.name,
          email: users.email,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt
        });

        if (inviteId) {
          await tx.update(invitations)
            .set({ usedBy: created.id, usedAt: new Date() })
            .where(eq(invitations.id, inviteId));
        }

        // Contas e categorias iniciais, exclusivas desse usuario
        await tx.insert(accounts).values([
          { name: "Banco Inter (Conta)", typeId: 1, balance: "0.00", color: "#FF7A00", icon: "wallet", userId: created.id },
          { name: "Nubank (Cartão)", typeId: 2, balance: "0.00", color: "#820AD1", icon: "credit-card", userId: created.id },
          { name: "Carteira Dinheiro", typeId: 4, balance: "0.00", color: "#10B981", icon: "banknote", userId: created.id }
        ]);

        await tx.insert(categories).values([
          { name: "Salário & Renda", typeId: 1, color: "#10B981", icon: "dollar-sign", userId: created.id },
          { name: "Alimentação & Restaurante", typeId: 2, color: "#EF4444", icon: "utensils", userId: created.id },
          { name: "Supermercado", typeId: 2, color: "#F59E0B", icon: "shopping-cart", userId: created.id },
          { name: "Transporte & Combustível", typeId: 2, color: "#3B82F6", icon: "car", userId: created.id },
          { name: "Moradia & Contas", typeId: 2, color: "#8B5CF6", icon: "home", userId: created.id },
          { name: "Lazer & Viagens", typeId: 2, color: "#EC4899", icon: "party-popper", userId: created.id }
        ]);

        return created;
      });

      const token = app.jwt.sign({ id: newUser.id, name: newUser.name, email: newUser.email });
      return reply.status(201).send({ success: true, user: newUser, token });
    } catch (err) {
      if (err instanceof HttpError) {
        return reply.status(err.status).send({ success: false, message: err.message });
      }
      throw err;
    }
  });

  // CONVITES (somente administrador)
  app.post("/invites", async (request, reply) => {
    const admin = await requireUser(request, reply, true);
    if (!admin) return;
    const code = newInviteCode();
    const expiresAt = new Date(Date.now() + INVITE_VALIDITY_MS);
    await db.insert(invitations).values({ code, createdBy: admin.id, expiresAt });
    return reply.status(201).send({ success: true, code: formatInviteCode(code), expiresAt });
  });

  app.get("/invites", async (request, reply) => {
    const admin = await requireUser(request, reply, true);
    if (!admin) return;
    const rows = await db.select().from(invitations)
      .where(and(isNull(invitations.usedAt), gt(invitations.expiresAt, new Date())))
      .orderBy(desc(invitations.createdAt));
    return reply.send(rows.map(r => ({ id: r.id, code: formatInviteCode(r.code), expiresAt: r.expiresAt })));
  });

  app.delete("/invites/:id", async (request, reply) => {
    const admin = await requireUser(request, reply, true);
    if (!admin) return;
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);
    await db.delete(invitations).where(and(eq(invitations.id, id), isNull(invitations.usedAt)));
    return reply.send({ success: true });
  });

  // TOKEN DO WEBHOOK DO PROPRIO USUARIO (usado pelo app do celular)
  app.get("/webhook-token", async (request, reply) => {
    const u = await requireUser(request, reply);
    if (!u) return;
    return reply.send({ token: u.webhookToken });
  });

  app.post("/webhook-token/regenerate", async (request, reply) => {
    const u = await requireUser(request, reply);
    if (!u) return;
    const token = randomBytes(32).toString("hex");
    await db.update(users).set({ webhookToken: token }).where(eq(users.id, u.id));
    return reply.send({ token });
  });

  // LOGIN
  app.post("/login", async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string()
    });

    const data = schema.parse(request.body);

    const attemptKey = `${request.ip}|${data.email.toLowerCase()}`;
    if (isLoginBlocked(attemptKey)) {
      return reply.status(429).send({
        success: false,
        message: "Muitas tentativas de login. Aguarde alguns minutos e tente de novo."
      });
    }

    const [user] = await db.select().from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1);

    if (!user || user.deletedAt) {
      registerFailedLogin(attemptKey);
      return reply.status(401).send({
        success: false,
        message: "E-mail ou senha incorretos."
      });
    }

    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      registerFailedLogin(attemptKey);
      return reply.status(401).send({
        success: false,
        message: "E-mail ou senha incorretos."
      });
    }

    failedLogins.delete(attemptKey);
    const token = app.jwt.sign({ id: user.id, name: user.name, email: user.email });

    return reply.send({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      },
      token
    });
  });

  // OBTER DADOS DO USUARIO LOGADO (TOKEN CHECK)
  app.get("/me", async (request, reply) => {
    const u = await requireUser(request, reply);
    if (!u) return;
    return reply.send({ user: { id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin } });
  });
}
