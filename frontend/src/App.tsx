import { useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard.js";
import { Settings } from "./pages/Settings.js";
import { LoginModal } from "./pages/Login.js";
import { TransactionModal } from "./components/TransactionModal.js";
import { api, Account, Category, Tag, Transaction, User } from "./services/api.js";
import { LogOut, User as UserIcon } from "lucide-react";

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<"dashboard" | "settings">("dashboard");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Verifica se o usuário já está autenticado via token salvo
  const checkAuth = async () => {
    const token = localStorage.getItem("@finapp:token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res.user) {
        setCurrentUser(res.user);
        await loadData();
      } else {
        localStorage.removeItem("@finapp:token");
      }
    } catch {
      localStorage.removeItem("@finapp:token");
    } finally {
      setLoading(false);
    }
  };

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
    checkAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("@finapp:token");
    setCurrentUser(null);
  };

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

  // Se não estiver logado, exibe a tela de login/cadastro
  if (!loading && !currentUser) {
    return (
      <LoginModal
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          loadData();
        }}
      />
    );
  }

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
          <p className="text-[11px] text-slate-400">Olá, {currentUser?.name} • ZeroTier Ativo</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            title="Sair da conta"
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800 transition flex items-center gap-1.5 text-xs font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full pb-20">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-400 text-sm">
            Sincronizando com a VM Linux...
          </div>
        ) : currentView === "dashboard" ? (
          <Dashboard 
            transactions={transactions}
            accounts={accounts}
            categories={categories}
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

      {/* Barra de Navegação Inferior Nativa (estilo Minhas Finanças) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/80 px-4 py-2">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            onClick={() => setCurrentView("dashboard")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
              currentView === "dashboard" ? "text-emerald-400 font-semibold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="text-xl">🏠</span>
            <span className="text-[11px]">Início</span>
          </button>

          <button
            onClick={() => {
              setEditingTransaction(null);
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full shadow-lg shadow-emerald-500/25 -mt-5 hover:scale-105 active:scale-95 transition"
            title="Nova Transação"
          >
            <span className="text-2xl font-bold">+</span>
          </button>

          <button
            onClick={() => setCurrentView("settings")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
              currentView === "settings" ? "text-emerald-400 font-semibold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="text-xl">⚙️</span>
            <span className="text-[11px]">Ajustes</span>
          </button>
        </div>
      </nav>

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
