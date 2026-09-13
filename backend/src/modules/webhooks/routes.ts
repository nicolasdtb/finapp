import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, accounts, users } from "../../database/schema.js";
import { eq, isNull, and } from "drizzle-orm";

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
      typeId: parsed.typeId, // 1 = RECEITA (Pix recebido), 2 = DESPESA (Compra/Pix enviado)
      statusId: 2,           // 2 = PENDING_CONFIRMATION
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