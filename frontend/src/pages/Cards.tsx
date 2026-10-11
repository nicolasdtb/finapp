import React, { useState } from "react";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Account, Category, Transaction } from "../services/api.js";

interface CardsProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  initialCardId: number | null;
  onBack: () => void;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

// Proxima data (hoje ou depois) com o dia do mes informado; dia 31 vira o ultimo dia em meses curtos
function nextOccurrence(day: number, from: Date): Date {
  const make = (y: number, m: number) => {
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(day, last));
  };
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let d = make(today.getFullYear(), today.getMonth());
  if (d < today) d = make(today.getFullYear(), today.getMonth() + 1);
  return d;
}

function daysUntil(target: Date, from: Date): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

const inDays = (n: number) => (n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`);

export const Cards: React.FC<CardsProps> = ({ accounts, transactions, categories, initialCardId, onBack }) => {
  const cards = accounts.filter(a => a.typeId === 2);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialCardId && cards.some(c => c.id === initialCardId) ? initialCardId : cards[0]?.id ?? null
  );
  const card = cards.find(c => c.id === selectedId) ?? cards[0];
  const now = new Date();

  const header = (
    <div className="flex items-center gap-3 mb-5">
      <button onClick={onBack} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl" aria-label="Voltar">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div>
        <h2 className="text-xl font-extrabold text-white">Cartões</h2>
        <p className="text-xs text-slate-400">Dívida, limite e vencimento</p>
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
  const closing = card.closingDay ? nextOccurrence(card.closingDay, now) : null;
  const due = card.dueDay ? nextOccurrence(card.dueDay, now) : null;
  const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const categoryName = (id?: number) => categories.find(c => c.id === id)?.name;
  const recent = transactions
    .filter(t => t.accountId === card.id || t.destinationAccountId === card.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id)
    .slice(0, 10);

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

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Fatura fecha</p>
          {closing ? (
            <>
              <p className="text-lg font-bold text-white">{fmtDate(closing)}</p>
              <p className="text-[11px] text-slate-500">{inDays(daysUntil(closing, now))}</p>
            </>
          ) : (
            <p className="text-xs text-amber-400 mt-1">Não configurado</p>
          )}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Fatura vence</p>
          {due ? (
            <>
              <p className="text-lg font-bold text-white">{fmtDate(due)}</p>
              <p className="text-[11px] text-slate-500">{inDays(daysUntil(due, now))}</p>
            </>
          ) : (
            <p className="text-xs text-amber-400 mt-1">Não configurado</p>
          )}
        </div>
      </div>

      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Últimos lançamentos no cartão</h3>
      {recent.length === 0 ? (
        <div className="p-6 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl text-sm text-slate-400">
          Nenhum lançamento neste cartão ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map(t => {
            const isPurchase = t.typeId === 2 && t.accountId === card.id;
            return (
              <div key={t.id} className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-2xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{t.description}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {new Date(t.date).toLocaleDateString("pt-BR")}
                    {categoryName(t.categoryId) ? ` • ${categoryName(t.categoryId)}` : ""}
                    {t.statusId === 2 ? " • pendente" : ""}
                  </p>
                </div>
                <span className={`text-sm font-bold whitespace-nowrap ${isPurchase ? "text-slate-100" : "text-emerald-400"}`}>
                  {isPurchase ? "-" : "+"} R$ {brl(parseFloat(t.amount))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
