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
      url: z.string().min(1),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: "URL ou Chave de Acesso de Nota Fiscal inválida."
      });
    }

    let input = parsed.data.url.trim();
    let targetUrl = input;

    // Se for uma chave de acesso de 44 dígitos (numérica pura ou com espaços/traços)
    const cleanedDigits = input.replace(/\D/g, "");
    if (cleanedDigits.length === 44) {
      const ufCode = cleanedDigits.substring(0, 2);
      switch (ufCode) {
        case "43": // Rio Grande do Sul
          targetUrl = `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${cleanedDigits}|2|1|1`;
          break;
        case "35": // São Paulo
          targetUrl = `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${cleanedDigits}`;
          break;
        case "41": // Paraná
          targetUrl = `http://www.fazenda.pr.gov.br/nfce/qrcode?p=${cleanedDigits}|2|1|1`;
          break;
        case "31": // Minas Gerais
          targetUrl = `https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/consultaarg.xhtml?p=${cleanedDigits}`;
          break;
        case "33": // Rio de Janeiro
          targetUrl = `http://www.fazenda.rj.gov.br/actrnfce/qrcode?p=${cleanedDigits}|2|1|1`;
          break;
        case "42": // Santa Catarina
          targetUrl = `https://sat.sef.sc.gov.br/nfce/consulta?p=${cleanedDigits}|2|1|1`;
          break;
        default: // Fallback padrão SEFAZ RS / SVRS
          targetUrl = `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${cleanedDigits}|2|1|1`;
          break;
      }
    }

    app.log.info({ originalInput: input, targetUrl }, "Iniciando consulta de Nota Fiscal SEFAZ");

    try {
      const response = await fetch(targetUrl, {
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

      // Helper: extrai o último número de um texto com rótulo (ex: "Qtde.:1" → "1", "Vl. Unit.: 16" → "16")
      // Evita o bug onde o ponto em "Qtde." ou "Vl. Unit." era mantido pelo regex [^\d.,]
      const extractLastNumber = (text: string): string => {
        const match = text.match(/(\d+(?:[,.]\d+)?)\s*$/);
        if (match) return match[1].replace(",", ".");
        // fallback: qualquer sequência de dígitos com separador decimal opcional
        const fallback = text.match(/(\d+(?:[,.]\d+)?)/g);
        if (fallback) return fallback[fallback.length - 1].replace(",", ".");
        return "";
      };

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
            const cleanQty = extractLastNumber(qtyText) || "1";
            const cleanUnitPrice = extractLastNumber(unitPriceText) || "0";
            const cleanTotal = extractLastNumber(totalText) || cleanUnitPrice;

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
      // Usa .txtMax diretamente para não capturar o texto completo do div pai #totalNota
      let totalAmount = "0.00";
      const totalEl = $(".txtMax").first().text().trim()
        || $(".totalNFe").first().text().trim()
        || $("span[class*='total']").first().text().trim();
      if (totalEl) {
        const clean = extractLastNumber(totalEl);
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

      app.log.info({ parsedInvoice: result }, "Nota Fiscal processada com sucesso");

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