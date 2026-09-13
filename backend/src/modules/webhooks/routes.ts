import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, accounts } from "../../database/schema.js";

// Parser inteligente de texto de notificacoes bancarias brasileiras
export function parseBankNotification(appName: string, text: string) {
  let amount: number | null = null;
  let establishment: string = "Despesa Bancaria";

  // Captura valores no padrao brasileiro (ex: R$ 45,90 ou R$1.250,00)
  const amountMatch = text.match(/R\$\s?([\d\.,]+)/i);
  if (amountMatch && amountMatch[1]) {
    const rawVal = amountMatch[1].replace(/\./g, "").replace(",", ".");
    amount = parseFloat(rawVal);
  }

  // Identifica compras comuns do Nubank, Inter, Itau, Bradesco
  // Exemplo Nubank: "Compra de R$ 35,00 aprovada no Estabelecimento X"
  // Exemplo Inter: "Compra aprovada no valor de R$ 50,00 em Padaria"
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
  // Rota chamada por MacroDroid / Tasker no Android
  // POST /api/v1/webhooks/bank-notification
  app.post("/bank-notification", async (request, reply) => {
    const schema = z.object({
      package_name: z.string().optional().default("unknown"), // ex: com.nu.production
      app_name: z.string().optional().default("Banco"),       // ex: Nubank
      title: z.string().optional().default(""),
      text: z.string()                                        // ex: "Compra de R$ 45,90 aprovada no Supermercado BH"
    });

    const body = schema.parse(request.body);
    const parsed = parseBankNotification(body.app_name, `${body.title} ${body.text}`);

    if (!parsed.amount) {
      return reply.status(400).send({
        success: false,
        message: "Nao foi possivel extrair o valor da transacao da notificacao."
      });
    }

    // Busca conta associada ou a primeira conta cadastrada
    const firstAccount = await db.select().from(accounts).limit(1);
    const accountId = firstAccount.length > 0 ? firstAccount[0].id : null;

    if (!accountId) {
      return reply.status(422).send({
        success: false,
        message: "Nenhuma conta cadastrada no app para vincular o lancamento."
      });
    }

    // Cria transacao com status "PENDING_CONFIRMATION" para revisao no app
    const [newTx] = await db.insert(transactions).values({
      description: parsed.establishment,
      amount: parsed.amount.toFixed(2),
      type: "EXPENSE",
      date: new Date(),
      status: "PENDING_CONFIRMATION",
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
