import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, transactionItems, transactionTags, transactionItemTags, accounts, categories, tags } from "../../database/schema.js";
import { desc, eq, isNull, sql, and, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { splitInstallments, addMonthsClamped } from "./installments.js";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface BalanceEffect {
  typeId: number;
  amount: string;
  accountId: number;
  destinationAccountId?: number | null;
}

// Soma (direction = 1) ou desfaz (direction = -1) o efeito de um lancamento CONFIRMADO
// no saldo das contas. Usa o valor como texto (numeric) para evitar erro de ponto flutuante.
export async function applyBalanceEffect(tx: Tx, userId: number, t: BalanceEffect, direction: 1 | -1) {
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
    
    // Itens e tags so dos lancamentos deste usuario (nao varre a tabela inteira)
    const txIds = all.map(t => t.id);
    let items: (typeof transactionItems.$inferSelect)[] = [];
    let allTxTags: (typeof transactionTags.$inferSelect)[] = [];
    let allItemTags: (typeof transactionItemTags.$inferSelect)[] = [];
    if (txIds.length > 0) {
      items = await db.select().from(transactionItems)
        .where(and(inArray(transactionItems.transactionId, txIds), isNull(transactionItems.deletedAt)));
      allTxTags = await db.select().from(transactionTags)
        .where(inArray(transactionTags.transactionId, txIds));
      const itemIds = items.map(i => i.id);
      if (itemIds.length > 0) {
        allItemTags = await db.select().from(transactionItemTags)
          .where(inArray(transactionItemTags.transactionItemId, itemIds));
      }
    }

    const group = <T, K>(list: T[], key: (x: T) => K) => {
      const m = new Map<K, T[]>();
      for (const x of list) {
        const k = key(x);
        const cur = m.get(k);
        if (cur) cur.push(x); else m.set(k, [x]);
      }
      return m;
    };
    const tagsByTx = group(allTxTags, tt => tt.transactionId);
    const itemsByTx = group(items, i => i.transactionId);
    const tagsByItem = group(allItemTags, it => it.transactionItemId);

    const txMap = all.map(t => ({
      ...t,
      tagIds: (tagsByTx.get(t.id) ?? []).map(tt => tt.tagId),
      items: (itemsByTx.get(t.id) ?? []).map(i => ({
        ...i,
        tagIds: (tagsByItem.get(i.id) ?? []).map(it => it.tagId)
      }))
    }));

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
      installments: z.number().int().min(1).max(24).optional(),
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

    // Compra parcelada: so despesa em conta do tipo cartao de credito (typeId 2)
    const installments = data.installments ?? 1;
    if (installments > 1) {
      if (data.typeId !== 2) {
        return reply.status(400).send({ success: false, message: "Só despesas podem ser parceladas." });
      }
      const [acc] = await db.select().from(accounts)
        .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)))
        .limit(1);
      if (!acc || acc.typeId !== 2) {
        return reply.status(400).send({ success: false, message: "Parcelamento só vale para cartão de crédito." });
      }
      const amounts = splitInstallments(data.amount, installments);
      const baseDate = new Date(data.date);
      const groupId = randomUUID();

      const rows = await db.transaction(async (tx) => {
        const out = [];
        for (let i = 0; i < installments; i++) {
          const [row] = await tx.insert(transactions).values({
            description: `${data.description} (${i + 1}/${installments})`,
            amount: amounts[i],
            typeId: 2,
            statusId: data.statusId,
            date: addMonthsClamped(baseDate, i),
            accountId: data.accountId,
            categoryId: data.categoryId,
            notes: data.notes,
            installmentNumber: i + 1,
            totalInstallments: installments,
            installmentGroupId: groupId,
            userId: user.id
          }).returning();

          if (data.tagIds && data.tagIds.length > 0) {
            await tx.insert(transactionTags).values(
              data.tagIds.map(tId => ({ transactionId: row.id, tagId: tId }))
            );
          }
          // Divida e limite do cartao consideram o total da compra desde o inicio
          if (row.statusId === 1) {
            await applyBalanceEffect(tx, user.id, row, 1);
          }
          out.push(row);
        }
        return out;
      });
      return reply.status(201).send(rows[0]);
    }

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

  // SOFT DELETE de transacao (marca deleted_at e estorna saldo).
  // Com ?scope=group, apaga todas as parcelas da mesma compra parcelada.
  app.delete("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const { scope } = z.object({ scope: z.enum(["one", "group"]).default("one") }).parse(request.query);

    await db.transaction(async (tx) => {
      const [found] = await tx.select().from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
        .limit(1)
        .for("update");

      // Ja excluida (ou inexistente): nao estorna de novo
      if (!found || found.deletedAt) return;

      const targets = scope === "group" && found.installmentGroupId
        ? await tx.select().from(transactions)
            .where(and(
              eq(transactions.installmentGroupId, found.installmentGroupId),
              eq(transactions.userId, user.id),
              isNull(transactions.deletedAt)
            ))
            .orderBy(transactions.id)
            .for("update")
        : [found];

      for (const t of targets) {
        if (t.statusId === 1) {
          await applyBalanceEffect(tx, user.id, t, -1);
        }

        await tx.update(transactions)
          .set({ deletedAt: new Date() })
          .where(and(eq(transactions.id, t.id), eq(transactions.userId, user.id)));

        await tx.update(transactionItems)
          .set({ deletedAt: new Date() })
          .where(eq(transactionItems.transactionId, t.id));
      }
    });

    return reply.send({ success: true, message: "Transação excluída (soft delete)" });
  });

  // Confirmar varias transacoes pendentes de uma vez (tudo ou nada, saldo aplicado uma vez por lancamento)
  app.post("/confirm-batch", async (request, reply) => {
    const user = request.user as { id: number };
    const { ids } = z.object({
      ids: z.array(z.number().int()).min(1).max(200)
    }).parse(request.body);

    const confirmed = await db.transaction(async (tx) => {
      const pendingRows = await tx.select().from(transactions)
        .where(and(
          inArray(transactions.id, ids),
          eq(transactions.userId, user.id),
          isNull(transactions.deletedAt),
          eq(transactions.statusId, 2)
        ))
        .orderBy(transactions.id)
        .for("update");

      for (const old of pendingRows) {
        const [row] = await tx.update(transactions)
          .set({ statusId: 1, updatedAt: new Date() })
          .where(and(eq(transactions.id, old.id), eq(transactions.userId, user.id)))
          .returning();
        await applyBalanceEffect(tx, user.id, row, 1);
      }
      return pendingRows.length;
    });

    return reply.send({ success: true, confirmed });
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
