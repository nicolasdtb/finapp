// @ts-ignore
const API_URL = (typeof window !== "undefined" && window.__FINAPP_API_URL__) 
  ? (window as any).__FINAPP_API_URL__ 
  : (import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1");

export interface Account {
  id: number;
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
  id: number;
  name: string;
  typeId: number;
  color: string;
  icon: string;
  parentId?: number;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface TransactionItem {
  id?: number;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  categoryId?: number;
}

export interface Transaction {
  id: number;
  description: string;
  amount: string;
  typeId: number;   // 1: Receita, 2: Despesa, 3: Transferencia
  statusId: number; // 1: Confirmado, 2: Pendente
  date: string;
  accountId: number;
  destinationAccountId?: number;
  categoryId?: number;
  rawBankNotification?: string;
  notes?: string;
  items?: TransactionItem[];
}

export const api = {
  // Contas
  async getAccounts(): Promise<Account[]> {
    const res = await fetch(`${API_URL}/accounts`);
    return res.json();
  },
  async createAccount(data: Partial<Account>): Promise<Account> {
    const res = await fetch(`${API_URL}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateAccount(id: number, data: Partial<Account>): Promise<Account> {
    const res = await fetch(`${API_URL}/accounts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteAccount(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_URL}/accounts/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Categorias
  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_URL}/categories`);
    return res.json();
  },
  async createCategory(data: Partial<Category>): Promise<Category> {
    const res = await fetch(`${API_URL}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteCategory(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_URL}/categories/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Tags
  async getTags(): Promise<Tag[]> {
    const res = await fetch(`${API_URL}/tags`);
    return res.json();
  },
  async createTag(data: Partial<Tag>): Promise<Tag> {
    const res = await fetch(`${API_URL}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteTag(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_URL}/tags/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Transações
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
  async updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`${API_URL}/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteTransaction(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_URL}/transactions/${id}`, { method: "DELETE" });
    return res.json();
  },
  async confirmTransaction(id: number, updates: { categoryId?: number; accountId?: number; description?: string }): Promise<Transaction> {
    const res = await fetch(`${API_URL}/transactions/${id}/confirm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return res.json();
  }
};
