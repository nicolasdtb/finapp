import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../database/index.js";
import { transactions, transactionItems, transactionTags, transactionItemTags, accounts, categories, tags } from "../../database/schema.js";
import { desc, eq, isNull, sql, and, inArray } from "drizzle-orm";

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

    const [created] = await db.insert(transactions).values({
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

    // Tags da transação
    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(transactionTags).values(
        data.tagIds.map(tId => ({
          transactionId: created.id,
          tagId: tId
        }))
      );
    }

    // Itens e tags de itens
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const [createdItem] = await db.insert(transactionItems).values({
          transactionId: created.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          categoryId: item.categoryId || data.categoryId,
        }).returning();

        if (item.tagIds && item.tagIds.length > 0) {
          await db.insert(transactionItemTags).values(
            item.tagIds.map(tId => ({
              transactionItemId: createdItem.id,
              tagId: tId
            }))
          );
        }
      }
    }

    // Atualiza saldo da conta garantindo que pertence ao usuario
    const amountNum = parseFloat(data.amount);
    if (data.typeId === 1) {
      await db.update(accounts)
        .set({ balance: sql`${accounts.balance} + ${amountNum}` })
        .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)));
    } else if (data.typeId === 2) {
      await db.update(accounts)
        .set({ balance: sql`${accounts.balance} - ${amountNum}` })
        .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)));
    }

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

    const [oldTx] = await db.select().from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .limit(1);

    if (!oldTx) {
      return reply.status(404).send({ success: false, message: "Transação não encontrada." });
    }

    const { items, tagIds, ...txFields } = data;

    const [updated] = await db.update(transactions)
      .set({
        ...txFields,
        date: txFields.date ? new Date(txFields.date) : undefined,
        updatedAt: new Date()
      })
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning();

    // Sincroniza tags da transação
    if (tagIds !== undefined) {
      await db.delete(transactionTags).where(eq(transactionTags.transactionId, id));
      if (tagIds.length > 0) {
        await db.insert(transactionTags).values(
          tagIds.map(tId => ({
            transactionId: id,
            tagId: tId
          }))
        );
      }
    }

    // Se foram enviados novos itens detalhados de compra/NF
    if (items !== undefined) {
      // Remove itens antigos (soft delete)
      await db.update(transactionItems)
        .set({ deletedAt: new Date() })
        .where(eq(transactionItems.transactionId, id));

      // Insere os novos itens e suas tags
      if (items.length > 0) {
        for (const item of items) {
          const [createdItem] = await db.insert(transactionItems).values({
            transactionId: id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            categoryId: item.categoryId || updated.categoryId,
          }).returning();

          if (item.tagIds && item.tagIds.length > 0) {
            await db.insert(transactionItemTags).values(
              item.tagIds.map(tId => ({
                transactionItemId: createdItem.id,
                tagId: tId
              }))
            );
          }
        }
      }
    }

    // Ajuste de saldo na conta:
    const oldStatus = oldTx.statusId;
    const newStatus = updated.statusId;
    const oldAmount = parseFloat(oldTx.amount);
    const newAmount = parseFloat(updated.amount);
    const oldType = oldTx.typeId;
    const newType = updated.typeId;
    const oldAccId = oldTx.accountId;
    const newAccId = updated.accountId;

    // Caso 1: Transação era PENDENTE (2) e agora foi CONFIRMADA (1)
    if (oldStatus === 2 && newStatus === 1) {
      if (newType === 1) {
        // Receita confirmada -> credita saldo
        await db.update(accounts)
          .set({ balance: sql`${accounts.balance} + ${newAmount}` })
          .where(and(eq(accounts.id, newAccId), eq(accounts.userId, user.id)));
      } else if (newType === 2) {
        // Despesa confirmada -> debita saldo
        await db.update(accounts)
          .set({ balance: sql`${accounts.balance} - ${newAmount}` })
          .where(and(eq(accounts.id, newAccId), eq(accounts.userId, user.id)));
      }
    } 
    // Caso 2: Transação já era CONFIRMADA (1) e continuou CONFIRMADA (1)
    else if (oldStatus === 1 && newStatus === 1) {
      // Se mudou de conta ou de tipo ou de valor, estorna o anterior e aplica o novo
      if (oldAccId !== newAccId || oldType !== newType) {
        // Estorna na conta antiga
        if (oldType === 1) {
          await db.update(accounts)
            .set({ balance: sql`${accounts.balance} - ${oldAmount}` })
            .where(and(eq(accounts.id, oldAccId), eq(accounts.userId, user.id)));
        } else if (oldType === 2) {
          await db.update(accounts)
            .set({ balance: sql`${accounts.balance} + ${oldAmount}` })
            .where(and(eq(accounts.id, oldAccId), eq(accounts.userId, user.id)));
        }

        // Aplica na conta nova
        if (newType === 1) {
          await db.update(accounts)
            .set({ balance: sql`${accounts.balance} + ${newAmount}` })
            .where(and(eq(accounts.id, newAccId), eq(accounts.userId, user.id)));
        } else if (newType === 2) {
          await db.update(accounts)
            .set({ balance: sql`${accounts.balance} - ${newAmount}` })
            .where(and(eq(accounts.id, newAccId), eq(accounts.userId, user.id)));
        }
      } else {
        // Mesma conta e mesmo tipo: apenas ajusta a diferença de valor se mudou
        const diff = newAmount - oldAmount;
        if (diff !== 0) {
          if (newType === 1) {
            // Receita aumentou -> soma diferença
            await db.update(accounts)
              .set({ balance: sql`${accounts.balance} + ${diff}` })
              .where(and(eq(accounts.id, newAccId), eq(accounts.userId, user.id)));
          } else if (newType === 2) {
            // Despesa aumentou -> subtrai diferença
            await db.update(accounts)
              .set({ balance: sql`${accounts.balance} - ${diff}` })
              .where(and(eq(accounts.id, newAccId), eq(accounts.userId, user.id)));
          }
        }
      }
    }

    return reply.send(updated);
  });

  // SOFT DELETE de transacao (marca deleted_at e estorna saldo)
  app.delete("/:id", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    const [tx] = await db.select().from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .limit(1);

    if (tx) {
      // Só estorna saldo na conta se a transação estivesse CONFIRMADA (statusId === 1)
      if (tx.statusId === 1) {
        const amountNum = parseFloat(tx.amount);
        if (tx.typeId === 1) {
          // Estorno de receita: subtrai do saldo
          await db.update(accounts)
            .set({ balance: sql`${accounts.balance} - ${amountNum}` })
            .where(and(eq(accounts.id, tx.accountId), eq(accounts.userId, user.id)));
        } else if (tx.typeId === 2) {
          // Estorno de despesa: devolve para a conta
          await db.update(accounts)
            .set({ balance: sql`${accounts.balance} + ${amountNum}` })
            .where(and(eq(accounts.id, tx.accountId), eq(accounts.userId, user.id)));
        }
      }

      // Marca como deletado
      await db.update(transactions)
        .set({ deletedAt: new Date() })
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));

      await db.update(transactionItems)
        .set({ deletedAt: new Date() })
        .where(eq(transactionItems.transactionId, id));
    }

    return reply.send({ success: true, message: "Transação excluída (soft delete)" });
  });

  // Confirmar transacao pendente de notificacao bancaria
  app.patch("/:id/confirm", async (request, reply) => {
    const user = request.user as { id: number };
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const schema = z.object({
      categoryId: z.number().optional(),
      accountId: z.number().optional(),
      description: z.string().optional()
    });

    const [oldTx] = await db.select().from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .limit(1);

    if (!oldTx) {
      return reply.status(404).send({ success: false, message: "Transação não encontrada." });
    }

    const updates = schema.parse(request.body);
    const [updated] = await db.update(transactions)
      .set({
        ...updates,
        statusId: 1,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning();

    // Se estava pendente e agora foi confirmada, atualiza o saldo da conta
    if (oldTx.statusId === 2) {
      const amountNum = parseFloat(updated.amount);
      const accId = updated.accountId;
      if (updated.typeId === 1) {
        // Receita Pix / Depósito -> adiciona ao saldo
        await db.update(accounts)
          .set({ balance: sql`${accounts.balance} + ${amountNum}` })
          .where(and(eq(accounts.id, accId), eq(accounts.userId, user.id)));
      } else if (updated.typeId === 2) {
        // Despesa / Compra no cartão ou débito -> subtrai do saldo
        await db.update(accounts)
          .set({ balance: sql`${accounts.balance} - ${amountNum}` })
          .where(and(eq(accounts.id, accId), eq(accounts.userId, user.id)));
      }
    }

    return reply.send(updated);
  });
}
