import React, { useState, useMemo } from "react";
import { 
  Target, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Flame, 
  Plus, 
  Trash2, 
  Calendar,
  Sparkles
} from "lucide-react";
import { Transaction, Category, Budget, api } from "../services/api.js";
import { PeriodSelector } from "../components/PeriodSelector.js";
import { calculateFinancialPeriods } from "../utils/periodCalculator.js";
import { formatCentsToBRL, parseInputToCents, centsToDecimalString } from "../utils/currency.js";

interface BudgetsProps {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  onRefreshBudgets: () => Promise<void>;
}

export const Budgets: React.FC<BudgetsProps> = ({ 
  transactions, 
  categories, 
  budgets, 
  onRefreshBudgets 
}) => {
  const [cycleOffset, setCycleOffset] = useState<number>(0);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(categories[0]?.id || 1);
  const [targetAmountCents, setTargetAmountCents] = useState<number>(0);

  const currentPeriod = useMemo(() => {
    return calculateFinancialPeriods(transactions, categories, cycleOffset);
  }, [transactions, categories, cycleOffset]);

  // Transações de despesa confirmadas no ciclo
  const cycleExpenses = useMemo(() => {
    return transactions.filter(t => {
      if (t.statusId !== 1 || t.typeId !== 2) return false;
      const d = new Date(t.date);
      return d >= currentPeriod.startDate && d <= currentPeriod.endDate;
    });
  }, [transactions, currentPeriod]);

  // Cálculo de dias decorridos no ciclo
  const cycleDaysInfo = useMemo(() => {
    const start = currentPeriod.startDate.getTime();
    const end = currentPeriod.endDate.getTime();
    const now = new Date().getTime();

    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    let daysPassed = 0;

    if (now >= end) {
      daysPassed = totalDays;
    } else if (now > start) {
      daysPassed = Math.max(1, Math.round((now - start) / (1000 * 60 * 60 * 24)));
    }

    const progressPercent = Math.min(100, Math.round((daysPassed / totalDays) * 100));

    return { totalDays, daysPassed, progressPercent };
  }, [currentPeriod]);

  // Cruzamento de Orçamentos com Gastos Reais e Burn-rate
  const budgetAnalysis = useMemo(() => {
    return budgets.map(b => {
      const cat = categories.find(c => c.id === b.categoryId) || {
        id: b.categoryId,
        name: "Categoria",
        color: "#EF4444",
        typeId: 2,
        icon: "tag"
      };

      const spent = cycleExpenses
        .filter(t => t.categoryId === b.categoryId)
        .reduce((acc, t) => acc + parseFloat(t.amount || "0"), 0);

      const target = parseFloat(b.targetAmount) || 1;
      const percentage = (spent / target) * 100;
      const remaining = target - spent;

      // Burn-rate (previsão de estouro)
      const dailySpend = cycleDaysInfo.daysPassed > 0 ? spent / cycleDaysInfo.daysPassed : 0;
      const projectedTotal = dailySpend * cycleDaysInfo.totalDays;

      let estimatedBurstDay: number | null = null;
      if (dailySpend > 0 && spent < target && projectedTotal > target) {
        const daysToBurst = Math.ceil((target - spent) / dailySpend);
        estimatedBurstDay = Math.min(cycleDaysInfo.totalDays, cycleDaysInfo.daysPassed + daysToBurst);
      }

      return {
        ...b,
        category: cat,
        spent,
        target,
        percentage,
        remaining,
        dailySpend,
        projectedTotal,
        estimatedBurstDay,
        isBurst: spent > target,
        isWarning: percentage >= 75 && percentage <= 100
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [budgets, categories, cycleExpenses, cycleDaysInfo]);

  // Salvar nova meta
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId || targetAmountCents <= 0) return;

    try {
      await api.saveBudget({
        categoryId: Number(selectedCategoryId),
        targetAmount: centsToDecimalString(targetAmountCents),
      });
      await onRefreshBudgets();
      setIsAdding(false);
      setTargetAmountCents(0);
    } catch (err) {
      alert("Erro ao salvar orçamento.");
    }
  };

  const handleDeleteBudget = async (id: number) => {
    if (!confirm("Excluir esta meta de orçamento?")) return;
    try {
      await api.deleteBudget(id);
      await onRefreshBudgets();
    } catch (err) {
      alert("Erro ao excluir orçamento.");
    }
  };

  // Categorias de despesa que ainda não possuem orçamento cadastrado
  const availableCategories = categories.filter(
    c => c.typeId === 2 && !budgets.some(b => b.categoryId === c.id)
  );

  return (
    <div className="pb-28 pt-4 px-4 max-w-md mx-auto sm:max-w-2xl">
      {/* Seletor de Ciclo */}
      <PeriodSelector
        period={currentPeriod}
        onPrevCycle={() => setCycleOffset(prev => prev - 1)}
        onNextCycle={() => setCycleOffset(prev => Math.min(prev + 1, 0))}
        onResetCurrent={() => setCycleOffset(0)}
      />

      {/* Cabeçalho do Ciclo com Indicador de Ritmo Temporal */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 mb-5 shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Progresso do Ciclo
          </span>
          <span className="text-xs font-bold text-slate-300">
            Dia {cycleDaysInfo.daysPassed} de {cycleDaysInfo.totalDays} ({cycleDaysInfo.progressPercent}%)
          </span>
        </div>

        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
          <div 
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${cycleDaysInfo.progressPercent}%` }}
          />
        </div>

        <p className="text-[11px] text-slate-400">
          {cycleDaysInfo.daysPassed === cycleDaysInfo.totalDays
            ? "Ciclo encerrado. Analise os resultados abaixo."
            : `Faltam ${cycleDaysInfo.totalDays - cycleDaysInfo.daysPassed} dias para fechar este ciclo salarial.`}
        </p>
      </div>

      {/* Botão para Nova Meta */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Target className="w-4 h-4 text-blue-400" />
          Metas por Categoria ({budgetAnalysis.length})
        </h3>

        {!isAdding && availableCategories.length > 0 && (
          <button
            onClick={() => {
              setSelectedCategoryId(availableCategories[0].id);
              setIsAdding(true);
            }}
            className="flex items-center gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl shadow transition"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Meta
          </button>
        )}
      </div>

      {/* Formulário de Adicionar Meta */}
      {isAdding && (
        <form onSubmit={handleSaveBudget} className="bg-slate-900 border border-blue-500/30 rounded-2xl p-4 mb-5 shadow-xl space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Definir Limite de Gastos</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Categoria</label>
              <select
                value={selectedCategoryId}
                onChange={e => setSelectedCategoryId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              >
                {availableCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Limite Máximo (R$)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs font-bold text-slate-400">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="0,00"
                  value={formatCentsToBRL(targetAmountCents)}
                  onChange={e => setTargetAmountCents(parseInputToCents(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-8 pr-2.5 text-xs text-white font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow"
            >
              Salvar Limite
            </button>
          </div>
        </form>
      )}

      {/* Lista de Metas com Análise Visual e Previsões */}
      <div className="space-y-4">
        {budgetAnalysis.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
            <Target className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300 mb-1">Nenhuma meta definida</p>
            <p className="text-xs text-slate-500 mb-4">
              Defina tetos de gastos para suas categorias e acompanhe o ritmo diário.
            </p>
            {availableCategories.length > 0 && (
              <button
                onClick={() => {
                  setSelectedCategoryId(availableCategories[0].id);
                  setIsAdding(true);
                }}
                className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-xl"
              >
                Criar Primeira Meta
              </button>
            )}
          </div>
        ) : (
          budgetAnalysis.map(b => (
            <div 
              key={b.id} 
              className={`bg-slate-900 border rounded-3xl p-5 shadow-xl relative overflow-hidden ${
                b.isBurst 
                  ? "border-rose-500/50 bg-rose-500/[0.02]" 
                  : b.isWarning 
                    ? "border-amber-500/40 bg-amber-500/[0.02]" 
                    : "border-slate-800"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: b.category.color || "#3B82F6" }} 
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white">{b.category.name}</h4>
                    <p className="text-[11px] text-slate-400">
                      R$ {b.spent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de R$ {b.target.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${
                    b.isBurst 
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/40" 
                      : b.isWarning 
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40" 
                        : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  }`}>
                    {b.percentage.toFixed(0)}%
                  </span>

                  <button
                    onClick={() => handleDeleteBudget(b.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                    title="Excluir meta"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Barra de Progresso com Cor Dinâmica */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-3">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    b.isBurst ? "bg-rose-500" : b.isWarning ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, b.percentage)}%` }}
                />
              </div>

              {/* Inteligência Preditiva (Burn-Rate e Alertas) */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                {b.isBurst ? (
                  <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Estourou em R$ {Math.abs(b.remaining).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ) : b.estimatedBurstDay ? (
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>Nesse ritmo, estourará no <b>dia {b.estimatedBurstDay}</b> do ciclo</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ritmo saudável • Restam R$ {b.remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <span className="text-slate-500">
                  ~R$ {b.dailySpend.toFixed(0)}/dia
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};