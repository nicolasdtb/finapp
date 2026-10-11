import React, { useState } from "react";
import { ArrowLeft, Plus, Trash2, CreditCard, Tag as TagIcon, FolderTree, Check, X, UserCog } from "lucide-react";
import { Account, Category, Tag, api } from "../services/api.js";
import { formatCentsToBRL, parseInputToCents, centsToDecimalString } from "../utils/currency.js";
import { useToast, useConfirm } from "../components/Feedback.js";
import { AccountPanel } from "../components/AccountPanel.js";

interface SettingsProps {
  onBack: () => void;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  onRefresh: () => Promise<void>;
  isAdmin?: boolean;
}

export const Settings: React.FC<SettingsProps> = ({
  onBack,
  accounts,
  categories,
  tags,
  onRefresh,
  isAdmin = false
}) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<"accounts" | "categories" | "tags" | "account">("accounts");

  // Ajuste de saldo direto na lista de contas (no lugar do prompt do navegador)
  const [editingBalanceId, setEditingBalanceId] = useState<number | null>(null);
  const [balanceDraft, setBalanceDraft] = useState("");

  // Novo Cartão / Conta
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<number>(1);
  const [newAccBalanceCents, setNewAccBalanceCents] = useState<number>(0);
  const [newAccColor, setNewAccColor] = useState("#3B82F6");

  // Dados do cartao (limite, fechamento, vencimento) no cadastro e na edicao
  const [newCardLimitCents, setNewCardLimitCents] = useState<number>(0);
  const [newCardClosing, setNewCardClosing] = useState("");
  const [newCardDue, setNewCardDue] = useState("");
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [cardLimitCents, setCardLimitCents] = useState<number>(0);
  const [cardClosing, setCardClosing] = useState("");
  const [cardDue, setCardDue] = useState("");

  // Nova Categoria
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<number>(2);
  const [newCatColor, setNewCatColor] = useState("#EF4444");

  // Nova Tag
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#64748B");

  const handleNotificationBank = async (acc: Account, value: string) => {
    const res: any = await api.updateAccount(acc.id, { notificationBank: value || null });
    if (res && res.id) {
      toast.success(value ? `Notificações do ${value} vão para "${acc.name}".` : `"${acc.name}" não recebe mais notificações.`);
      await onRefresh();
    } else {
      toast.error("Não foi possível salvar.");
    }
  };

  const validDay = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31;

  const startCardEdit = (acc: Account) => {
    setEditingCardId(acc.id);
    setCardLimitCents(Math.round(parseFloat(acc.creditLimit || "0") * 100));
    setCardClosing(acc.closingDay ? String(acc.closingDay) : "");
    setCardDue(acc.dueDay ? String(acc.dueDay) : "");
  };

  const handleSaveCard = async (acc: Account) => {
    const closing = parseInt(cardClosing, 10);
    const due = parseInt(cardDue, 10);
    if (!validDay(closing)) return toast.error("Informe o dia de fechamento (1 a 31).");
    if (!validDay(due)) return toast.error("Informe o dia de vencimento (1 a 31).");
    const res: any = await api.updateAccount(acc.id, {
      creditLimit: centsToDecimalString(cardLimitCents),
      closingDay: closing,
      dueDay: due
    });
    if (res && res.id) {
      toast.success("Cartão atualizado.");
      setEditingCardId(null);
      await onRefresh();
    } else {
      toast.error("Não foi possível salvar o cartão.");
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName) return;
    const isCard = newAccType === 2;
    const closing = parseInt(newCardClosing, 10);
    const due = parseInt(newCardDue, 10);
    if (isCard && !validDay(closing)) return toast.error("Informe o dia de fechamento (1 a 31).");
    if (isCard && !validDay(due)) return toast.error("Informe o dia de vencimento (1 a 31).");
    await api.createAccount({
      name: newAccName,
      typeId: newAccType,
      balance: centsToDecimalString(isCard && newAccBalanceCents > 0 ? -newAccBalanceCents : newAccBalanceCents),
      color: newAccColor,
      icon: isCard ? "credit-card" : "wallet",
      ...(isCard ? {
        creditLimit: centsToDecimalString(newCardLimitCents),
        closingDay: closing,
        dueDay: due
      } : {})
    });
    setNewAccName("");
    setNewAccBalanceCents(0);
    setNewCardLimitCents(0);
    setNewCardClosing("");
    setNewCardDue("");
    await onRefresh();
  };

  const handleDeleteAccount = async (id: number) => {
    const ok = await confirm({
      title: "Excluir conta",
      message: "Excluir esta conta? Os lançamentos dela continuam no histórico, mas ficam sem conta associada.",
    });
    if (ok) {
      await api.deleteAccount(id);
      await onRefresh();
    }
  };

  const startBalanceEdit = (acc: Account) => {
    setEditingBalanceId(acc.id);
    setBalanceDraft(parseFloat(acc.balance).toFixed(2).replace(".", ","));
  };

  const handleSaveBalance = async (acc: Account) => {
    // Aceita "1234,56", "1234.56" e "1.234,56"
    const normalized = balanceDraft.includes(",")
      ? balanceDraft.replace(/\./g, "").replace(",", ".")
      : balanceDraft;
    const value = parseFloat(normalized);
    if (isNaN(value)) {
      toast.error("Informe um valor válido para o saldo.");
      return;
    }
    try {
      await api.updateAccount(acc.id, { balance: value.toFixed(2) });
      await onRefresh();
      setEditingBalanceId(null);
      toast.success(`Saldo de "${acc.name}" ajustado.`);
    } catch {
      toast.error("Não foi possível ajustar o saldo.");
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    await api.createCategory({
      name: newCatName,
      typeId: newCatType,
      color: newCatColor,
      icon: "tag"
    });
    setNewCatName("");
    await onRefresh();
  };

  const handleDeleteCategory = async (id: number) => {
    const ok = await confirm({ title: "Excluir categoria", message: "Excluir esta categoria?" });
    if (ok) {
      await api.deleteCategory(id);
      await onRefresh();
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName) return;
    await api.createTag({
      name: newTagName,
      color: newTagColor
    });
    setNewTagName("");
    await onRefresh();
  };

  const handleDeleteTag = async (id: number) => {
    const ok = await confirm({ title: "Excluir tag", message: "Excluir esta tag?" });
    if (ok) {
      await api.deleteTag(id);
      await onRefresh();
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-md mx-auto sm:max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-extrabold text-white">Configurações & Gestão</h2>
          <p className="text-xs text-slate-400">Contas, Cartões, Categorias e Tags</p>
        </div>
      </div>

      {/* Abas */}
      <div className="grid grid-cols-4 gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl mb-6">
        <button
          onClick={() => setTab("accounts")}
          className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            tab === "accounts" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Contas
        </button>
        <button
          onClick={() => setTab("categories")}
          className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            tab === "categories" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          Categorias
        </button>
        <button
          onClick={() => setTab("tags")}
          className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            tab === "tags" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <TagIcon className="w-3.5 h-3.5" />
          Tags
        </button>
        <button
          onClick={() => setTab("account")}
          className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            tab === "account" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <UserCog className="w-3.5 h-3.5" />
          Conta
        </button>
      </div>

      {tab === "account" && <AccountPanel isAdmin={isAdmin} />}

      {/* 1. ABA CONTAS E CARTÕES */}
      {tab === "accounts" && (
        <div className="space-y-6">
          {/* Form Nova Conta */}
          <form onSubmit={handleCreateAccount} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Nova Conta / Cartão</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Nome (ex: C6 Bank, XP)"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              />
              <span className="text-[11px] font-semibold text-slate-400 -mb-1">Tipo</span>
              <span className="text-[11px] font-semibold text-slate-400 -mb-1">{newAccType === 2 ? "Dívida atual (quanto já deve)" : "Saldo inicial"}</span>
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              >
                <option value={1}>Conta Corrente</option>
                <option value={2}>Cartão de Crédito</option>
                <option value={3}>Investimento</option>
                <option value={4}>Dinheiro</option>
              </select>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs font-bold text-slate-400">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={formatCentsToBRL(newAccBalanceCents)}
                  onChange={(e) => setNewAccBalanceCents(parseInputToCents(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-8 pr-2.5 text-xs text-white"
                />
              </div>
            </div>
            {newAccType === 2 && (
              <div className="grid grid-cols-3 gap-2">
                <span className="col-span-3 text-[11px] font-semibold text-slate-400 -mb-1">Limite do cartão</span>
                <div className="relative col-span-3">
                  <span className="absolute left-2.5 top-2.5 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Limite do cartão"
                    value={formatCentsToBRL(newCardLimitCents)}
                    onChange={(e) => setNewCardLimitCents(parseInputToCents(e.target.value))}
                    aria-label="Limite do cartão"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-8 pr-2.5 text-xs text-white"
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-400 -mb-1">Dia de fechamento</span>
                <span className="text-[11px] font-semibold text-slate-400 -mb-1">Dia de vencimento</span>
                <span></span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  placeholder="Dia fecha"
                  value={newCardClosing}
                  onChange={(e) => setNewCardClosing(e.target.value)}
                  aria-label="Dia de fechamento da fatura"
                  className="col-span-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  placeholder="Dia vence"
                  value={newCardDue}
                  onChange={(e) => setNewCardDue(e.target.value)}
                  aria-label="Dia de vencimento da fatura"
                  className="col-span-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
                <p className="col-span-3 text-[11px] text-slate-500">
                  Dívida atual: deixe 0 num cartão novo, ou informe quanto você já deve nele. Fechamento: último dia de compras da fatura (no Nubank é 7 dias antes do vencimento: vence dia 8, fecha dia 1). Vencimento: dia do mês em que a fatura vence; se cair em fim de semana ou feriado, vale o próximo dia útil. Compras feitas a partir do dia do fechamento entram na fatura do mês seguinte.
                </p>
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Cor:</span>
                <input
                  type="color"
                  value={newAccColor}
                  onChange={(e) => setNewAccColor(e.target.value)}
                  className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border-0"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
          </form>

          {/* Lista de Contas */}
          <div className="space-y-2">
            {accounts.map(acc => (
              <div key={acc.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: acc.color }}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{acc.name}</h4>
                    <p className="text-xs text-slate-400">R$ {parseFloat(acc.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    {acc.typeId === 2 && (
                      <p className={`text-[11px] ${acc.closingDay && acc.dueDay ? "text-slate-500" : "text-amber-400"}`}>
                        {acc.closingDay && acc.dueDay
                          ? `Fecha dia ${acc.closingDay} • Vence dia ${acc.dueDay} • Limite R$ ${parseFloat(acc.creditLimit || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "Configure fechamento e vencimento"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {acc.typeId === 2 && (
                    <button
                      onClick={() => startCardEdit(acc)}
                      title="Configurar limite, fechamento e vencimento"
                      className="px-2.5 py-1 text-xs font-semibold text-violet-300 hover:text-white bg-violet-500/10 hover:bg-violet-600 rounded-lg transition"
                    >
                      Configurar
                    </button>
                  )}
                  <button
                    onClick={() => startBalanceEdit(acc)}
                    title="Ajustar saldo da conta"
                    className="px-2.5 py-1 text-xs font-semibold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 rounded-lg transition"
                  >
                    Ajustar Saldo
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                    title="Excluir conta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="w-full flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">Notificações do app:</span>
                  <select
                    value={acc.notificationBank ?? ""}
                    onChange={(e) => handleNotificationBank(acc, e.target.value)}
                    aria-label={`App do banco que envia notificações para ${acc.name}`}
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    <option value="">Nenhum</option>
                    <option value="Nubank">Nubank</option>
                    <option value="Banco Inter">Banco Inter</option>
                    <option value="Bradesco">Bradesco</option>
                  </select>
                </div>

                {editingCardId === acc.id && (
                  <div className="w-full grid grid-cols-3 gap-2">
                    <span className="col-span-3 text-[11px] font-semibold text-slate-400 -mb-1">Limite do cartão</span>
                    <div className="relative col-span-3">
                      <span className="absolute left-2.5 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        inputMode="numeric"
                        value={formatCentsToBRL(cardLimitCents)}
                        onChange={(e) => setCardLimitCents(parseInputToCents(e.target.value))}
                        aria-label={`Limite de ${acc.name}`}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-8 pr-2.5 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 -mb-1">Dia de fechamento</span>
                    <span className="text-[11px] font-semibold text-slate-400 -mb-1">Dia de vencimento</span>
                    <span></span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      placeholder="Dia fecha"
                      value={cardClosing}
                      onChange={(e) => setCardClosing(e.target.value)}
                      aria-label="Dia de fechamento"
                      className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      placeholder="Dia vence"
                      value={cardDue}
                      onChange={(e) => setCardDue(e.target.value)}
                      aria-label="Dia de vencimento"
                      className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => handleSaveCard(acc)}
                        title="Salvar cartão"
                        className="p-2 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 rounded-lg transition"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingCardId(null)}
                        title="Cancelar"
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="col-span-3 text-[11px] text-slate-500">
                      Fechamento: último dia de compras da fatura (Nubank: 7 dias antes do vencimento; vence dia 8, fecha dia 1).
                      Vencimento: se cair em fim de semana ou feriado, vale o próximo dia útil.
                    </p>
                  </div>
                )}

                {editingBalanceId === acc.id && (
                  <div className="w-full flex items-center gap-2">
                    <span className="text-xs text-slate-400">R$</span>
                    <input
                      autoFocus
                      inputMode="decimal"
                      value={balanceDraft}
                      onChange={(e) => setBalanceDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveBalance(acc);
                        if (e.key === "Escape") setEditingBalanceId(null);
                      }}
                      aria-label={`Novo saldo de ${acc.name}`}
                      className="flex-1 min-w-0 px-3 py-1.5 bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg text-sm text-white outline-none"
                    />
                    <button
                      onClick={() => handleSaveBalance(acc)}
                      title="Salvar saldo"
                      className="p-2 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 rounded-lg transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingBalanceId(null)}
                      title="Cancelar"
                      className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ABA CATEGORIAS */}
      {tab === "categories" && (
        <div className="space-y-6">
          <form onSubmit={handleCreateCategory} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Nova Categoria</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Nome (ex: Farmácia, Pet)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              />
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              >
                <option value={2}>Despesa</option>
                <option value={1}>Receita</option>
              </select>
            </div>
            <div className="flex justify-between items-center pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Cor:</span>
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border-0"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: cat.color }}>
                    {cat.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{cat.name}</h4>
                    <span className="text-[10px] text-slate-400 uppercase">{cat.typeId === 1 ? "Receita" : "Despesa"}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. ABA TAGS */}
      {tab === "tags" && (
        <div className="space-y-6">
          <form onSubmit={handleCreateTag} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Nova Tag / Etiqueta</h3>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                required
                placeholder="Nome (ex: Férias, Reforma, Assinatura)"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border-0"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            {tags.map(tg => (
              <div key={tg.id} className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tg.color }} />
                <span className="text-xs text-white font-medium">{tg.name}</span>
                <button
                  onClick={() => handleDeleteTag(tg.id)}
                  className="text-slate-500 hover:text-rose-400 ml-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
