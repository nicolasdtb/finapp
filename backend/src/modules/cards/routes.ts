import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { accounts, transactions, cardInvoicePayments } from "../../database/schema.js";
import { and, eq, isNull, ne } from "drizzle-orm";
import { applyBalanceEffect } from "../transactions/routes.js";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function cardRoutes(app: FastifyInstance) {
  // Autenticacao obrigatoria
  app.addHook("preHandler", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ success: false, message: "Não autorizado." });
    }
  });

  // Pagamentos de fatura registrados pelo usuario (a tela de Cartoes calcula o status das faturas com isso)
  app.get("/payments", async (request, reply) => {
    const user = request.user as { id: number };
    const rows = await db.select().from(cardInvoicePayments)
      .where(eq(cardInvoicePayments.userId, user.id));
    return reply.send(rows.map(r => ({
      id: r.id,
      accountId: r.accountId,
      ref: r.ref,
      amount: r.amount,
      fromAccountId: r.fromAccountId,
      paidAt: r.paidAt
    })));
  });

  // Pagar uma fatura: transferencia da conta escolhida para o cartao + marca a fatura como paga.
  // Nao e despesa (a compra ja foi contada na data em que foi feita).
  app.post("/:accountId/pay", async (request, reply) => {
    const user = request.user as { id: number };
    const { accountId } = z.object({ accountId: z.coerce.number().int() }).parse(request.params);
    const body = z.object({
      ref: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Fatura inválida"),
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido"),
      fromAccountId: z.number().int()
    }).parse(request.body);

    if (parseFloat(body.amount) <= 0) {
      return reply.status(400).send({ success: false, message: "Informe um valor maior que zero." });
    }

    try {
      const payment = await db.transaction(async (tx) => {
        // FOR UPDATE no cartao: dois toques em "pagar" nao registram duas vezes
        const [card] = await tx.select().from(accounts)
          .where(and(
            eq(accounts.id, accountId),
            eq(accounts.userId, user.id),
            isNull(accounts.deletedAt),
            eq(accounts.typeId, 2)
          ))
          .limit(1)
          .for("update");
        if (!card) throw new HttpError(404, "Cartão não encontrado.");

        const [from] = await tx.select().from(accounts)
          .where(and(
            eq(accounts.id, body.fromAccountId),
            eq(accounts.userId, user.id),
            isNull(accounts.deletedAt),
            ne(accounts.typeId, 2)
          ))
          .limit(1);
        if (!from) throw new HttpError(400, "Conta de origem inválida.");

        const [already] = await tx.select({ id: cardInvoicePayments.id }).from(cardInvoicePayments)
          .where(and(eq(cardInvoicePayments.accountId, card.id), eq(cardInvoicePayments.ref, body.ref)))
          .limit(1);
        if (already) throw new HttpError(409, "Esta fatura já está marcada como paga.");

        const [payTx] = await tx.insert(transactions).values({
          description: `Pagamento da fatura ${card.name} ${body.ref.slice(5)}/${body.ref.slice(0, 4)}`,
          amount: body.amount,
          typeId: 3,
          statusId: 1,
          date: new Date(),
          accountId: from.id,
          destinationAccountId: card.id,
          userId: user.id
        }).returning();

        await applyBalanceEffect(tx, user.id, payTx, 1);

        const [created] = await tx.insert(cardInvoicePayments).values({
          userId: user.id,
          accountId: card.id,
          ref: body.ref,
          amount: body.amount,
          fromAccountId: from.id,
          transactionId: payTx.id
        }).returning();

        return created;
      });
      return reply.status(201).send({ success: true, payment });
    } catch (err) {
      if (err instanceof HttpError) {
        return reply.status(err.status).send({ success: false, message: err.message });
      }
      throw err;
    }
  });

  // Desfazer o pagamento: estorna o saldo, exclui a transferencia e reabre a fatura.
  app.delete("/payments/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);

    const done = await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(cardInvoicePayments)
        .where(and(eq(cardInvoicePayments.id, id), eq(cardInvoicePayments.userId, user.id)))
        .limit(1)
        .for("update");
      if (!payment) return false;

      if (payment.transactionId) {
        const [payTx] = await tx.select().from(transactions)
          .where(and(eq(transactions.id, payment.transactionId), eq(transactions.userId, user.id)))
          .limit(1)
          .for("update");
        if (payTx && !payTx.deletedAt) {
          if (payTx.statusId === 1) {
            await applyBalanceEffect(tx, user.id, payTx, -1);
          }
          await tx.update(transactions)
            .set({ deletedAt: new Date() })
            .where(eq(transactions.id, payTx.id));
        }
      }

      await tx.delete(cardInvoicePayments).where(eq(cardInvoicePayments.id, payment.id));
      return true;
    });

    if (!done) {
      return reply.status(404).send({ success: false, message: "Pagamento não encontrado." });
    }
    return reply.send({ success: true });
  });
}
