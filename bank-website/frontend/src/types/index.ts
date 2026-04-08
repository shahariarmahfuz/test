export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  created_at: string;
  is_admin: boolean;
}

export interface Account {
  id: number;
  account_number: string;
  account_type: 'checking' | 'savings';
  balance: number;
  created_at: string;
  is_active: boolean;
}

export interface Transaction {
  id: number;
  transaction_type: 'deposit' | 'withdrawal' | 'transfer';
  amount: number;
  description: string;
  timestamp: string;
  from_account_id: number | null;
  to_account_id: number | null;
  balance_after: number;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
