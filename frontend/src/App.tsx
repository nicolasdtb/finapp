import React, { useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard.js";
import { api, Account, Transaction } from "./services/api.js";

export function App() {
  const [accounts, setAccounts] = useState<Account[]>([
    { id: "1", name: "Nubank", typeId: 2, balance: "1420.50", color: "#820AD1", icon: "credit-card" },
    { id: "2", name: "Banco Inter", typeId: 1, balance: "3850.00", color: "#FF7A00", icon: "wallet" },
    { id: "3", name: "Carteira Dinheiro", typeId: 4, balance: "180.00", color: "#10B981", icon: "banknote" },
  ]);

  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: "101",
      description: "Supermercado Carrefour",
      amount: "142.90",
      typeId: 2,
      statusId: 2, // Pendente vindo do banco
      date: new Date().toISOString(),
      accountId: "1",
      rawBankNotification: "Compra de R$ 142,90 aprovada no Carrefour"
    },
    {
      id: "102",
      description: "Salário Empresa",
      amount: "5200.00",
      typeId: 1,
      statusId: 1,
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      accountId: "2"
    },
    {
      id: "103",
      description: "Posto Shell Combustível",
      amount: "210.00",
      typeId: 2,
      statusId: 1,
      date: new Date(Date.now() - 86400000 * 4).toISOString(),
      accountId: "1"
    }
  ]);

  const handleConfirmPending = (tx: Transaction) => {
    const updated = transactions.map(t => 
      t.id === tx.id ? { ...t, statusId: 1 } : t
    );
    setTransactions(updated);
    alert(`Transação "${tx.description}" confirmada e consolidada com sucesso!`);
  };

  const handleNewTransaction = () => {
    const desc = prompt("Descrição do gasto/receita:");
    if (!desc) return;
    const amountStr = prompt("Valor (ex: 45.50):");
    if (!amountStr) return;

    const newTx: Transaction = {
      id: Date.now().toString(),
      description: desc,
      amount: amountStr,
      typeId: 2,
      statusId: 1,
      date: new Date().toISOString(),
      accountId: accounts[0].id
    };

    setTransactions([newTx, ...transactions]);
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
        <Dashboard 
          transactions={transactions}
          accounts={accounts}
          onNewTransaction={handleNewTransaction}
          onConfirmPending={handleConfirmPending}
        />
      </main>
    </div>
  );
}

export default App;
