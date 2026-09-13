import { useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard.js";
import { Settings } from "./pages/Settings.js";
import { TransactionModal } from "./components/TransactionModal.js";
import { api, Account, Category, Tag, Transaction } from "./services/api.js";

export function App() {
  const [currentView, setCurrentView] = useState<"dashboard" | "settings">("dashboard");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accs, cats, tgs, txs] = await Promise.all([
        api.getAccounts(),
        api.getCategories(),
        api.getTags(),
        api.getTransactions()
      ]);
      setAccounts(accs);
      setCategories(cats);
      setTags(tgs);
      setTransactions(txs);
    } catch (err) {
      console.error("Erro ao carregar dados da API:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveTransaction = async (data: any) => {
    try {
      if (editingTransaction) {
        await api.updateTransaction(editingTransaction.id, data);
      } else {
        await api.createTransaction(data);
      }
      await loadData();
    } catch (err) {
      alert("Erro ao salvar lançamento.");
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    try {
      await api.deleteTransaction(id);
      await loadData();
    } catch (err) {
      alert("Erro ao excluir lançamento.");
    }
  };

  const handleConfirmPending = async (tx: Transaction) => {
    try {
      await api.confirmTransaction(tx.id, {});
      await loadData();
      alert(`Transação "${tx.description}" confirmada!`);
    } catch (err) {
      alert("Erro ao confirmar transação.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center max-w-md mx-auto sm:max-w-2xl w-full">
        <div>
          <h1 
            onClick={() => setCurrentView("dashboard")}
            className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent cursor-pointer"
          >
            FinApp
          </h1>
          <p className="text-[11px] text-slate-400">Controle Pessoal & Sincronização</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs text-slate-400 font-medium">ZeroTier Conectado</span>
        </div>
      </header>

      <main className="flex-1 w-full">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-400 text-sm">
            Sincronizando com a VM Linux...
          </div>
        ) : currentView === "dashboard" ? (
          <Dashboard 
            transactions={transactions}
            accounts={accounts}
            onNewTransaction={() => {
              setEditingTransaction(null);
              setIsModalOpen(true);
            }}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setIsModalOpen(true);
            }}
            onConfirmPending={handleConfirmPending}
            onOpenSettings={() => setCurrentView("settings")}
          />
        ) : (
          <Settings 
            onBack={() => setCurrentView("dashboard")}
            accounts={accounts}
            categories={categories}
            tags={tags}
            onRefresh={loadData}
          />
        )}
      </main>

      {/* Modal Rico de Lançamento / Edição */}
      <TransactionModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        onDelete={handleDeleteTransaction}
        accounts={accounts}
        categories={categories}
        editingTransaction={editingTransaction}
      />
    </div>
  );
}

export default App;
