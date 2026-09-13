import React, { useState } from "react";
import { ArrowLeft, Plus, Trash2, CreditCard, Tag as TagIcon, FolderTree } from "lucide-react";
import { Account, Category, Tag, api } from "../services/api.js";

interface SettingsProps {
  onBack: () => void;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  onRefresh: () => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({
  onBack,
  accounts,
  categories,
  tags,
  onRefresh
}) => {
  const [tab, setTab] = useState<"accounts" | "categories" | "tags">("accounts");

  // Novo Cartão / Conta
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<number>(1);
  const [newAccBalance, setNewAccBalance] = useState("0.00");
  const [newAccColor, setNewAccColor] = useState("#3B82F6");

  // Nova Categoria
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<number>(2);
  const [newCatColor, setNewCatColor] = useState("#EF4444");

  // Nova Tag
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#64748B");

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName) return;
    await api.createAccount({
      name: newAccName,
      typeId: newAccType,
      balance: newAccBalance,
      color: newAccColor,
      icon: newAccType === 2 ? "credit-card" : "wallet"
    });
    setNewAccName("");
    setNewAccBalance("0.00");
    await onRefresh();
  };

  const handleDeleteAccount = async (id: number) => {
    if (confirm("Excluir esta conta apagará todos os lançamentos associados a ela. Confirmar?")) {
      await api.deleteAccount(id);
      await onRefresh();
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
    if (confirm("Excluir esta categoria?")) {
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
    if (confirm("Excluir esta tag?")) {
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
      <div className="grid grid-cols-3 gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl mb-6">
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
      </div>

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
              <input
                type="number"
                step="0.01"
                placeholder="Saldo Inicial"
                value={newAccBalance}
                onChange={(e) => setNewAccBalance(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
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
              <div key={acc.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: acc.color }}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{acc.name}</h4>
                    <p className="text-xs text-slate-400">R$ {parseFloat(acc.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteAccount(acc.id)}
                  className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
