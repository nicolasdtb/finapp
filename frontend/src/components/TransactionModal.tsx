import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Camera, ShoppingBag, Tag as TagIcon } from "lucide-react";
import { Account, Category, Tag, Transaction, TransactionItem, api } from "../services/api.js";
import { 
  formatCentsToBRL, 
  parseInputToCents, 
  decimalToCents, 
  centsToDecimalString,
  formatQuantity,
  getTodayLocalDateString
} from "../utils/currency.js";
import { QrScannerModal } from "./QrScannerModal.js";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  editingTransaction?: Transaction | null;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  accounts,
  categories,
  tags,
  editingTransaction
}) => {
  if (!isOpen) return null;

  const [typeId, setTypeId] = useState<number>(editingTransaction?.typeId || 2); // 1: Receita, 2: Despesa
  const [description, setDescription] = useState(editingTransaction?.description || "");
  // amountCents armazena o valor em centavos inteiros (ex: 4590 para R$ 45,90)
  const [amountCents, setAmountCents] = useState<number>(
    editingTransaction?.amount ? decimalToCents(editingTransaction.amount) : 0
  );
  const [accountId, setAccountId] = useState<number>(editingTransaction?.accountId || accounts[0]?.id || 1);
  const [categoryId, setCategoryId] = useState<number | undefined>(editingTransaction?.categoryId || categories[0]?.id);
  const [tagIds, setTagIds] = useState<number[]>(editingTransaction?.tagIds || []);
  const [date, setDate] = useState(
    editingTransaction?.date 
      ? getTodayLocalDateString(new Date(editingTransaction.date)) 
      : getTodayLocalDateString()
  );
  const [notes, setNotes] = useState(editingTransaction?.notes || "");

  // Detalhamento de Itens da Compra (Supermercado / Nota Fiscal)
  const [showItems, setShowItems] = useState(Boolean(editingTransaction?.items && editingTransaction.items.length > 0));
  const [items, setItems] = useState<TransactionItem[]>(editingTransaction?.items || []);

  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPriceCents, setItemPriceCents] = useState<number>(0);
  const [itemTagIds, setItemTagIds] = useState<number[]>([]);
  const [activeTagPickerItemIndex, setActiveTagPickerItemIndex] = useState<number | null>(null);
  const [showNewItemTagPicker, setShowNewItemTagPicker] = useState(false);

  // Leitor de Nota Fiscal (QR Code)
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScanningInvoice, setIsScanningInvoice] = useState(false);

  const handleScanInvoice = async (url: string) => {
    try {
      setIsScanningInvoice(true);
      const res = await api.parseInvoice(url);

      if (res.success && res.data) {
        const { storeName, totalAmount, date: invDate, items: invItems } = res.data;

        // Auto-preenche os dados da transação
        if (storeName && (!description || description === "Nova Despesa")) {
          setDescription(storeName);
        }
        if (invDate) {
          setDate(invDate);
        }

        if (invItems && invItems.length > 0) {
          setShowItems(true);
          setItems(invItems);
          const totalCents = decimalToCents(totalAmount);
          setAmountCents(totalCents > 0 ? totalCents : invItems.reduce((acc, i) => acc + decimalToCents(i.totalPrice), 0));
        } else if (totalAmount) {
          setAmountCents(decimalToCents(totalAmount));
        }

        setIsScannerOpen(false);
      } else {
        alert(res.message || "Não foi possível extrair os produtos desta nota.");
      }
    } catch (err: any) {
      alert("Erro ao consultar nota fiscal: " + (err.message || err));
    } finally {
      setIsScanningInvoice(false);
    }
  };

  const handleAddItem = () => {
    if (!itemName || itemPriceCents <= 0) return;
    const qty = parseFloat(itemQty.replace(",", ".")) || 1;
    const price = itemPriceCents / 100;
    const total = (qty * price).toFixed(2);

    const newItem: TransactionItem = {
      name: itemName,
      quantity: formatQuantity(qty),
      unitPrice: price.toFixed(2),
      totalPrice: total,
      tagIds: itemTagIds.length > 0 ? itemTagIds : undefined,
    };

    const newItems = [...items, newItem];
    setItems(newItems);

    // Auto-calcula o valor total da transação somando os itens
    const sumCents = newItems.reduce((acc, i) => acc + decimalToCents(i.totalPrice), 0);
    setAmountCents(sumCents);

    setItemName("");
    setItemPriceCents(0);
    setItemQty("1");
    setItemTagIds([]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
    if (updated.length > 0) {
      const sumCents = updated.reduce((acc, i) => acc + decimalToCents(i.totalPrice), 0);
      setAmountCents(sumCents);
    }
  };

  // Sincroniza o estado do modal se o editingTransaction mudar
  useEffect(() => {
    if (editingTransaction) {
      setTypeId(editingTransaction.typeId);
      setDescription(editingTransaction.description);
      setAmountCents(decimalToCents(editingTransaction.amount));
      setAccountId(editingTransaction.accountId);
      setCategoryId(editingTransaction.categoryId);
      setTagIds(editingTransaction.tagIds || []);
      setDate(
        editingTransaction.date 
          ? getTodayLocalDateString(new Date(editingTransaction.date)) 
          : getTodayLocalDateString()
      );
      setNotes(editingTransaction.notes || "");
      setShowItems(Boolean(editingTransaction.items && editingTransaction.items.length > 0));
      setItems(editingTransaction.items || []);
    } else {
      setTypeId(2);
      setDescription("");
      setAmountCents(0);
      setAccountId(accounts[0]?.id || 1);
      setCategoryId(categories[0]?.id);
      setTagIds([]);
      setDate(getTodayLocalDateString());
      setNotes("");
      setShowItems(false);
      setItems([]);
    }
  }, [editingTransaction, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || amountCents <= 0) return;

    // Envia a data com meio-dia local (12:00:00) para evitar que o UTC recue 1 dia no fuso horário do Brasil (UTC-3)
    const [y, m, d] = date.split("-").map(Number);
    const localDate = new Date(y, m - 1, d, 12, 0, 0);

    await onSave({
      description,
      amount: centsToDecimalString(amountCents),
      typeId,
      statusId: 1,
      date: localDate.toISOString(),
      accountId,
      categoryId,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      notes,
      items: showItems ? items : undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white">
            {editingTransaction ? "Editar Lançamento" : "Novo Lançamento"}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tipo: Despesa ou Receita */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl mb-5 border border-slate-800">
          <button
            type="button"
            onClick={() => setTypeId(2)}
            className={`py-2 text-xs font-bold rounded-xl transition ${
              typeId === 2 ? "bg-rose-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Despesa
          </button>
          <button
            type="button"
            onClick={() => setTypeId(1)}
            className={`py-2 text-xs font-bold rounded-xl transition ${
              typeId === 1 ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Receita
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Valor Principal com máscara monetária automática */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Valor (R$)</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-lg font-bold text-slate-400">R$</span>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="0,00"
                value={formatCentsToBRL(amountCents)}
                onChange={(e) => setAmountCents(parseInputToCents(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-2xl font-extrabold text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Descrição</label>
            <input
              type="text"
              required
              placeholder="Ex: Supermercado Carrefour, Salário, Gasolina"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Conta / Cartão */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Conta / Cartão</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            {/* Categoria */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Categoria</label>
              <select
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Sem categoria</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(t => {
                  const isSelected = tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTagIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]);
                      }}
                      style={{ 
                        backgroundColor: isSelected ? t.color : 'transparent',
                        borderColor: t.color,
                        color: isSelected ? '#fff' : t.color
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1 transition-all"
                    >
                      <TagIcon className="w-3 h-3" />
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Detalhar Itens da Compra (Supermercado / NF-e) */}
          <div className="border-t border-slate-800/80 pt-4">
            <div className="flex justify-between items-center mb-3">
              <button
                type="button"
                onClick={() => setShowItems(!showItems)}
                className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300"
              >
                <ShoppingBag className="w-4 h-4" />
                {showItems ? "Ocultar detalhamento de produtos" : "+ Detalhar itens da compra (Supermercado / NF)"}
              </button>
              {showItems && (
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  Ler Nota Fiscal
                </button>
              )}
            </div>

            {showItems && (
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 space-y-3">
                {/* Linha de Inputs do Item com layout mobile amigável e botão de adicionar grande */}
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nome do produto (ex: Arroz 5kg)"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500"
                  />
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map(t => {
                        const isSelected = itemTagIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setItemTagIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]);
                            }}
                            style={{ 
                              backgroundColor: isSelected ? t.color : 'transparent',
                              borderColor: t.color,
                              color: isSelected ? '#fff' : t.color
                            }}
                            className="px-2 py-0.5 text-[9px] font-bold rounded-md border flex items-center gap-0.5 transition-all"
                          >
                            <TagIcon className="w-2.5 h-2.5" />
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-2 items-center mt-2">
                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Qtd</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="1"
                        value={itemQty}
                        onChange={(e) => setItemQty(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white text-center font-semibold"
                      />
                    </div>
                    <div className="col-span-5">
                      <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Preço Unitário</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2.5 text-[11px] font-bold text-slate-400">R$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          value={formatCentsToBRL(itemPriceCents)}
                          onChange={(e) => setItemPriceCents(parseInputToCents(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-8 pr-2 text-xs text-white font-semibold"
                        />
                      </div>
                    </div>
                    <div className="col-span-4 pt-4">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full h-10 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 text-xs transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de Itens Adicionados */}
                {items.length > 0 && (
                  <div className="divide-y divide-slate-800 max-h-56 overflow-y-auto pt-1 mt-2 border-t border-slate-800">
                    {items.map((it, idx) => {
                      const itemSelectedTags = (it.tagIds || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
                      const isPickerOpen = activeTagPickerItemIndex === idx;

                      return (
                        <div key={idx} className="py-2 flex flex-col gap-1 text-xs">
                          <div className="flex justify-between items-start">
                            <span className="text-slate-200 font-medium truncate flex-1 pr-2">
                              {formatQuantity(it.quantity)}x {it.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-100">
                                R$ {parseFloat(it.totalPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-rose-400 hover:text-rose-300 p-1 rounded-lg hover:bg-rose-500/10 transition shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Renderiza apenas as tags selecionadas + botão de editar/adicionar tag */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {itemSelectedTags.map(t => (
                              <span
                                key={t.id}
                                style={{ backgroundColor: t.color + '20', color: t.color, borderColor: t.color + '50' }}
                                className="px-1.5 py-0.5 text-[9px] font-bold rounded border flex items-center gap-0.5"
                              >
                                <TagIcon className="w-2.5 h-2.5" />
                                {t.name}
                              </span>
                            ))}

                            {tags.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveTagPickerItemIndex(isPickerOpen ? null : idx)}
                                className="px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 hover:text-blue-400 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded transition flex items-center gap-1"
                              >
                                <span>{isPickerOpen ? "Fechar Tags" : "+ Tag"}</span>
                              </button>
                            )}
                          </div>

                          {/* Seletor expandível para o item específico (evita poluição na tela) */}
                          {isPickerOpen && tags.length > 0 && (
                            <div className="mt-1 p-2 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap gap-1 shadow-inner">
                              {tags.map(t => {
                                const isSelected = (it.tagIds || []).includes(t.id);
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      setItems(prev => prev.map((item, i) => {
                                        if (i !== idx) return item;
                                        const current = item.tagIds || [];
                                        const updated = current.includes(t.id)
                                          ? current.filter(id => id !== t.id)
                                          : [...current, t.id];
                                        return { ...item, tagIds: updated };
                                      }));
                                    }}
                                    style={{ 
                                      backgroundColor: isSelected ? t.color : 'transparent',
                                      borderColor: isSelected ? t.color : t.color + '40',
                                      color: isSelected ? '#fff' : t.color
                                    }}
                                    className="px-2 py-0.5 text-[9px] font-bold rounded border flex items-center gap-0.5 transition-all"
                                  >
                                    <TagIcon className="w-2.5 h-2.5" />
                                    {t.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-2">
            {editingTransaction && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Tem certeza que deseja excluir este lançamento?")) {
                    onDelete(editingTransaction.id);
                    onClose();
                  }
                }}
                className="p-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl font-semibold text-sm border border-rose-500/30 flex items-center justify-center"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition text-sm"
            >
              {editingTransaction ? "Salvar Alterações" : "Confirmar Lançamento"}
            </button>
          </div>
        </form>
      </div>

      {/* Modal Leitor de QR Code / NFC-e */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanInvoice}
        isLoading={isScanningInvoice}
      />
    </div>
  );
};
