import React, { useState, useMemo } from "react";
import { 
  PieChart as PieIcon, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Receipt,
  Layers,
  Sparkles
} from "lucide-react";
import { Transaction, Category, Account } from "../services/api.js";
import { PeriodSelector } from "../components/PeriodSelector.js";
import { calculateFinancialPeriods } from "../utils/periodCalculator.js";

interface ReportsProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
}

export const Reports: React.FC<ReportsProps> = ({ transactions, categories, accounts }) => {
  const [cycleOffset, setCycleOffset] = useState<number>(0);
  const [reportType, setReportType] = useState<"expenses" | "income">("expenses");

  const currentPeriod = useMemo(() => {
    return calculateFinancialPeriods(transactions, categories, cycleOffset);
  }, [transactions, categories, cycleOffset]);

  // Transações confirmadas dentro do ciclo ativo
  const cycleTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.statusId !== 1) return false;
      const d = new Date(t.date);
      return d >= currentPeriod.startDate && d <= currentPeriod.endDate;
    });
  }, [transactions, currentPeriod]);

  // Totais de Receitas e Despesas do Ciclo
  const totalIncome = useMemo(() => {
    return cycleTransactions
      .filter(t => t.typeId === 1)
      .reduce((acc, t) => acc + parseFloat(t.amount || "0"), 0);
  }, [cycleTransactions]);

  const totalExpenses = useMemo(() => {
    return cycleTransactions
      .filter(t => t.typeId === 2)
      .reduce((acc, t) => acc + parseFloat(t.amount || "0"), 0);
  }, [cycleTransactions]);

  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(0) : "0";

  // Agrupamento por Categoria
  const categoryStats = useMemo(() => {
    const targetTypeId = reportType === "expenses" ? 2 : 1;
    const targetTransactions = cycleTransactions.filter(t => t.typeId === targetTypeId);
    const targetTotal = targetTypeId === 2 ? totalExpenses : totalIncome;

    const map = new Map<number, { category: Category; amount: number; count: number }>();

    targetTransactions.forEach(t => {
      const catId = t.categoryId || 0;
      const amount = parseFloat(t.amount || "0");
      const foundCat = categories.find(c => c.id === catId) || {
        id: 0,
        name: "Outros / Sem Categoria",
        typeId: targetTypeId,
        color: "#64748B",
        icon: "help-circle"
      };

      const existing = map.get(catId);
      if (existing) {
        existing.amount += amount;
        existing.count += 1;
      } else {
        map.set(catId, { category: foundCat, amount, count: 1 });
      }
    });

    const list = Array.from(map.values()).sort((a, b) => b.amount - a.amount);

    return list.map(item => ({
      ...item,
      percentage: targetTotal > 0 ? ((item.amount / targetTotal) * 100) : 0
    }));
  }, [cycleTransactions, reportType, categories, totalExpenses, totalIncome]);

  // Top 5 Maiores Gastos do Ciclo (Maiores Ofensores)
  const topExpenses = useMemo(() => {
    return cycleTransactions
      .filter(t => t.typeId === 2)
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 5);
  }, [cycleTransactions]);

  return (
    <div className="pb-28 pt-4 px-4 max-w-md mx-auto sm:max-w-2xl">
      {/* Seletor de Ciclo Financeiro */}
      <PeriodSelector
        period={currentPeriod}
        onPrevCycle={() => setCycleOffset(prev => prev - 1)}
        onNextCycle={() => setCycleOffset(prev => Math.min(prev + 1, 0))}
        onResetCurrent={() => setCycleOffset(0)}
      />

      {/* Cartão de Resumo Líquido do Ciclo */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 mb-5 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Resultado do Ciclo
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
            netBalance >= 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}>
            <Sparkles className="w-3 h-3" />
            {netBalance >= 0 ? `Economia de ${savingsRate}%` : "Déficit no Período"}
          </span>
        </div>

        <div className="text-2xl font-extrabold tracking-tight text-white mb-4">
          <span className={netBalance >= 0 ? "text-emerald-400" : "text-rose-400"}>
            {netBalance >= 0 ? "+ " : "- "}
            R$ {Math.abs(netBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/15 text-emerald-400 rounded-xl">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Receitas</p>
              <p className="text-sm font-bold text-slate-100">
                R$ {totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/15 text-rose-400 rounded-xl">
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Despesas</p>
              <p className="text-sm font-bold text-slate-100">
                R$ {totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alternador Despesas vs Receitas */}
      <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl mb-5 border border-slate-800">
        <button
          onClick={() => setReportType("expenses")}
          className={`py-2 text-xs font-bold rounded-xl transition ${
            reportType === "expenses" ? "bg-rose-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Despesas por Categoria
        </button>
        <button
          onClick={() => setReportType("income")}
          className={`py-2 text-xs font-bold rounded-xl transition ${
            reportType === "income" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Receitas por Categoria
        </button>
      </div>

      {/* Barra Visual Segmentada (Progresso de Distribuição de Categorias) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <PieIcon className="w-4 h-4 text-emerald-400" />
            Distribuição Percentual
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            {categoryStats.length} categoria{categoryStats.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Barra multicolorida */}
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex mb-5">
          {categoryStats.map((item, idx) => (
            <div
              key={idx}
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.category.color || "#3B82F6"
              }}
              title={`${item.category.name}: ${item.percentage.toFixed(1)}%`}
              className="h-full transition-all hover:opacity-80"
            />
          ))}
        </div>

        {/* Lista de Categorias com Barra de Progresso Individual */}
        <div className="space-y-3.5">
          {categoryStats.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Nenhum lançamento no período</p>
          ) : (
            categoryStats.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: item.category.color || "#3B82F6" }} 
                    />
                    <span className="font-semibold text-slate-200">{item.category.name}</span>
                    <span className="text-[10px] text-slate-500">({item.count}x)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-100 mr-2">
                      R$ {item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-400 text-[11px] font-medium">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.category.color || "#3B82F6"
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Maiores Gastos do Ciclo (Top 5 Ofensores) */}
      {reportType === "expenses" && topExpenses.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-3">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            Maiores Gastos do Ciclo (Top 5)
          </h3>

          <div className="space-y-2.5">
            {topExpenses.map((tx, idx) => (
              <div 
                key={tx.id}
                className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center text-xs font-bold">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">{tx.description}</h4>
                    <p className="text-[10px] text-slate-400">
                      {new Date(tx.date).toLocaleDateString("pt-BR")}
                      {tx.items && tx.items.length > 0 && ` • ${tx.items.length} itens`}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-rose-400">
                    - R$ {parseFloat(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};