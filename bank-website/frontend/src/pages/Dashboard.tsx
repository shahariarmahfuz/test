import React, { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import AccountCard from '../components/AccountCard';
import TransactionItem from '../components/TransactionItem';
import { getAccounts, getTransactions, deposit as apiDeposit, withdraw as apiWithdraw } from '../services/api';
import { Account, Transaction } from '../types';

type ModalType = 'deposit' | 'withdraw' | null;

const Dashboard = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');
  const [txSuccess, setTxSuccess] = useState('');

  const fetchData = async () => {
    try {
      const [accs, txs] = await Promise.all([getAccounts(), getTransactions({ limit: 5 })]);
      setAccounts(accs);
      setTransactions(txs);
    } catch {
      // silently fail; user will see empty state
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (type: ModalType) => {
    setModal(type);
    setAmount('');
    setDescription('');
    setTxError('');
    setTxSuccess('');
    setSelectedAccount(accounts.length > 0 ? accounts[0].id : '');
  };

  const closeModal = () => {
    setModal(null);
    setTxError('');
    setTxSuccess('');
  };

  const handleTransaction = async (e: FormEvent) => {
    e.preventDefault();
    setTxError('');
    setTxSuccess('');

    const parsedAmount = parseFloat(amount);
    if (!selectedAccount) return setTxError('Please select an account');
    if (isNaN(parsedAmount) || parsedAmount <= 0) return setTxError('Enter a valid amount');

    setTxLoading(true);
    try {
      if (modal === 'deposit') {
        await apiDeposit(Number(selectedAccount), parsedAmount, description || 'Deposit');
        setTxSuccess(`Successfully deposited $${parsedAmount.toFixed(2)}`);
      } else {
        await apiWithdraw(Number(selectedAccount), parsedAmount, description || 'Withdrawal');
        setTxSuccess(`Successfully withdrew $${parsedAmount.toFixed(2)}`);
      }
      await fetchData();
      setTimeout(closeModal, 1500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Transaction failed.';
      setTxError(msg);
    } finally {
      setTxLoading(false);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome banner */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.full_name?.split(' ')[0] || user?.username}!
          </h2>
          <p className="text-gray-500 mt-1">Here's your financial overview.</p>
        </div>

        {/* Total balance summary */}
        <div className="bg-primary-700 rounded-2xl p-6 text-white mb-8 shadow-lg">
          <p className="text-primary-200 text-sm font-medium">Total Balance</p>
          <p className="text-4xl font-bold mt-1">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalBalance)}
          </p>
          <p className="text-primary-200 text-sm mt-1">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={() => openModal('deposit')}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Deposit</span>
          </button>
          <button
            onClick={() => openModal('withdraw')}
            className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-medium shadow transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
            <span>Withdraw</span>
          </button>
          <Link
            to="/transfer"
            className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-medium shadow transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Transfer</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Accounts */}
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Accounts</h3>
            {loadingData ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-40 bg-gray-200 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow">
                <p className="text-gray-500">No accounts found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map((acc) => (
                  <AccountCard key={acc.id} account={acc} />
                ))}
              </div>
            )}
          </section>

          {/* Recent Transactions */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Recent Transactions</h3>
              <Link to="/transactions" className="text-sm text-primary-600 hover:underline font-medium">
                View all
              </Link>
            </div>
            <div className="bg-white rounded-2xl shadow divide-y divide-gray-100">
              {loadingData ? (
                <div className="p-6 text-center text-gray-400">Loading…</div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No transactions yet.</div>
              ) : (
                transactions.map((tx) => <TransactionItem key={tx.id} transaction={tx} />)
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 capitalize">{modal}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {txSuccess ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center bg-emerald-100 rounded-full p-4 mb-3">
                  <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-emerald-700 font-medium">{txSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleTransaction} className="space-y-4">
                {txError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                    {txError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_type} — {acc.account_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder={modal === 'deposit' ? 'e.g. Paycheck' : 'e.g. Groceries'}
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={txLoading}
                    className={`flex-1 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center ${
                      modal === 'deposit'
                        ? 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300'
                        : 'bg-red-500 hover:bg-red-600 disabled:bg-red-300'
                    }`}
                  >
                    {txLoading ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                      <span className="capitalize">{modal}</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
