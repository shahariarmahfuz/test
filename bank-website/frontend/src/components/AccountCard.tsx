import React from 'react';
import { Account } from '../types';

interface Props {
  account: Account;
}

const formatBalance = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const maskAccountNumber = (num: string) => {
  if (num.length <= 6) return num;
  return num.slice(0, 3) + ' •••• ' + num.slice(-4);
};

const AccountCard = ({ account }: Props) => {
  const isChecking = account.account_type === 'checking';

  return (
    <div
      className={`rounded-2xl p-6 text-white shadow-lg ${
        isChecking
          ? 'bg-gradient-to-br from-primary-600 to-primary-900'
          : 'bg-gradient-to-br from-emerald-500 to-teal-700'
      }`}
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
            {account.account_type}
          </p>
          <p className="text-sm mt-0.5 opacity-70">{maskAccountNumber(account.account_number)}</p>
        </div>
        <div className={`rounded-full p-2 ${isChecking ? 'bg-primary-500' : 'bg-emerald-400'} bg-opacity-40`}>
          {isChecking ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs opacity-70 mb-1">Available Balance</p>
        <p className="text-3xl font-bold tracking-tight">{formatBalance(account.balance)}</p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            account.is_active
              ? 'bg-white bg-opacity-20 text-white'
              : 'bg-red-400 bg-opacity-40 text-red-100'
          }`}
        >
          {account.is_active ? 'Active' : 'Inactive'}
        </span>
        <p className="text-xs opacity-60">
          Opened {new Date(account.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default AccountCard;
