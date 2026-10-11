import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { Account, CardPayment, Category, Transaction, api } from "../services/api.js";
import { Invoice, buildInvoices } from "../utils/invoices.js";
import { centsToDecimalString, formatCentsToBRL, parseInputToCents } from "../utils/currency.js";
import { useConfirm, useToast } from "../components/Feedback.js";

interface CardsProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  initialCardId: number | null;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const brlCents = (c: number) => brl(c / 100);
const fmtDay = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const fmtShort = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
const inDays = (n: number) => (n === 0 ? "hoje" : n === 1 ? "amanhã" : n < 0 ? `há ${-n} dias` : `em ${n} dias`);

export const Cards: React.FC<CardsProps> = ({ accounts, transactions, categories, initialCardId, onBack, onRefresh }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const cards = accounts.filter(a => a.typeId === 2);
  const cashAccounts = accounts.filter(a => a.typeId !== 2);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialCardId && cards.some(c => c.id === initialCardId) ? initialCardId : cards[0]?.id ?? null
  );
  const card = cards.find(c => c.id === selectedId) ?? cards[0];

  const [payments, setPayments] = useState<CardPayment[]>([]);
  const [viewRef, setViewRef] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payFromId, setPayFromId] = useState<number | null>(null);
  const [payCents, setPayCents] = useState(0);
  const [busy, setBusy] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      const list = await api.getCardPayments();
      if (Array.isArray(list)) setPayments(list);
    } catch {
      /* sem conexao: mantem o que ja estava na tela */
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    setViewRef(null);
    setPayOpen(false);
  }, [selectedId]);

  const data = useMemo(
    () => (card ? buildInvoices(card, transactions, payments, new Date()) : null),
    [card, transactions, payments]
  );

  const now = new Date();

  const header = (
    <div className="flex items-center gap-3 mb-5">
      <button onClick={onBack} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl" aria-label="Voltar">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div>
        <h2 className="text-xl font-extrabold text-white">Cartões</h2>
        <p className="text-xs text-slate-400">Dívida, limite e faturas</p>
      </div>
    </div>
  );

  if (!card) {
    return (
      <div className="pb-24 pt-4 px-4 max-w-md mx-auto sm:max-w-2xl">
        {header}
        <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl text-sm text-slate-400">
          Nenhum cartão cadastrado. Cadastre um em Configurações &gt; Contas.
        </div>
      </div>
    );
  }

  const debt = Math.max(0, -parseFloat(card.balance || "0"));
  const limit = parseFloat(card.creditLimit || "0");
  const hasLimit = limit > 0;
  const available = limit - debt;
  const usedPct = hasLimit ? Math.min(100, (debt / limit) * 100) : 0;

  const currentInvoice = data?.invoices.find(i => i.ref === data.currentRef);
  const targetInvoice = data?.invoices.find(i => i.ref === data.targetRef);
  const invoice: Invoice | undefined =
    data?.invoices.find(i => i.ref === (viewRef ?? data.targetRef)) ?? targetInvoice;
  const invoiceIndex = data && invoice ? data.invoices.findIndex(i => i.ref === invoice.ref) : -1;

  const categoryName = (id?: number) => categories.find(c => c.id === id)?.name;
  const accountName = (id: number) => accounts.find(a => a.id === id)?.name ?? "conta removida";

  const dueAdjusted = (i: Invoice) => i.due.getTime() !== i.dueNominal.getTime();
  const isOverdue = (i: Invoice) => i.status === "closed" && startOfDay(i.due).getTime() < startOfDay(now).getTime();

  const statusBadge = (i: Invoice) => {
    if (i.status === "paid") return { label: "Paga", cls: "bg-emerald-500/15 text-emerald-400" };
    if (isOverdue(i)) return { label: "Vencida", cls: "bg-rose-500/15 text-rose-400" };
    if (i.status === "closed") return { label: "Fechada", cls: "bg-amber-500/15 text-amber-400" };
    if (i.status === "open") return { label: "Aberta", cls: "bg-violet-500/15 text-violet-300" };
    return { label: "Próxima", cls: "bg-slate-700 text-slate-300" };
  };

  const openPay = (i: Invoice) => {
    setPayCents(Math.max(0, i.payableCents));
    setPayFromId(cashAccounts[0]?.id ?? null);
    setPayOpen(true);
  };

  const handlePay = async (i: Invoice) => {
    if (!payFromId) return toast.error("Escolha de qual conta saiu o dinheiro.");
    if (payCents <= 0) return toast.error("Informe o valor pago.");
    setBusy(true);
    try {
      const res = await api.payCardInvoice(card.id, {
        ref: i.ref,
        amount: centsToDecimalString(payCents),
        fromAccountId: payFromId,
      });
      if (!res.success) {
        toast.error(res.message || "Não foi possível registrar o pagamento.");
        return;
      }
      toast.success("Pagamento registrado.");
      setPayOpen(false);
      await loadPayments();
      await onRefresh();
    } catch {
      toast.error("Falha na conexão com o servidor.");
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async (i: Invoice) => {
    if (!i.payment) return;
    const ok = await confirm({
      title: "Desfazer pagamento",
      message: "O valor volta para a conta de origem e a fatura é reaberta. Continuar?",
      confirmLabel: "Desfazer",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.undoCardPayment(i.payment.id);
      if (!res.success) {
        toast.error(res.message || "Não foi possível desfazer o pagamento.");
        return;
      }
      toast.success("Pagamento desfeito.");
      await loadPayments();
      await onRefresh();
    } catch {
      toast.error("Falha na conexão com o servidor.");
    }
  };

  const monthTitle = (i: Invoice) =>
    i.dueNominal.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const listed = invoice
    ? [...invoice.transactions, ...invoice.pending].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id
      )
    : [];

  return (
    <div className="pb-24 pt-4 px-4 max-w-md mx-auto sm:max-w-2xl">
      {header}

      {cards.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
          {cards.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                c.id === card.id ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="bg-gradient-to-br from-violet-900/60 to-slate-900 border border-violet-500/30 rounded-3xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: card.color || "#820AD1" }}>
            <CreditCard className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-slate-200">{card.name}</span>
        </div>
        <p className="text-xs text-slate-400">Dívida atual no cartão</p>
        <p className="text-3xl font-extrabold text-white mb-4">R$ {brl(debt)}</p>

        {hasLimit ? (
          <>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full ${usedPct >= 90 ? "bg-rose-500" : usedPct >= 70 ? "bg-amber-400" : "bg-violet-400"}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Disponível <b className={available >= 0 ? "text-emerald-400" : "text-rose-400"}>R$ {brl(available)}</b></span>
              <span className="text-slate-400">Limite <b className="text-slate-200">R$ {brl(limit)}</b></span>
            </div>
          </>
        ) : (
          <p className="text-xs text-amber-400">Limite não informado. Configure em Configurações &gt; Contas.</p>
        )}
      </div>

      {!data || !invoice ? (
        <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-sm text-amber-300">
          Configure o dia de fechamento e o de vencimento deste cartão em Configurações &gt; Contas para ver as faturas.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400">Fatura aberta fecha</p>
              {currentInvoice && (
                <>
                  <p className="text-lg font-bold text-white">{fmtDay(currentInvoice.end)}</p>
                  <p className="text-[11px] text-slate-500">{inDays(daysBetween(currentInvoice.end, now))}</p>
                </>
              )}
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400">Próximo vencimento</p>
              {targetInvoice && (
                <>
                  <p className="text-lg font-bold text-white">{fmtDay(targetInvoice.due)}</p>
                  <p className="text-[11px] text-slate-500">{inDays(daysBetween(targetInvoice.due, now))}</p>
                  {dueAdjusted(targetInvoice) && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      Dia {targetInvoice.dueNominal.getDate()} cai em dia não útil; vale o próximo dia útil.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => invoiceIndex > 0 && setViewRef(data.invoices[invoiceIndex - 1].ref)}
              disabled={invoiceIndex <= 0}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl disabled:opacity-30"
              aria-label="Fatura anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-xs text-slate-400">Fatura de</p>
              <p className="text-base font-bold text-white capitalize">{monthTitle(invoice)}</p>
            </div>
            <button
              onClick={() => invoiceIndex < data.invoices.length - 1 && setViewRef(data.invoices[invoiceIndex + 1].ref)}
              disabled={invoiceIndex >= data.invoices.length - 1}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl disabled:opacity-30"
              aria-label="Próxima fatura"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadge(invoice).cls}`}>
                {statusBadge(invoice).label}
              </span>
              <span className="text-[11px] text-slate-500">
                Compras de {fmtShort(invoice.start)} a {fmtShort(new Date(invoice.end.getFullYear(), invoice.end.getMonth(), invoice.end.getDate() - 1))}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              {invoice.status === "paid" ? "Valor pago" : "Valor da fatura"}
            </p>
            <p className="text-3xl font-extrabold text-white mb-3">
              R$ {invoice.payment ? brl(parseFloat(invoice.payment.amount)) : brlCents(Math.max(0, invoice.payableCents))}
            </p>

            {!invoice.payment && (
              <div className="space-y-1 text-xs mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Compras do período</span>
                  <span className="text-slate-200 font-semibold">R$ {brlCents(invoice.purchasesCents)}</span>
                </div>
                {invoice.previousCents !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Saldo anterior (dívida informada)</span>
                    <span className="text-slate-200 font-semibold">R$ {brlCents(invoice.previousCents)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between text-xs border-t border-slate-800 pt-3">
              <span className="text-slate-400">Vencimento</span>
              <span className="text-slate-200 font-semibold">
                {fmtDay(invoice.due)}
                {dueAdjusted(invoice) ? " (dia útil)" : ""}
              </span>
            </div>
            {invoice.payment && (
              <div className="flex justify-between text-xs mt-1">
                <span className="text-slate-400">Pago em</span>
                <span className="text-slate-200 font-semibold">
                  {new Date(invoice.payment.paidAt).toLocaleDateString("pt-BR")} • {accountName(invoice.payment.fromAccountId)}
                </span>
              </div>
            )}

            {invoice.status === "open" && (
              <p className="text-[11px] text-slate-500 mt-3">
                Fatura aberta: o pagamento fica disponível depois do fechamento ({fmtShort(invoice.end)}).
              </p>
            )}

            {(invoice.status === "closed") && !payOpen && (
              <button
                onClick={() => openPay(invoice)}
                className="w-full mt-3 py-3 bg-violet-600 hover:bg-violet-500 active:scale-[0.99] text-white text-sm font-bold rounded-xl transition"
              >
                Pagar fatura
              </button>
            )}

            {invoice.payment && (
              <button
                onClick={() => handleUndo(invoice)}
                className="mt-3 text-xs text-rose-400 hover:underline"
              >
                Desfazer pagamento
              </button>
            )}

            {payOpen && invoice.status === "closed" && (
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400 mb-1">Pago com (conta de origem)</span>
                  <select
                    value={payFromId ?? ""}
                    onChange={(e) => setPayFromId(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white"
                  >
                    {cashAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400 mb-1">Valor pago</span>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-sm font-bold text-slate-400">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatCentsToBRL(payCents)}
                      onChange={(e) => setPayCents(parseInputToCents(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePay(invoice)}
                    disabled={busy}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl disabled:opacity-50"
                  >
                    {busy ? "Registrando..." : "Confirmar pagamento"}
                  </button>
                  <button
                    onClick={() => setPayOpen(false)}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Compras desta fatura</h3>
          {listed.length === 0 ? (
            <div className="p-6 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl text-sm text-slate-400">
              Nenhuma compra nesta fatura ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {listed.map(t => (
                <div key={t.id} className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-2xl flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{t.description}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {new Date(t.date).toLocaleDateString("pt-BR")}
                      {categoryName(t.categoryId) ? ` • ${categoryName(t.categoryId)}` : ""}
                      {t.statusId === 2 ? " • pendente (não somada)" : ""}
                    </p>
                  </div>
                  <span className={`text-sm font-bold whitespace-nowrap ${t.typeId === 2 ? "text-slate-100" : "text-emerald-400"}`}>
                    {t.typeId === 2 ? "-" : "+"} R$ {brl(parseFloat(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
