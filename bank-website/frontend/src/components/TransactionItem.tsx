import React from 'react';
import { Transaction } from '../types';

interface Props {
  transaction: Transaction;
  currentAccountId?: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const typeConfig = {
  deposit: {
    label: 'Deposit',
    sign: '+',
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
    icon: (
      <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  withdrawal: {
    label: 'Withdrawal',
    sign: '-',
    color: 'text-red-600',
    bg: 'bg-red-100',
    icon: (
      <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    ),
  },
  transfer: {
    label: 'Transfer',
    sign: '↔',
    color: 'text-primary-600',
    bg: 'bg-primary-100',
    icon: (
      <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
};

const TransactionItem = ({ transaction, currentAccountId }: Props) => {
  const cfg = typeConfig[transaction.transaction_type];

  const isOutgoing =
    transaction.transaction_type === 'withdrawal' ||
    (transaction.transaction_type === 'transfer' &&
      transaction.from_account_id === currentAccountId);

  const amountSign =
    transaction.transaction_type === 'transfer'
      ? isOutgoing
        ? '-'
        : '+'
      : transaction.transaction_type === 'deposit'
      ? '+'
      : '-';

  const amountColor =
    amountSign === '+' ? 'text-emerald-600' : 'text-red-600';

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors">
      <div className="flex items-center space-x-3">
        <div className={`rounded-full p-2 ${cfg.bg} flex-shrink-0`}>{cfg.icon}</div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {transaction.description || cfg.label}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(transaction.timestamp)}</p>
        </div>
      </div>

      <div className="text-right ml-4">
        <p className={`text-sm font-semibold ${amountColor}`}>
          {amountSign}
          {formatCurrency(transaction.amount)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Bal: {formatCurrency(transaction.balance_after)}
        </p>
      </div>
    </div>
  );
};

export default TransactionItem;
