const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export interface Account {
  id: string;
  name: string;
  typeId: number;
  balance: string;
  color: string;
  icon: string;
  creditLimit?: string;
  closingDay?: number;
  dueDay?: number;
}

export interface Category {
  id: string;
  name: string;
  typeId: number;
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: string;
  typeId: number;   // 1: Receita, 2: Despesa, 3: Transferencia
  statusId: number; // 1: Confirmado, 2: Pendente
  date: string;
  accountId: string;
  categoryId?: string;
  rawBankNotification?: string;
  notes?: string;
}

export const api = {
  async getAccounts(): Promise<Account[]> {
    const res = await fetch(`${API_URL}/accounts`);
    return res.json();
  },
  async getTransactions(): Promise<Transaction[]> {
    const res = await fetch(`${API_URL}/transactions`);
    return res.json();
  },
  async createTransaction(data: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`${API_URL}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async confirmTransaction(id: string, updates: { categoryId?: string; accountId?: string; description?: string }): Promise<Transaction> {
    const res = await fetch(`${API_URL}/transactions/${id}/confirm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return res.json();
  }
};
