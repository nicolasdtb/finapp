import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, transactionItems, transactionTags, transactionItemTags, accounts, categories, tags } from "../../database/schema.js";
import { desc, eq, isNull, sql, and, inArray } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface BalanceEffect {
  typeId: number;
  amount: string;
  accountId: number;
  destinationAccountId?: number | null;
}

// Soma (direction = 1) ou desfaz (direction = -1) o efeito de um lancamento CONFIRMADO
// no saldo das contas. Usa o valor como texto (numeric) para evitar erro de ponto flutuante.
async function applyBalanceEffect(tx: Tx, userId: number, t: BalanceEffect, direction: 1 | -1) {
  const move = async (accountId: number, sign: 1 | -1) => {
    const delta = sql`${accounts.balance} + ${t.amount}::numeric`;
    const inverse = sql`${accounts.balance} - ${t.amount}::numeric`;
    await tx.update(accounts)
      .set({ balance: sign * direction === 1 ? delta : inverse })
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  };

  if (t.typeId === 1) {
    await move(t.accountId, 1);
  } else if (t.typeId === 2) {
    await move(t.accountId, -1);
  } else if (t.typeId === 3 && t.destinationAccountId) {
    // Transferencia: sai da origem e entra no destino
    await move(t.accountId, -1);
    await move(t.destinationAccountId, 1);
  }
}

export async function transactionRoutes(app: FastifyInstance) {
  // Hook de autenticacao obrigatoria
  app.addHook("preHandler", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ success: false, message: "Não autorizado." });
    }
  });

  // Listar transacoes do usuario logado (ignora soft-deleted) com tags
  app.get("/", async (request, reply) => {
    const user = request.user as { id: number };
    const all = await db.select().from(transactions)
      .where(and(isNull(transactions.deletedAt), eq(transactions.userId, user.id)))
      .orderBy(desc(transactions.date), desc(transactions.id));
    
    const items = await db.select().from(transactionItems).where(isNull(transactionItems.deletedAt));
    const allTxTags = await db.select().from(transactionTags);
    const allItemTags = await db.select().from(transactionItemTags);

    const txMap = all.map(t => {
      const txTagIds = allTxTags.filter(tt => tt.transactionId === t.id).map(tt => tt.tagId);
      const tItems = items.filter(i => i.transactionId === t.id).map(i => ({
        ...i,
        tagIds: allItemTags.filter(it => it.transactionItemId === i.id).map(it => it.tagId)
      }));

      return {
        ...t,
        tagIds: txTagIds,
        items: tItems
      };
    });

    return reply.send(txMap);
  });

  // Criar transacao associada ao usuario logado
  app.post("/", async (request, reply) => {
    const user = request.user as { id: number };
    const schema = z.object({
      description: z.string().min(1),
      amount: z.string(),
      typeId: z.number().default(2),
      statusId: z.number().default(1),
      date: z.string(),
      accountId: z.number(),
      categoryId: z.number().nullable().optional(),
      destinationAccountId: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
      tagIds: z.array(z.number()).optional(),
      items: z.array(z.object({
        name: z.string().min(1),
        quantity: z.string().default("1"),
        unitPrice: z.string(),
        totalPrice: z.string(),
        categoryId: z.number().nullable().optional(),
        tagIds: z.array(z.number()).optional()
      })).optional()
    });

    const data = schema.parse(request.body);

    // Tudo ou nada: lancamento, itens, tags e saldo na mesma transacao do banco.
    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(transactions).values({
        description: data.description,
        amount: data.amount,
        typeId: data.typeId,
        statusId: data.statusId,
        date: new Date(data.date),
        accountId: data.accountId,
        categoryId: data.categoryId,
        destinationAccountId: data.destinationAccountId,
        notes: data.notes,
        userId: user.id
      }).returning();

      if (data.tagIds && data.tagIds.length > 0) {
        await tx.insert(transactionTags).values(
          data.tagIds.map(tId => ({ transactionId: row.id, tagId: tId }))
        );
      }

      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          const [createdItem] = await tx.insert(transactionItems).values({
            transactionId: row.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            categoryId: item.categoryId || data.categoryId,
          }).returning();

          if (item.tagIds && item.tagIds.length > 0) {
            await tx.insert(transactionItemTags).values(
              item.tagIds.map(tId => ({ transactionItemId: createdItem.id, tagId: tId }))
            );
          }
        }
      }

      // Saldo so muda para lancamento CONFIRMADO (pendente nao mexe no saldo)
      if (row.statusId === 1) {
        await applyBalanceEffect(tx, user.id, row, 1);
      }

      return row;
    });

    return reply.status(201).send(created);
  });

  // Atualizar transacao do usuario (incluindo detalhamento de itens e tags)
  app.put("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const schema = z.object({
      description: z.string().min(1).optional(),
      amount: z.string().optional(),
      typeId: z.number().optional(),
      statusId: z.number().optional(),
      date: z.string().optional(),
      accountId: z.number().optional(),
      categoryId: z.number().nullable().optional(),
      destinationAccountId: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
      tagIds: z.array(z.number()).optional(),
      items: z.array(z.object({
        name: z.string().min(1),
        quantity: z.string().default("1"),
        unitPrice: z.string(),
        totalPrice: z.string(),
        categoryId: z.number().nullable().optional(),
        tagIds: z.array(z.number()).optional()
      })).optional()
    });

    const data = schema.parse(request.body);
    const { items, tagIds, ...txFields } = data;

    const updated = await db.transaction(async (tx) => {
      // FOR UPDATE: trava a linha para duas edicoes simultaneas nao se atropelarem
      const [oldTx] = await tx.select().from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id), isNull(transactions.deletedAt)))
        .limit(1)
        .for("update");

      if (!oldTx) return null;

      const [row] = await tx.update(transactions)
        .set({
          ...txFields,
          date: txFields.date ? new Date(txFields.date) : undefined,
          updatedAt: new Date()
        })
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
        .returning();

      if (tagIds !== undefined) {
        await tx.delete(transactionTags).where(eq(transactionTags.transactionId, id));
        if (tagIds.length > 0) {
          await tx.insert(transactionTags).values(
            tagIds.map(tId => ({ transactionId: id, tagId: tId }))
          );
        }
      }

      if (items !== undefined) {
        await tx.update(transactionItems)
          .set({ deletedAt: new Date() })
          .where(eq(transactionItems.transactionId, id));

        for (const item of items) {
          const [createdItem] = await tx.insert(transactionItems).values({
            transactionId: id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            categoryId: item.categoryId || row.categoryId,
          }).returning();

          if (item.tagIds && item.tagIds.length > 0) {
            await tx.insert(transactionItemTags).values(
              item.tagIds.map(tId => ({ transactionItemId: createdItem.id, tagId: tId }))
            );
          }
        }
      }

      // Saldo: desfaz o efeito antigo se ele estava confirmado e aplica o novo se ficou confirmado.
      //   pendente -> confirmado : aplica o novo
      //   confirmado -> confirmado: desfaz o antigo e aplica o novo
      //   confirmado -> pendente : desfaz o antigo
      if (oldTx.statusId === 1) {
        await applyBalanceEffect(tx, user.id, oldTx, -1);
      }
      if (row.statusId === 1) {
        await applyBalanceEffect(tx, user.id, row, 1);
      }

      return row;
    });

    if (!updated) {
      return reply.status(404).send({ success: false, message: "Transação não encontrada." });
    }
    return reply.send(updated);
  });

  // SOFT DELETE de transacao (marca deleted_at e estorna saldo)
  app.delete("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    await db.transaction(async (tx) => {
      const [found] = await tx.select().from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
        .limit(1)
        .for("update");

      // Ja excluida (ou inexistente): nao estorna de novo
      if (!found || found.deletedAt) return;

      if (found.statusId === 1) {
        await applyBalanceEffect(tx, user.id, found, -1);
      }

      await tx.update(transactions)
        .set({ deletedAt: new Date() })
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));

      await tx.update(transactionItems)
        .set({ deletedAt: new Date() })
        .where(eq(transactionItems.transactionId, id));
    });

    return reply.send({ success: true, message: "Transação excluída (soft delete)" });
  });

  // Confirmar transacao pendente de notificacao bancaria
  app.patch("/:id/confirm", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const schema = z.object({
      categoryId: z.number().optional(),
      accountId: z.number().optional(),
      destinationAccountId: z.number().optional(),
      typeId: z.number().optional(),
      description: z.string().optional()
    });
    const updates = schema.parse(request.body);

    const updated = await db.transaction(async (tx) => {
      // FOR UPDATE: dois toques em "confirmar" ao mesmo tempo nao aplicam o saldo duas vezes
      const [oldTx] = await tx.select().from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id), isNull(transactions.deletedAt)))
        .limit(1)
        .for("update");

      if (!oldTx) return null;

      const [row] = await tx.update(transactions)
        .set({ ...updates, statusId: 1, updatedAt: new Date() })
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
        .returning();

      // So mexe no saldo se estava pendente
      if (oldTx.statusId === 2) {
        await applyBalanceEffect(tx, user.id, row, 1);
      }

      return row;
    });

    if (!updated) {
      return reply.status(404).send({ success: false, message: "Transação não encontrada." });
    }
    return reply.send(updated);
  });
}
