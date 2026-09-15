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
  UploadCloud,
  Search,
  Filter,
  X,
  Tag as TagIcon
} from "lucide-react";
import { Transaction, Account, Category, Tag } from "../services/api.js";
import { PeriodSelector } from "../components/PeriodSelector.js";
import { calculateFinancialPeriods } from "../utils/periodCalculator.js";

interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
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
  tags,
  onNewTransaction, 
  onEditTransaction,
  onConfirmPending,
  onOpenSettings,
  onOpenImport
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [cycleOffset, setCycleOffset] = useState<number>(0);

  // Estados de Busca e Filtros Rápidos
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | "all">("all");
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<number | "all">("all");
  const [selectedTagFilter, setSelectedTagFilter] = useState<number | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

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

  // Função auxiliar de filtro que busca por texto na descrição, notas e itens detalhados da nota fiscal
  const matchesSearchAndFilter = (t: Transaction) => {
    // 1. Filtro por Categoria
    if (selectedCategoryFilter !== "all" && t.categoryId !== selectedCategoryFilter) {
      return false;
    }
    // 2. Filtro por Conta
    if (selectedAccountFilter !== "all" && t.accountId !== selectedAccountFilter) {
      return false;
    }
    // 3. Filtro por Tag (checa tanto a transação raíz quanto itens individuais)
    if (selectedTagFilter !== "all") {
      const hasTxTag = t.tagIds?.includes(selectedTagFilter);
      const hasItemTag = t.items?.some(i => i.tagIds?.includes(selectedTagFilter));
      if (!hasTxTag && !hasItemTag) {
        return false;
      }
    }
    // 4. Busca por Texto (descrição, observações ou itens da compra)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchDesc = (t.description || "").toLowerCase().includes(q);
      const matchNotes = (t.notes || "").toLowerCase().includes(q);
      const matchItems = t.items?.some(i => i.name.toLowerCase().includes(q));
      if (!matchDesc && !matchNotes && !matchItems) {
        return false;
      }
    }
    return true;
  };

  const pendingTransactions = useMemo(() => {
    return transactions
      .filter(t => t.statusId === 2)
      .filter(matchesSearchAndFilter)
      .sort(sortByNewestFirst);
  }, [transactions, searchTerm, selectedCategoryFilter, selectedAccountFilter, selectedTagFilter]);

  const confirmedTransactions = useMemo(() => {
    return transactions
      .filter(t => t.statusId === 1)
      .filter(matchesSearchAndFilter)
      .sort(sortByNewestFirst);
  }, [transactions, searchTerm, selectedCategoryFilter, selectedAccountFilter, selectedTagFilter]);

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

  const hasActiveFilters = Boolean(
    searchTerm.trim() || 
    selectedCategoryFilter !== "all" || 
    selectedAccountFilter !== "all" ||
    selectedTagFilter !== "all"
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategoryFilter("all");
    setSelectedAccountFilter("all");
    setSelectedTagFilter("all");
  };


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

      {/* Lista de Transacoes Recentes com Busca e Filtros */}
      <div>
        <div className="flex flex-col gap-2.5 mb-3">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab("all")}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                  activeTab === "all" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                Confirmadas ({confirmedTransactions.length})
              </button>
              <button 
                onClick={() => setActiveTab("pending")}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition flex items-center gap-1 ${
                  activeTab === "pending" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"
                }`}
              >
                Pendentes ({pendingTransactions.length})
              </button>
            </div>

            <button
              onClick={() => setShowFilters(prev => !prev)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                showFilters || hasActiveFilters
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200"
              }`}
              title="Filtros e Busca"
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filtrar</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              )}
            </button>
          </div>

          {/* Barra de Pesquisa e Filtros Rápidos (Expansível) */}
          {(showFilters || hasActiveFilters) && (
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
              {/* Input de Busca */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por descrição, produto ou notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Dropdowns de Filtro */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Categoria</label>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">Todas</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Conta</label>
                  <select
                    value={selectedAccountFilter}
                    onChange={(e) => setSelectedAccountFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">Todas</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Tag</label>
                  <select
                    value={selectedTagFilter}
                    onChange={(e) => setSelectedTagFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">Todas</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Indicador de Filtros Ativos e Limpar */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400 text-[11px]">
                    {(activeTab === "all" ? confirmedTransactions : pendingTransactions).length} resultado(s)
                  </span>
                  <button
                    onClick={clearFilters}
                    className="text-rose-400 hover:underline text-[11px] font-medium flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {(activeTab === "all" ? confirmedTransactions : pendingTransactions).length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">Nenhuma transação encontrada</p>
              <p className="text-xs text-slate-500 mt-1">
                {hasActiveFilters 
                  ? "Tente alterar os termos da busca ou limpar os filtros."
                  : "Nenhuma transação registrada nesta aba."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpar Filtros
                </button>
              )}
            </div>
          ) : (
            (activeTab === "all" ? confirmedTransactions : pendingTransactions).map(t => (
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
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-slate-400">
                        {new Date(t.date).toLocaleDateString("pt-BR")}
                        {t.rawBankNotification && " • Via Notificação"}
                      </p>

                      {t.tagIds && t.tagIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-1">
                          {t.tagIds.map(tid => {
                            const tg = tags.find(tag => tag.id === tid);
                            if (!tg) return null;
                            return (
                              <span
                                key={tg.id}
                                style={{ backgroundColor: tg.color + '20', color: tg.color, borderColor: tg.color + '40' }}
                                className="px-1.5 py-0.2 text-[9px] font-bold rounded border flex items-center gap-0.5"
                              >
                                <TagIcon className="w-2.5 h-2.5" />
                                {tg.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
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
            ))
          )}
        </div>
      </div>
    </div>
  );
};
