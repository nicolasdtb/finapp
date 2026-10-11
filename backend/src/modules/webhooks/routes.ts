import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, accounts, users, categories } from "../../database/schema.js";
import { eq, isNull, isNotNull, and, gte, sql, desc } from "drizzle-orm";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { splitInstallments, addMonthsClamped } from "../transactions/installments.js";

// Compara segredos sem vazar informacao pelo tempo de resposta.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// Compara nomes de banco ignorando acento, caixa e o prefixo "Banco " ("Banco Inter" == "inter")
const normBank = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^banco\s+/, "").trim();

// Sugere a categoria pelo historico: a mais usada pelo usuario em lancamentos confirmados
// com a mesma descricao (ex.: "Pix: Fulano", "Padaria X") e do mesmo tipo (receita/despesa).
async function suggestCategory(userId: number, description: string, typeId: number): Promise<number | null> {
  const [best] = await db
    .select({ categoryId: transactions.categoryId, uses: sql<number>`count(*)` })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.statusId, 1),
      eq(transactions.typeId, typeId),
      isNull(transactions.deletedAt),
      isNull(categories.deletedAt),
      isNotNull(transactions.categoryId),
      sql`lower(${transactions.description}) = lower(${description})`
    ))
    .groupBy(transactions.categoryId)
    .orderBy(desc(sql`count(*)`))
    .limit(1);
  return best?.categoryId ?? null;
}

export function parseBankNotification(appName: string, text: string) {
  let amount: number | null = null;
  let establishment: string = "Despesa Bancária";
  let typeId: number = 2; // 1 = Receita (Income), 2 = Despesa (Expense)

  // Parcelamento: "em 3x", "3x sem juros" ou "3 parcelas". "em 1x" e a vista.
  const instMatch = text.match(/\bem\s+(\d{1,2})\s*x\b/i) || text.match(/\b(\d{1,2})\s+parcelas\b/i);
  const parsedInstallments = instMatch ? parseInt(instMatch[1], 10) : 1;
  // Tira o trecho "em Nx" para ele nao ser confundido com o nome do estabelecimento
  text = text.replace(/\bem\s+\d{1,2}\s*x\b/gi, " ").replace(/\s{2,}/g, " ").trim();

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
    // "... APROVADO em 99Food." (formato do Nubank): o estabelecimento vem depois de "aprovado em"
    const approvedMatch = text.match(/aprovad[oa]\s+(?:em|no|na)\s+([^,\.]+?)(?:\s+(?:no valor|com|por aproxima[cç][aã]o)|\.|$)/i);
    const directMatch = text.match(/compra\s+(?:de\s+R\$\s*[\d\.,]+\s+)?(?:aprovada\s+)?(?:em|no|na)\s+([^,\.]+?)(?:\.|$)/i);

    if (pixMatch && pixMatch[1] && (lowerText.includes("transfer") || lowerText.includes("pix"))) {
      establishment = `Pix: ${pixMatch[1].trim()}`;
    } else if (approvedMatch && approvedMatch[1]) {
      establishment = approvedMatch[1].trim();
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
    // So despesa pode ser parcelada; valores absurdos sao ignorados
    installments: typeId === 2 && parsedInstallments > 1 && parsedInstallments <= 24 ? parsedInstallments : 1,
    originalText: text,
    bankHint: appName
  };
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/bank-notification", async (request, reply) => {
    // 1. Autenticacao do webhook: cada usuario tem o proprio token (Configuracoes > Conta),
    //    enviado em ?token= ou Authorization: Bearer. Um JWT de login tambem e aceito.
    let userId: number | null = null;
    const query = request.query as { token?: string };
    const authHeader = request.headers.authorization;
    const token = query.token || (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);

    if (!token) {
      return reply.status(401).send({ success: false, message: "Token de webhook obrigatório." });
    }

    const activeUsers = await db.select({ id: users.id, webhookToken: users.webhookToken })
      .from(users).where(isNull(users.deletedAt));
    const owner = activeUsers.find(u => u.webhookToken && safeEqual(token, u.webhookToken));
    if (owner) {
      userId = owner.id;
    } else {
      try {
        const decoded = app.jwt.verify<{ id: number }>(token);
        userId = decoded.id;
      } catch (err) {
        return reply.status(401).send({ success: false, message: "Token de webhook inválido ou expirado." });
      }
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

      // Contas configuradas para receber as notificacoes deste banco (Configuracoes > Contas)
      const bankKey = normBank(notif.app_name);
      const candidates = userAccounts.filter(acc => acc.notificationBank && normBank(acc.notificationBank) === bankKey);
      let bankAccount: (typeof userAccounts)[number] | undefined = candidates[0];
      if (candidates.length > 1) {
        // Banco com conta e cartao: compra vai para o cartao; Pix e transferencia, para a conta
        const looksLikeCard = parsed.typeId === 2 && /compra|cart[aã]o|cr[eé]dito/i.test(`${notif.title} ${notif.text}`);
        const cards = candidates.filter(acc => acc.typeId === 2);
        const others = candidates.filter(acc => acc.typeId !== 2);
        bankAccount = looksLikeCard ? (cards[0] ?? others[0]) : (others[0] ?? cards[0]);
      }
      // Sem configuracao: tenta pelo nome da conta (sem diferenciar acento)
      if (!bankAccount) {
        bankAccount = userAccounts.find(acc => {
          const accKey = normBank(acc.name);
          return accKey.includes(bankKey) || bankKey.includes(accKey);
        });
      }
      // Sem conta do banco: usa a primeira, mas avisa na observacao para o usuario conferir ao confirmar
      const matchedAccount = bankAccount || userAccounts[0];
      const suggestedCategoryId = await suggestCategory(userId, parsed.establishment, parsed.typeId);

      // Compra parcelada no cartao: cria uma parcela PENDENTE por fatura. O valor da notificacao e
      // tratado como o total da compra; confirmar uma parcela confirma todas as do mesmo grupo.
      const splitInto = parsed.installments > 1 && matchedAccount.typeId === 2 ? parsed.installments : 1;
      const amounts = splitInstallments(parsed.amount.toFixed(2), splitInto);
      const groupId = splitInto > 1 ? randomUUID() : null;
      const baseDate = new Date();

      for (let i = 0; i < splitInto; i++) {
        const notes = !bankAccount
          ? `Conta não identificada automaticamente para "${notif.app_name}". Confira a conta antes de confirmar.`
          : splitInto > 1 && i === 0
            ? `Compra parcelada em ${splitInto}x. O valor da notificação (R$ ${parsed.amount.toFixed(2).replace(".", ",")}) foi tratado como o total. Se for o valor da parcela, exclua todas e lance de novo.`
            : null;

        // 3. Salva a transação como PENDENTE associada estritamente ao usuário
        const [newTx] = await db.insert(transactions).values({
          description: splitInto > 1 ? `${parsed.establishment} (${i + 1}/${splitInto})` : parsed.establishment,
          amount: amounts[i],
          typeId: parsed.typeId, // 1 = RECEITA (Pix recebido), 2 = DESPESA (Compra/Pix enviado)
          statusId: 2,           // 2 = PENDING_CONFIRMATION
          date: addMonthsClamped(baseDate, i),
          accountId: matchedAccount.id,
          categoryId: suggestedCategoryId,
          installmentNumber: splitInto > 1 ? i + 1 : null,
          totalInstallments: splitInto > 1 ? splitInto : null,
          installmentGroupId: groupId,
          userId: userId,
          notes,
          rawBankNotification: rawText
        }).returning();

        createdTxs.push(newTx);
      }
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