import axios from 'axios';
import { AuthResponse, Account, Transaction, User } from '../types';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────

export const login = (username: string, password: string): Promise<AuthResponse> =>
  api.post<AuthResponse>('/api/auth/login', { username, password }).then((r) => r.data);

export const register = (data: {
  username: string;
  email: string;
  password: string;
  full_name: string;
}): Promise<AuthResponse> =>
  api.post<AuthResponse>('/api/auth/register', data).then((r) => r.data);

export const getMe = (): Promise<User> =>
  api.get<{ user: User }>('/api/auth/me').then((r) => r.data.user);

export const logoutApi = (): Promise<void> =>
  api.post('/api/auth/logout').then(() => undefined);

// ── Accounts ─────────────────────────────────────────────────────────────────

export const getAccounts = (): Promise<Account[]> =>
  api.get<{ accounts: Account[] }>('/api/accounts/').then((r) => r.data.accounts);

export const createAccount = (account_type: 'checking' | 'savings'): Promise<Account> =>
  api.post<{ account: Account }>('/api/accounts/', { account_type }).then((r) => r.data.account);

export const getAccount = (id: number): Promise<Account> =>
  api.get<{ account: Account }>(`/api/accounts/${id}`).then((r) => r.data.account);

// ── Transactions ──────────────────────────────────────────────────────────────

export interface TransactionFilters {
  account_id?: number;
  type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export const getTransactions = (filters: TransactionFilters = {}): Promise<Transaction[]> =>
  api
    .get<{ transactions: Transaction[] }>('/api/transactions/', { params: filters })
    .then((r) => r.data.transactions);

export const deposit = (
  account_id: number,
  amount: number,
  description: string
): Promise<{ transaction: Transaction; account: Account }> =>
  api
    .post<{ transaction: Transaction; account: Account }>('/api/transactions/deposit', {
      account_id,
      amount,
      description,
    })
    .then((r) => r.data);

export const withdraw = (
  account_id: number,
  amount: number,
  description: string
): Promise<{ transaction: Transaction; account: Account }> =>
  api
    .post<{ transaction: Transaction; account: Account }>('/api/transactions/withdraw', {
      account_id,
      amount,
      description,
    })
    .then((r) => r.data);

export const transfer = (
  from_account_id: number,
  to_account_id: number,
  amount: number,
  description: string
): Promise<{ transaction: Transaction; from_account: Account }> =>
  api
    .post<{ transaction: Transaction; from_account: Account }>('/api/transactions/transfer', {
      from_account_id,
      to_account_id,
      amount,
      description,
    })
    .then((r) => r.data);

export default api;
