import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, accounts, categories } from "../../database/schema.js";
import { eq, and, sql, or } from "drizzle-orm";

export interface ParsedStatementItem {
  externalId: string;
  date: string; // YYYY-MM-DD
  description: string;
  originalDescription: string;
  amount: string; // ex "27.50"
  typeId: 1 | 2; // 1 = Receita, 2 = Despesa
  suggestedCategoryId: number | null;
  isDuplicate: boolean;
  duplicateReason?: string;
}

// 1. Sanitizador de Codificacao (Corrige Mojibake como DescriÃ§Ã£o -> Descricao, dÃ©bito -> debito)
export function sanitizeEncoding(str: string): string {
  if (!str) return "";

  let fixed = str;
  try {
    if (/[\u00C2\u00C3]/.test(fixed)) {
      fixed = Buffer.from(fixed, "binary").toString("utf-8");
    }
  } catch {
    // fallback
  }

  const mojibakeMap: Record<string, string> = {
    "Ã¡": "á", "Ã ": "à", "Ã¢": "â", "Ã£": "ã", "Ã¤": "ä",
    "Ã©": "é", "Ã¨": "è", "Ãª": "ê", "Ã«": "ë",
    "Ã­": "í", "Ã¬": "ì", "Ã®": "î", "Ã¯": "ï",
    "Ã³": "ó", "Ã²": "ò", "Ã´": "ô", "Ãµ": "õ", "Ã¶": "ö",
    "Ãº": "ú", "Ã¹": "ù", "Ã»": "û", "Ã¼": "ü",
    "Ã§": "ç", "Ã±": "ñ",
    "Ã‰": "É", "Ãˆ": "È", "ÃŠ": "Ê", "Ã‹": "Ë",
    "Ã“": "Ó", "Ã’": "Ò", "Ã”": "Ô", "Ã•": "Õ", "Ã–": "Ö",
    "Ãš": "Ú", "Ã™": "Ù", "Ã›": "Û", "Ãœ": "Ü",
    "Ã‡": "Ç", "Ã‘": "Ñ",
  };

  for (const [bad, good] of Object.entries(mojibakeMap)) {
    if (fixed.includes(bad)) {
      fixed = fixed.split(bad).join(good);
    }
  }

  return fixed.trim();
}

// 2. Limpeza opcional do prefixo redundante (ex: "Compra no debito - ")
export function cleanDescription(rawDesc: string): string {
  const sanitized = sanitizeEncoding(rawDesc);
  const match = sanitized.match(/^(?:compra\s+no\s+(?:d[ée]bito|cr[ée]dito)|pagamento\s+de\s+fatura|transfer[êe]ncia\s+(?:enviada|recebida)\s+pelo\s+pix|pix\s+(?:enviado|recebido))\s*-\s*(.+)$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return sanitized;
}

// 3. Regra de sugestao inteligente de categorias baseada em palavras-chave
function suggestCategory(description: string, userCategories: { id: number; name: string }[]): number | null {
  const descLower = description.toLowerCase();

  const rules: { keywords: string[]; categoryMatch: string[] }[] = [
    { keywords: ["uber", "99app", "combustivel", "gasolina", "posto", "ipva", "estacionamento", "pedagio"], categoryMatch: ["transporte", "veiculo", "carro"] },
    { keywords: ["supermercado", "mercado", "rissul", "zaffari", "carrefour", "pao de acucar", "atacadao", "assai", "bistek", "muffato"], categoryMatch: ["alimentacao", "supermercado", "mercado"] },
    { keywords: ["ifood", "restaurante", "lanchonete", "burger", "mcdonald", "subway", "bar", "cafe", "padaria"], categoryMatch: ["refeicao", "restaurante", "alimentacao"] },
    { keywords: ["farmacia", "droga", "panvel", "sao joao", "raia", "drogasil", "hospital", "clinica", "medico"], categoryMatch: ["saude", "farmacia"] },
    { keywords: ["netflix", "spotify", "amazon prime", "disney", "cinema", "ingresso", "steam", "playstation"], categoryMatch: ["lazer", "entretenimento"] },
    { keywords: ["salario", "remuneracao", "pro-labore", "rendimento", "ted recebida", "pix recebido"], categoryMatch: ["salario", "receita", "renda"] },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => descLower.includes(kw))) {
      const matchedCat = userCategories.find(c => {
        const catNameLower = c.name.toLowerCase();
        return rule.categoryMatch.some(target => catNameLower.includes(target));
      });
      if (matchedCat) return matchedCat.id;
    }
  }

  return null;
}

// 4. Parser de CSV (Nubank e formatos comuns)
function parseCSV(content: string): { dateStr: string; amount: number; id: string; description: string }[] {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const separator = headerLine.includes(";") ? ";" : ",";
  const headers = headerLine.split(separator).map(h => sanitizeEncoding(h.trim().toLowerCase()));

  const dateIdx = headers.findIndex(h => h.includes("data") || h.includes("date"));
  const valueIdx = headers.findIndex(h => h.includes("valor") || h.includes("value") || h.includes("amount"));
  const idIdx = headers.findIndex(h => h.includes("identificador") || h.includes("id") || h.includes("uuid"));
  const descIdx = headers.findIndex(h => h.includes("descri") || h.includes("memo") || h.includes("titulo"));

  const results: { dateStr: string; amount: number; id: string; description: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(separator).map(c => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length <= 1) continue;

    const rawDate = dateIdx >= 0 ? cols[dateIdx] : cols[0];
    const rawValue = valueIdx >= 0 ? cols[valueIdx] : cols[1];
    const rawId = idIdx >= 0 ? cols[idIdx] : "";
    const rawDesc = descIdx >= 0 ? cols[descIdx] : (cols[3] || cols[2] || "");

    if (!rawDate || !rawValue) continue;

    let isoDate = "";
    const brDateMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brDateMatch) {
      const day = brDateMatch[1].padStart(2, "0");
      const month = brDateMatch[2].padStart(2, "0");
      const year = brDateMatch[3];
      isoDate = `${year}-${month}-${day}`;
    } else {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        isoDate = d.toISOString().split("T")[0];
      }
    }

    const cleanNumStr = rawValue.replace(/\s+/g, "").replace(",", ".");
    const num = parseFloat(cleanNumStr);
    if (isNaN(num) || !isoDate) continue;

    results.push({
      dateStr: isoDate,
      amount: num,
      id: sanitizeEncoding(rawId),
      description: sanitizeEncoding(rawDesc),
    });
  }

  return results;
}

// 5. Parser de OFX (Padrao Bancario XML/SGML)
function parseOFX(content: string): { dateStr: string; amount: number; id: string; description: string }[] {
  const transactions: { dateStr: string; amount: number; id: string; description: string }[] = [];
  const stmtTrnBlocks = content.split(/<STMTTRN>/i);

  for (let i = 1; i < stmtTrnBlocks.length; i++) {
    const block = stmtTrnBlocks[i].split(/<\/STMTTRN>/i)[0];

    const fitidMatch = block.match(/<FITID>([^<\r\n]+)/i);
    const amtMatch = block.match(/<TRNAMT>([^<\r\n]+)/i);
    const dateMatch = block.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/i);
    const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i) || block.match(/<NAME>([^<\r\n]+)/i);

    if (amtMatch && dateMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2];
      const day = dateMatch[3];
      const isoDate = `${year}-${month}-${day}`;
      const amount = parseFloat(amtMatch[1].replace(",", "."));
      const id = fitidMatch ? fitidMatch[1].trim() : "";
      const memo = memoMatch ? memoMatch[1].trim() : "Lancamento Bancario";

      transactions.push({
        dateStr: isoDate,
        amount,
        id: sanitizeEncoding(id),
        description: sanitizeEncoding(memo),
      });
    }
  }

  return transactions;
}

export async function importRoutes(app: FastifyInstance) {
  // Autenticacao obrigatoria
  app.addHook("preHandler", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ success: false, message: "Nao autorizado." });
    }
  });

  // POST /api/v1/import/parse
  app.post("/parse", async (request, reply) => {
    const schema = z.object({
      fileContent: z.string().min(5),
      fileName: z.string().optional(),
      accountId: z.number()
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: "Dados do arquivo invalidos." });
    }

    const { fileContent, fileName = "", accountId } = parsed.data;
    const user = request.user as { id: number };

    // 1. Busca categorias do usuario para auto-categorizacao
    const userCategories = await db.select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(
        or(eq(categories.userId, user.id), sql`${categories.userId} IS NULL`),
        sql`${categories.deletedAt} IS NULL`
      ));

    // 2. Busca transacoes existentes da conta para verificacao de duplicidade
    const existingTxs = await db.select({
      id: transactions.id,
      amount: transactions.amount,
      date: transactions.date,
      importId: transactions.importId,
      description: transactions.description
    }).from(transactions)
      .where(and(
        eq(transactions.userId, user.id),
        eq(transactions.accountId, accountId),
        sql`${transactions.deletedAt} IS NULL`
      ));

    // 3. Detecta se e OFX ou CSV
    const isOfx = fileName.toLowerCase().endsWith(".ofx") || fileContent.includes("<OFX>") || fileContent.includes("<STMTTRN>");
    const parsedRaw = isOfx ? parseOFX(fileContent) : parseCSV(fileContent);

    if (parsedRaw.length === 0) {
      return reply.status(400).send({
        success: false,
        message: "Nao foi possivel encontrar lancamentos validos no arquivo. Verifique o formato."
      });
    }

    // 4. Mapeia e analisa cada lancamento
    const previewItems: ParsedStatementItem[] = parsedRaw.map(raw => {
      const isExpense = raw.amount < 0;
      const absAmount = Math.abs(raw.amount).toFixed(2);
      const cleanedDesc = cleanDescription(raw.description);
      const suggestedCategoryId = suggestCategory(cleanedDesc, userCategories);

      let isDuplicate = false;
      let duplicateReason: string | undefined = undefined;

      const dupById = raw.id ? existingTxs.find(e => e.importId === raw.id) : null;
      if (dupById) {
        isDuplicate = true;
        duplicateReason = "Identificador unico ja cadastrado";
      } else {
        const dupByDetail = existingTxs.find(e => {
          const eDate = new Date(e.date).toISOString().split("T")[0];
          const eAmount = Math.abs(parseFloat(e.amount)).toFixed(2);
          return eDate === raw.dateStr && eAmount === absAmount;
        });

        if (dupByDetail) {
          isDuplicate = true;
          duplicateReason = `Mesma data e valor de "${dupByDetail.description}"`;
        }
      }

      return {
        externalId: raw.id,
        date: raw.dateStr,
        description: cleanedDesc,
        originalDescription: raw.description,
        amount: absAmount,
        typeId: isExpense ? 2 : 1,
        suggestedCategoryId,
        isDuplicate,
        duplicateReason
      };
    });

    return reply.send({
      success: true,
      data: {
        totalFound: previewItems.length,
        newItemsCount: previewItems.filter(i => !i.isDuplicate).length,
        duplicatesCount: previewItems.filter(i => i.isDuplicate).length,
        items: previewItems
      }
    });
  });

  // POST /api/v1/import/confirm
  app.post("/confirm", async (request, reply) => {
    const user = request.user as { id: number };

    const schema = z.object({
      accountId: z.number(),
      items: z.array(z.object({
        date: z.string(),
        description: z.string().min(1),
        amount: z.string(),
        typeId: z.number(),
        categoryId: z.number().nullable().optional(),
        externalId: z.string().optional()
      })).min(1)
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: "Dados de confirmacao invalidos." });
    }

    const { accountId, items } = parsed.data;

    const [acc] = await db.select().from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, user.id)))
      .limit(1);

    if (!acc) {
      return reply.status(404).send({ success: false, message: "Conta nao encontrada." });
    }

    let balanceDelta = 0;

    await db.transaction(async (tx) => {
      for (const item of items) {
        const amountNum = parseFloat(item.amount);
        if (item.typeId === 1) {
          balanceDelta += amountNum;
        } else {
          balanceDelta -= amountNum;
        }

        const parsedDate = item.date.includes("T") ? new Date(item.date) : new Date(`${item.date}T12:00:00`);

        await tx.insert(transactions).values({
          description: item.description,
          amount: item.amount,
          typeId: item.typeId,
          statusId: 1, // CONFIRMED
          date: parsedDate,
          accountId: accountId,
          categoryId: item.categoryId || null,
          importId: item.externalId || null,
          notes: "Importado via Extrato Bancario",
          userId: user.id
        });
      }

      // Atualiza o saldo somando o delta arredondado em 2 casas
      const fixedDelta = parseFloat(balanceDelta.toFixed(2));
      await tx.update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${fixedDelta}::numeric`,
          updatedAt: new Date()
        })
        .where(and(eq(accounts.id, accountId), eq(accounts.userId, user.id)));
    });

    return reply.status(201).send({
      success: true,
      message: `${items.length} transacoes importadas com sucesso!`,
      importedCount: items.length
    });
  });
}
