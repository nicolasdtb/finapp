import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, accounts } from "../../database/schema.js";

export function parseBankNotification(appName: string, text: string) {
  let amount: number | null = null;
  let establishment: string = "Despesa Bancaria";

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
        message: "Nao foi possivel extrair o valor da transacao da notificacao."
      });
    }

    const firstAccount = await db.select().from(accounts).limit(1);
    const accountId = firstAccount.length > 0 ? firstAccount[0].id : null;

    if (!accountId) {
      return reply.status(422).send({
        success: false,
        message: "Nenhuma conta cadastrada no app para vincular o lancamento."
      });
    }

    const [newTx] = await db.insert(transactions).values({
      description: parsed.establishment,
      amount: parsed.amount.toFixed(2),
      typeId: 2,     // 2 = EXPENSE
      statusId: 2,   // 2 = PENDING_CONFIRMATION
      date: new Date(),
      accountId: accountId,
      rawBankNotification: `[${body.app_name}] ${body.title}: ${body.text}`
    }).returning();

    return reply.status(201).send({
      success: true,
      message: "Transacao capturada com sucesso!",
      transaction: newTx
    });
  });
}
