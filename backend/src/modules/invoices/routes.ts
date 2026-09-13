import { FastifyInstance } from "fastify";
import { z } from "zod";
import * as cheerio from "cheerio";

export interface ParsedInvoiceItem {
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}

export interface ParsedInvoiceResult {
  storeName: string;
  totalAmount: string;
  date: string;
  items: ParsedInvoiceItem[];
}

export async function invoiceRoutes(app: FastifyInstance) {
  // Hook de autenticação obrigatória
  app.addHook("preHandler", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ success: false, message: "Não autorizado." });
    }
  });

  // POST /api/v1/invoices/parse
  app.post("/parse", async (request, reply) => {
    const schema = z.object({
      url: z.string().url(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: "URL de Nota Fiscal inválida."
      });
    }

    const { url } = parsed.data;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });

      if (!response.ok) {
        return reply.status(502).send({
          success: false,
          message: `Falha ao consultar a SEFAZ: HTTP ${response.status}`
        });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 1. Extração do Nome do Estabelecimento
      let storeName = "";
      const txtTopo = $(".txtTopo, .ui-header .txtTopo, #u20, .txtCenter .txtTopo").first().text().trim();
      const companyHeader = $("div[lass*='nome'], div[class*='razao'], .station, .company-name").first().text().trim();
      storeName = txtTopo || companyHeader || $("title").text().trim();

      if (!storeName || storeName.toLowerCase().includes("nfc-e") || storeName.toLowerCase().includes("sefaz")) {
        const fallbackName = $("table").find("td").first().text().trim();
        if (fallbackName && fallbackName.length < 50) {
          storeName = fallbackName;
        } else {
          storeName = "Compra Vevalecimento";
        }
      }

      // 2. Extração dos Itens da Nota
      const items: ParsedInvoiceItem[] = [];

      // Padrão 1: Tabela clássica SEFAZ
      const tableRows = $("#tabResult tr, table[id*='tabResult'] tr, tr[id*='Item']");
      if (tableRows.length > 0) {
        tableRows.each((_, el) => {
          const row = $(el);
          const nameEl = row.find(".txtTit, .txtTit2, td[class*='desc'], span[class*='desc']").first();
          const name = nameEl.text().trim() || row.find("td:nth-child(1)").text().trim();
          const qtyText = row.find(".Rqtd, span[class*='qtd'], td[class*='qtd']").text().trim();
          const unitPriceText = row.find(".RvlUnit, span[class*='unit'], td[class*='unit']").text().trim();
          const totalText = row.find(".valor, .RvalBruto, td[class*='valor']").text().trim();

          if (name && (totalText || unitPriceText)) {
            const cleanQty = qtyText.replace(/[^\d.,]/g, "").replace(",", ".") || "1";
            const cleanUnitPrice = unitPriceText.replace(/[^\d.,]/g, "").replace(",", ".") || "0";
            const cleanTotal = totalText.replace(/[^\d.,]/g, "").replace(",", ".") || cleanUnitPrice;

            items.push({
              name: name.replace(/\s+/g, " "),
              quantity: parseFloat(cleanQty).toString(),
              unitPrice: parseFloat(cleanUnitPrice).toFixed(2),
              totalPrice: parseFloat(cleanTotal).toFixed(2),
            });
          }
        });
      }

      // Padrão 2: Cards / Divs
      if (items.length === 0) {
        $("div[id*='item'], div[class*='item-produto'], ul[data-role='listview'] li").each((_, el) => {
          const card = $(el);
          const name = card.find("h4, h3, .nome, strong").first().text().trim();
          const allText = card.text();

          const qtyMatch = allText.match(/(?:qtd|quant|quantidade)[:\s]+([\d.,]+)/i);
          const unitMatch = allText.match(/(?:un|unit|unit[aá]rio)[:\s]+(?:R\$\s*)?([\d.,]+)/i);
          const totalMatch = allText.match(/(?:total|valor)[:\s]+(?:R\$\s*)?([\d.,]+)/i);

          if (name && (totalMatch || unitMatch)) {
            const cleanQty = qtyMatch ? qtyMatch[1].replace(",", ".") : "1";
            const cleanUnitPrice = unitMatch ? unitMatch[1].replace(",", ".") : "0";
            const cleanTotal = totalMatch ? totalMatch[1].replace(",", ".") : cleanUnitPrice;

            items.push({
              name: name.replace(/\s+/g, " "),
              quantity: parseFloat(cleanQty).toString(),
              unitPrice: parseFloat(cleanUnitPrice).toFixed(2),
              totalPrice: parseFloat(cleanTotal).toFixed(2),
            });
          }
        });
      }

      // 3. Valor Total da Nota
      let totalAmount = "0.00";
      const totalEl = $(".txtMax, .totalNFe, span[class*='total'], #totalNota").first().text().trim();
      if (totalEl) {
        const clean = totalEl.replace(/[^\d.,]/g, "").replace(",", ".");
        const parsedNum = parseFloat(clean);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          totalAmount = parsedNum.toFixed(2);
        }
      }

      if (parseFloat(totalAmount) <= 0 && items.length > 0) {
        const sum = items.reduce((acc, it) => acc + parseFloat(it.totalPrice || "0"), 0);
        totalAmount = sum.toFixed(2);
      }

      // 4. Data da Emissão
      let invoiceDate = new Date().toISOString().split("T")[0];
      const pageText = $("body").text();
      const dateMatch = pageText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        const [_, day, month, year] = dateMatch;
        invoiceDate = `${year}-${month}-${day}`;
      }

      const result: ParsedInvoiceResult = {
        storeName: storeName.replace(/\s+/g, " "),
        totalAmount,
        date: invoiceDate,
        items
      };

      return reply.send({
        success: true,
        data: result
      });

    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        message: "Erro ao processar conteúdo da Nota Fiscal: " + (err.message || err)
      });
    }
  });
}