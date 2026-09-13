import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, accounts, users } from "../../database/schema.js";
import { eq, isNull, and } from "drizzle-orm";

export function parseBankNotification(appName: string, text: string) {
  let amount: number | null = null;
  let establishment: string = "Despesa Bancária";

  const amountMatch = text.match(/R\$\s?([\d\.,]+)/i);
  if (amountMatch && amountMatch[1]) {
    const rawVal = amountMatch[1].replace(/\./g, "").replace(",", ".");
    amount = parseFloat(rawVal);
  }

  const estabMatch = text.match(/(?:em|no|na)\s+([^,\.]+?)(?:\s+(?:aprovad[oa]|com|no valor)|\.|$)/i);
  if (estabMatch && estabMatch[1]) {
    establishment = estabMatch[1].trim();
  }

  return {
    amount,
    establishment,
    originalText: text,
    bankHint: appName
  };
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/bank-notification", async (request, reply) => {
    // 1. Identificação do usuário (via Bearer Token no Header ou ?token= na URL)
    let userId: number | null = null;
    const query = request.query as { token?: string };
    const authHeader = request.headers.authorization;
    const token = query.token || (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);

    if (token) {
      try {
        const decoded = app.jwt.verify<{ id: number }>(token);
        userId = decoded.id;
      } catch (err) {
        return reply.status(401).send({ success: false, message: "Token de webhook inválido ou expirado." });
      }
    } else {
      // Fallback: se não passar token, vincula ao primeiro usuário ativo registrado
      const [firstUser] = await db.select().from(users).where(isNull(users.deletedAt)).limit(1);
      if (firstUser) {
        userId = firstUser.id;
      }
    }

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: "Nenhum usuário identificado para receber esta notificação."
      });
    }

    const schema = z.object({
      package_name: z.string().optional().default("unknown"),
      app_name: z.string().optional().default("Banco"),
      title: z.string().optional().default(""),
      text: z.string()
    });

    const body = schema.parse(request.body);
    const parsed = parseBankNotification(body.app_name, `${body.title} ${body.text}`);

    if (!parsed.amount) {
      return reply.status(400).send({
        success: false,
        message: "Não foi possível extrair o valor da transação da notificação."
      });
    }

    // 2. Busca contas exclusivas deste usuário e tenta encontrar uma correspondente ao banco
    const userAccounts = await db.select().from(accounts)
      .where(and(isNull(accounts.deletedAt), eq(accounts.userId, userId)));

    if (userAccounts.length === 0) {
      return reply.status(422).send({
        success: false,
        message: "O usuário não possui contas cadastradas para receber o lançamento."
      });
    }

    const bankNameLower = body.app_name.toLowerCase();
    const matchedAccount = userAccounts.find(acc => 
      acc.name.toLowerCase().includes(bankNameLower) || bankNameLower.includes(acc.name.toLowerCase())
    ) || userAccounts[0];

    // 3. Salva a transação como PENDENTE associada estritamente ao usuário
    const [newTx] = await db.insert(transactions).values({
      description: parsed.establishment,
      amount: parsed.amount.toFixed(2),
      typeId: 2,     // 2 = EXPENSE
      statusId: 2,   // 2 = PENDING_CONFIRMATION
      date: new Date(),
      accountId: matchedAccount.id,
      userId: userId,
      rawBankNotification: `[${body.app_name}] ${body.title}: ${body.text}`
    }).returning();

    return reply.status(201).send({
      success: true,
      message: "Transação capturada com sucesso!",
      transaction: newTx
    });
  });
}