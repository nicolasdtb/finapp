import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, accounts, users } from "../../database/schema.js";
import { eq, isNull, and, gte } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";

// Compara segredos sem vazar informacao pelo tempo de resposta.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function parseBankNotification(appName: string, text: string) {
  let amount: number | null = null;
  let establishment: string = "Despesa Bancária";
  let typeId: number = 2; // 1 = Receita (Income), 2 = Despesa (Expense)

  const lowerText = text.toLowerCase();

  // 1. Detecta se é RECEITA (Pix recebido, transferência recebida, depósito, reembolso)
  const isIncome = lowerText.includes("recebeu") || 
                   lowerText.includes("recebida") || 
                   lowerText.includes("depósito") || 
                   lowerText.includes("deposito") || 
                   lowerText.includes("reembolso");

  if (isIncome) {
    typeId = 1;
    establishment = "Pix / Transferência Recebida";
  }

  // 2. Extração do valor monetário (R$ 12,34 ou R$ 0,01)
  const amountMatch = text.match(/R\$\s?([\d\.,]+)/i) || text.match(/(?:valor de|total de|pagou|recebeu)\s+([\d\.,]+)/i);
  if (amountMatch && amountMatch[1]) {
    const rawVal = amountMatch[1].replace(/\./g, "").replace(",", ".");
    amount = parseFloat(rawVal);
  }

  // 3. Extração inteligente do remetente / estabelecimento
  if (isIncome) {
    // "Você recebeu uma transferência de R$ 50,00 de Fulano de Tal" ou "de Maria"
    const senderMatch = text.match(/(?:de|remetente)\s+([^,\.]+?)(?:\s+(?:pelo|via|com|no valor)|\.|$)/i);
    if (senderMatch && senderMatch[1]) {
      establishment = `Pix Recebido: ${senderMatch[1].trim()}`;
    }
  } else {
    // Pix enviado para Fulano
    const pixMatch = text.match(/(?:para|destinat[aá]rio)\s+([^,\.]+?)(?:\s+(?:pelo|via|com|no valor)|\.|$)/i);
    // Compra em Estabelecimento
    const estabMatch = text.match(/(?:em|no|na)\s+([^,\.]+?)(?:\s+(?:aprovad[oa]|por aproxima[cç][aã]o|com|no valor)|\.|$)/i);
    const directMatch = text.match(/compra\s+(?:de\s+R\$\s*[\d\.,]+\s+)?(?:aprovada\s+)?(?:em|no|na)\s+([^,\.]+?)(?:\.|$)/i);

    if (pixMatch && pixMatch[1] && (lowerText.includes("transfer") || lowerText.includes("pix"))) {
      establishment = `Pix: ${pixMatch[1].trim()}`;
    } else if (directMatch && directMatch[1]) {
      establishment = directMatch[1].trim();
    } else if (estabMatch && estabMatch[1]) {
      establishment = estabMatch[1].trim();
    } else {
      const cleaned = text
        .replace(/R\$\s?[\d\.,]+/gi, "")
        .replace(/compra aprovada/gi, "")
        .replace(/por aproximação/gi, "")
        .replace(/você pagou/gi, "")
        .trim();
      if (cleaned.length > 3) {
        establishment = cleaned.split(".")[0].trim();
      }
    }
  }

  return {
    amount,
    establishment,
    typeId,
    originalText: text,
    bankHint: appName
  };
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/bank-notification", async (request, reply) => {
    // 1. Autenticacao do webhook.
    //    - Token do webhook (WEBHOOK_TOKEN) enviado em ?token= ou Authorization: Bearer
    //    - Ou um JWT de login (comportamento antigo)
    //    - Sem token: so e aceito enquanto WEBHOOK_REQUIRE_TOKEN nao for "true" (periodo de transicao)
    let userId: number | null = null;
    const webhookToken = process.env.WEBHOOK_TOKEN || "";
    const requireToken = process.env.WEBHOOK_REQUIRE_TOKEN === "true";
    const query = request.query as { token?: string };
    const authHeader = request.headers.authorization;
    const token = query.token || (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);

    const firstActiveUser = async () => {
      const [u] = await db.select().from(users).where(isNull(users.deletedAt)).limit(1);
      return u ? u.id : null;
    };

    if (token) {
      if (webhookToken && safeEqual(token, webhookToken)) {
        userId = await firstActiveUser();
      } else {
        try {
          const decoded = app.jwt.verify<{ id: number }>(token);
          userId = decoded.id;
        } catch (err) {
          return reply.status(401).send({ success: false, message: "Token de webhook inválido ou expirado." });
        }
      }
    } else if (requireToken) {
      return reply.status(401).send({ success: false, message: "Token de webhook obrigatório." });
    } else {
      request.log.warn({ ip: request.ip }, "Webhook recebido SEM token (modo de transicao).");
      userId = await firstActiveUser();
    }

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: "Nenhum usuário identificado para receber esta notificação."
      });
    }

    const itemSchema = z.object({
      package_name: z.string().optional().default("unknown"),
      app_name: z.string().optional().default("Banco"),
      title: z.string().optional().default(""),
      text: z.string()
    });

    const schema = z.union([
      itemSchema,
      z.array(itemSchema)
    ]);

    let body: any;
    try {
      body = schema.parse(request.body);
    } catch (err) {
      return reply.status(400).send({
        success: false,
        message: "Payload inválido. Esperado: objeto JSON ou array de objetos.",
        received: typeof request.body,
        hint: "Certifique-se de que o Content-Type é application/json e o body é um objeto ou array válido."
      });
    }
    const notificationsList = Array.isArray(body) ? body : [body];

    // 2. Busca contas exclusivas deste usuário e tenta encontrar uma correspondente ao banco
    const userAccounts = await db.select().from(accounts)
      .where(and(isNull(accounts.deletedAt), eq(accounts.userId, userId)));

    if (userAccounts.length === 0) {
      return reply.status(422).send({
        success: false,
        message: "O usuário não possui contas cadastradas para receber o lançamento."
      });
    }

    const createdTxs: any[] = [];
    let duplicates = 0;
    // Janela para considerar a mesma notificacao como duplicada (reenvio da fila do celular)
    const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

    for (const notif of notificationsList) {
      const parsed = parseBankNotification(notif.app_name, `${notif.title} ${notif.text}`);
      if (!parsed.amount) continue;

      const rawText = `[${notif.app_name}] ${notif.title}: ${notif.text}`;

      // Ignora a mesma notificacao recebida de novo em poucos minutos
      const [duplicate] = await db.select({ id: transactions.id }).from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          eq(transactions.rawBankNotification, rawText),
          isNull(transactions.deletedAt),
          gte(transactions.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS))
        ))
        .limit(1);
      if (duplicate) {
        duplicates++;
        request.log.info({ duplicateOf: duplicate.id }, "Notificacao duplicada ignorada.");
        continue;
      }

      const bankNameLower = notif.app_name.toLowerCase();
      const bankAccount = userAccounts.find(acc => 
        acc.name.toLowerCase().includes(bankNameLower) || bankNameLower.includes(acc.name.toLowerCase())
      );
      // Sem conta do banco: usa a primeira, mas avisa na observacao para o usuario conferir ao confirmar
      const matchedAccount = bankAccount || userAccounts[0];

      // 3. Salva a transação como PENDENTE associada estritamente ao usuário
      const [newTx] = await db.insert(transactions).values({
        description: parsed.establishment,
        amount: parsed.amount.toFixed(2),
        typeId: parsed.typeId, // 1 = RECEITA (Pix recebido), 2 = DESPESA (Compra/Pix enviado)
        statusId: 2,           // 2 = PENDING_CONFIRMATION
        date: new Date(),
        accountId: matchedAccount.id,
        userId: userId,
        notes: bankAccount
          ? null
          : `Conta não identificada automaticamente para "${notif.app_name}". Confira a conta antes de confirmar.`,
        rawBankNotification: rawText
      }).returning();

      createdTxs.push(newTx);
    }

    if (createdTxs.length === 0 && duplicates > 0) {
      // Responde 2xx para o celular tirar o item da fila
      return reply.status(200).send({
        success: true,
        message: `${duplicates} notificação(ões) duplicada(s) ignorada(s).`,
        transactions: []
      });
    }

    if (createdTxs.length === 0) {
      return reply.status(400).send({
        success: false,
        message: "Não foi possível extrair o valor de nenhuma das notificações recebidas."
      });
    }

    return reply.status(201).send({
      success: true,
      message: `${createdTxs.length} transação(ões) capturada(s) com sucesso!`,
      transactions: createdTxs
    });
  });
}