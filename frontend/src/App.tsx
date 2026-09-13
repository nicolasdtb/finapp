import { useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard.js";
import { api, Account, Transaction } from "./services/api.js";

export function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega dados reais da API e cria contas iniciais se o banco estiver vazio
  const loadData = async () => {
    try {
      setLoading(true);
      let accs = await api.getAccounts();
      
      // Se for a primeira vez e nao houver contas, cria contas padrao
      if (accs.length === 0) {
        await api.createAccount({
          name: "Nubank (Cartão)",
          typeId: 2, // Cartão de Crédito
          balance: "0.00",
          color: "#820AD1",
          icon: "credit-card"
        });
        await api.createAccount({
          name: "Conta Principal",
          typeId: 1, // Conta Corrente
          balance: "2500.00",
          color: "#3B82F6",
          icon: "wallet"
        });
        await api.createAccount({
          name: "Carteira Dinheiro",
          typeId: 4, // Dinheiro físico
          balance: "150.00",
          color: "#10B981",
          icon: "banknote"
        });
        accs = await api.getAccounts();
      }
      setAccounts(accs);

      const txs = await api.getTransactions();
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

  const handleConfirmPending = async (tx: Transaction) => {
    try {
      await api.confirmTransaction(tx.id, {});
      await loadData();
      alert(`Transação "${tx.description}" confirmada e consolidada!`);
    } catch (err) {
      alert("Erro ao confirmar transação.");
    }
  };

  const handleNewTransaction = async () => {
    const desc = prompt("Descrição do gasto ou receita:");
    if (!desc) return;
    const amountStr = prompt("Valor (ex: 45.50):");
    if (!amountStr) return;

    if (accounts.length === 0) {
      alert("Nenhuma conta encontrada para lançar.");
      return;
    }

    try {
      await api.createTransaction({
        description: desc,
        amount: amountStr,
        typeId: 2, // Despesa
        statusId: 1, // Confirmado
        date: new Date().toISOString(),
        accountId: accounts[0].id
      });
      await loadData();
    } catch (err) {
      alert("Erro ao criar transação.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center max-w-md mx-auto sm:max-w-2xl w-full">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
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
            Sincronizando dados com o servidor...
          </div>
        ) : (
          <Dashboard 
            transactions={transactions}
            accounts={accounts}
            onNewTransaction={handleNewTransaction}
            onConfirmPending={handleConfirmPending}
          />
        )}
      </main>
    </div>
  );
}

export default App;
