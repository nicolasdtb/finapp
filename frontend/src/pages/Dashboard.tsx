import React, { useState, useMemo } from "react";
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Clock, 
  CreditCard,
  Settings,
  Receipt,
  UploadCloud
} from "lucide-react";
import { Transaction, Account, Category } from "../services/api.js";
import { PeriodSelector } from "../components/PeriodSelector.js";
import { calculateFinancialPeriods } from "../utils/periodCalculator.js";

interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onConfirmPending: (tx: Transaction) => void;
  onOpenSettings: () => void;
  onOpenImport: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, 
  accounts, 
  categories,
  onNewTransaction, 
  onEditTransaction,
  onConfirmPending,
  onOpenSettings,
  onOpenImport
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [cycleOffset, setCycleOffset] = useState<number>(0);

  // Calcula o período atual (entre salários ou 5º dia útil)
  const currentPeriod = useMemo(() => {
    return calculateFinancialPeriods(transactions, categories, cycleOffset);
  }, [transactions, categories, cycleOffset]);

  const totalBalance = accounts.reduce((acc, a) => acc + parseFloat(a.balance || "0"), 0);

  // Ordena rigorosamente do mais recente para o mais antigo (data decrescente, e por id decrescente para desempate)
  const sortByNewestFirst = (a: Transaction, b: Transaction) => {
    const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id - a.id;
  };

  const pendingTransactions = useMemo(() => {
    return transactions.filter(t => t.statusId === 2).sort(sortByNewestFirst);
  }, [transactions]);

  const confirmedTransactions = useMemo(() => {
    return transactions.filter(t => t.statusId === 1).sort(sortByNewestFirst);
  }, [transactions]);

  // Filtra transações que caem exatamente dentro do ciclo financeiro selecionado
  const cycleTransactions = useMemo(() => {
    return confirmedTransactions.filter(t => {
      const d = new Date(t.date);
      return d >= currentPeriod.startDate && d <= currentPeriod.endDate;
    });
  }, [confirmedTransactions, currentPeriod]);

  const currentMonthExpenses = cycleTransactions
    .filter(t => t.typeId === 2)
    .reduce((acc, t) => acc + parseFloat(t.amount || "0"), 0);

  const currentMonthIncome = cycleTransactions
    .filter(t => t.typeId === 1)
    .reduce((acc, t) => acc + parseFloat(t.amount || "0"), 0);


  return (
    <div className="pb-28 pt-4 px-4 max-w-md mx-auto sm:max-w-2xl">
      {/* Seletor de Período Financeiro (Entre salários / 5º dia útil) */}
      <PeriodSelector
        period={currentPeriod}
        onPrevCycle={() => setCycleOffset(prev => prev - 1)}
        onNextCycle={() => setCycleOffset(prev => Math.min(prev + 1, 0))}
        onResetCurrent={() => setCycleOffset(0)}
      />

      {/* Alerta de Gastos Capturados via Notificacao Bancaria */}
      {pendingTransactions.length > 0 && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-amber-300">
                {pendingTransactions.length} gasto{pendingTransactions.length > 1 ? "s" : ""} bancário detectado
              </h4>
              <p className="text-xs text-slate-400">Toque para categorizar e confirmar</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab("pending")}
            className="px-3 py-1.5 bg-amber-500 text-slate-950 font-semibold text-xs rounded-xl shadow-sm hover:bg-amber-400 transition"
          >
            Revisar
          </button>
        </div>
      )}

      {/* Cartao de Saldo Geral estilo Minhas Financas */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 rounded-3xl p-6 shadow-xl relative overflow-hidden mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Saldo Consolidado</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={onOpenImport}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
              title="Importar Extrato Bancário (CSV / OFX)"
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <button 
              onClick={onOpenSettings}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              title="Configurações e Gestão"
            >
              <Settings className="w-4 h-4" />
            </button>
            <Wallet className="w-5 h-5 text-blue-400" />
          </div>
        </div>
        <div className="text-3xl font-extrabold tracking-tight text-white mb-6">
          R$ {totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-700/60 pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Receitas</p>
              <p className="text-sm font-bold text-emerald-400">
                + R$ {currentMonthIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Despesas</p>
              <p className="text-sm font-bold text-rose-400">
                - R$ {currentMonthExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Carrossel de Contas e Cartoes */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Minhas Contas & Cartões</h3>
          <button 
            onClick={onOpenSettings}
            className="text-xs text-blue-400 font-medium hover:underline"
          >
            Gerenciar
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {accounts.map(acc => (
            <div 
              key={acc.id}
              className="min-w-[155px] bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: acc.color || "#3B82F6" }}
                >
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                  {acc.typeId === 2 ? "Cartão" : "Conta"}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium truncate">{acc.name}</p>
                <p className="text-sm font-bold text-slate-100">
                  R$ {parseFloat(acc.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de Transacoes Recentes */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab("all")}
              className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                activeTab === "all" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              Confirmadas ({confirmedTransactions.length})
            </button>
            <button 
              onClick={() => setActiveTab("pending")}
              className={`text-xs px-3 py-1 rounded-full font-medium transition flex items-center gap-1 ${
                activeTab === "pending" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"
              }`}
            >
              Pendentes ({pendingTransactions.length})
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {(activeTab === "all" ? confirmedTransactions : pendingTransactions).map(t => (
            <div 
              key={t.id}
              onClick={() => onEditTransaction(t)}
              className={`p-3.5 bg-slate-800/60 border rounded-2xl flex items-center justify-between cursor-pointer transition active:scale-[0.99] ${
                t.statusId === 2 
                  ? "border-amber-500/40 hover:bg-amber-500/10" 
                  : "border-slate-700/40 hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  t.typeId === 1 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                }`}>
                  {t.typeId === 1 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-100">{t.description}</h4>
                    {t.items && t.items.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">
                        <Receipt className="w-3 h-3" />
                        {t.items.length} itens
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(t.date).toLocaleDateString("pt-BR")}
                    {t.rawBankNotification && " • Via Notificação Bancária"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className={`text-sm font-bold ${
                  t.typeId === 1 ? "text-emerald-400" : "text-slate-100"
                }`}>
                  {t.typeId === 1 ? "+" : "-"} R$ {parseFloat(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                {t.statusId === 2 && (
                  <p className="text-[10px] text-amber-400 font-medium">Toque p/ aprovar</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
