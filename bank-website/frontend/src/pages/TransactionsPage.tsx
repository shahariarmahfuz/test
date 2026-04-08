import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import TransactionItem from '../components/TransactionItem';
import { getAccounts, getTransactions } from '../services/api';
import { Account, Transaction } from '../types';

const PAGE_SIZE = 20;

const TransactionsPage = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [accountFilter, setAccountFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const fetchTransactions = async (newLimit?: number) => {
    setLoading(true);
    setError('');
    try {
      const filters: Record<string, string | number> = {
        limit: newLimit ?? limit,
      };
      if (accountFilter) filters.account_id = Number(accountFilter);
      if (typeFilter) filters.type = typeFilter;
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;
      const txs = await getTransactions(filters);
      setTransactions(txs);
    } catch {
      setError('Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {});
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setLimit(PAGE_SIZE);
    fetchTransactions(PAGE_SIZE);
  };

  const loadMore = () => {
    const newLimit = limit + PAGE_SIZE;
    setLimit(newLimit);
    fetchTransactions(newLimit);
  };

  const selectedAccountId = accountFilter ? Number(accountFilter) : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Transaction History</h2>

        {/* Filters */}
        <form
          onSubmit={handleFilter}
          className="bg-white rounded-2xl shadow p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Account filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_type} — {acc.account_number.slice(-4)}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* End date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex items-center space-x-3">
            <button
              type="submit"
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountFilter('');
                setTypeFilter('');
                setStartDate('');
                setEndDate('');
                setLimit(PAGE_SIZE);
                setTimeout(() => fetchTransactions(PAGE_SIZE), 0);
              }}
              className="text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
        </form>

        {/* Transaction list */}
        <div className="bg-white rounded-2xl shadow">
          {error && (
            <div className="p-4 text-red-600 text-sm">{error}</div>
          )}

          {loading && transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Loading transactions…</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No transactions found for the selected filters.
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    currentAccountId={selectedAccountId}
                  />
                ))}
              </div>

              {transactions.length >= limit && (
                <div className="p-4 text-center border-t border-gray-100">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="text-primary-600 hover:text-primary-700 font-medium text-sm disabled:opacity-50"
                  >
                    {loading ? 'Loading…' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default TransactionsPage;
