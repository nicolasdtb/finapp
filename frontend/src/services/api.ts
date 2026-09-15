// @ts-ignore
const API_URL = (typeof window !== "undefined" && window.__FINAPP_API_URL__) 
  ? (window as any).__FINAPP_API_URL__ 
  : (import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1");

function getAuthHeaders() {
  const token = localStorage.getItem("@finapp:token");
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
}

export interface User {
  id: number;
  name: string;
  email: string;
}

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

export interface Budget {
  id: number;
  categoryId: number;
  monthYear: string;
  targetAmount: string;
  userId?: number;
}

export interface TransactionItem {
  id?: number;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  categoryId?: number;
  tagIds?: number[];
}

export interface Transaction {
  id: number;
  description: string;
  amount: string;
  typeId: number;
  statusId: number;
  date: string;
  accountId: number;
  destinationAccountId?: number;
  categoryId?: number;
  tagIds?: number[];
  rawBankNotification?: string;
  notes?: string;
  items?: TransactionItem[];
}

export const api = {
  // Autenticação
  async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; message?: string }> {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async register(name: string, email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; message?: string }> {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    return res.json();
  },

  async getMe(): Promise<{ user?: User }> {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Contas
  async getAccounts(): Promise<Account[]> {
    const res = await fetch(`${API_URL}/accounts`, { headers: getAuthHeaders() });
    return res.json();
  },
  async createAccount(data: Partial<Account>): Promise<Account> {
    const res = await fetch(`${API_URL}/accounts`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateAccount(id: number, data: Partial<Account>): Promise<Account> {
    const res = await fetch(`${API_URL}/accounts/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteAccount(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_URL}/accounts/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    return res.json();
  },

  // Categorias
  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_URL}/categories`, { headers: getAuthHeaders() });
    return res.json();
  },
  async createCategory(data: Partial<Category>): Promise<Category> {
    const res = await fetch(`${API_URL}/categories`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteCategory(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_URL}/categories/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    return res.json();
  },

  // Tags
  async getTags(): Promise<Tag[]> {
    const res = await fetch(`${API_URL}/tags`, { headers: getAuthHeaders() });
    return res.json();
  },
  async createTag(data: Partial<Tag>): Promise<Tag> {
    const res = await fetch(`${API_URL}/tags`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteTag(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_URL}/tags/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    return res.json();
  },

  // Transações
  async getTransactions(): Promise<Transaction[]> {
    const res = await fetch(`${API_URL}/transactions`, { headers: getAuthHeaders() });
    return res.json();
  },
  async createTransaction(data: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`${API_URL}/transactions`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`${API_URL}/transactions/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteTransaction(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_URL}/transactions/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    return res.json();
  },
  async confirmTransaction(id: number, updates: { categoryId?: number; accountId?: number; description?: string }): Promise<Transaction> {
    const res = await fetch(`${API_URL}/transactions/${id}/confirm`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  // Orçamentos e Metas
  async getBudgets(): Promise<Budget[]> {
    const res = await fetch(`${API_URL}/budgets`, { headers: getAuthHeaders() });
    return res.json();
  },
  async saveBudget(data: { categoryId: number; targetAmount: string; monthYear?: string }): Promise<Budget> {
    const res = await fetch(`${API_URL}/budgets`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteBudget(id: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_URL}/budgets/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Leitura de Nota Fiscal
  async parseInvoice(url: string): Promise<{ success: boolean; data?: ParsedInvoiceResult; message?: string }> {
    const res = await fetch(`${API_URL}/invoices/parse`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ url }),
    });
    return res.json();
  },

  // Importação de Extrato Bancário (CSV / OFX)
  async parseStatement(accountId: number, fileContent: string, fileName?: string): Promise<{ success: boolean; data?: StatementParseResult; message?: string }> {
    const res = await fetch(`${API_URL}/import/parse`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ accountId, fileContent, fileName }),
    });
    return res.json();
  },

  async confirmImportStatement(accountId: number, items: Array<{
    date: string;
    description: string;
    amount: string;
    typeId: number;
    categoryId?: number | null;
    externalId?: string;
  }>): Promise<{ success: boolean; message?: string; importedCount?: number }> {
    const res = await fetch(`${API_URL}/import/confirm`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ accountId, items }),
    });
    return res.json();
  }
};

export interface StatementItem {
  externalId: string;
  date: string;
  description: string;
  originalDescription: string;
  amount: string;
  typeId: 1 | 2;
  suggestedCategoryId: number | null;
  isDuplicate: boolean;
  duplicateReason?: string;
}

export interface StatementParseResult {
  totalFound: number;
  newItemsCount: number;
  duplicatesCount: number;
  items: StatementItem[];
}

export interface ParsedInvoiceResult {
  storeName: string;
  totalAmount: string;
  date: string;
  items: {
    name: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
  }[];
}
