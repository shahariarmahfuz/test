import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getAccounts, transfer as apiTransfer } from '../services/api';
import { Account } from '../types';

type Step = 'form' | 'review' | 'success';

const STEPS: Step[] = ['form', 'review', 'success'];

const TransferPage = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [step, setStep] = useState<Step>('form');

  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAccounts()
      .then((accs) => {
        setAccounts(accs);
        if (accs.length > 0) setFromAccountId(String(accs[0].id));
      })
      .catch(() => {});
  }, []);

  const fromAccount = accounts.find((a) => String(a.id) === fromAccountId);
  const toAccount = accounts.find((a) => String(a.id) === toAccountId);
  const parsedAmount = parseFloat(amount);

  const validateForm = (): string => {
    if (!fromAccountId) return 'Please select a source account';
    if (!toAccountId) return 'Please select a destination account';
    if (fromAccountId === toAccountId) return 'Source and destination accounts must be different';
    if (isNaN(parsedAmount) || parsedAmount <= 0) return 'Enter a valid amount greater than 0';
    if (fromAccount && fromAccount.balance < parsedAmount) return 'Insufficient funds';
    return '';
  };

  const handleReview = (e: FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) return setError(err);
    setError('');
    setStep('review');
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      await apiTransfer(
        Number(fromAccountId),
        Number(toAccountId),
        parsedAmount,
        description || 'Transfer'
      );
      setStep('success');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Transfer failed. Please try again.';
      setError(msg);
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('form');
    setToAccountId('');
    setAmount('');
    setDescription('');
    setError('');
  };

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Transfer Funds</h2>

        <div className="bg-white rounded-2xl shadow p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-center mb-8">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                    step === s
                      ? 'bg-primary-600 text-white'
                      : i < STEPS.indexOf(step)
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < STEPS.indexOf(step) ? '✓' : i + 1}
                </div>
                {i < 2 && <div className="flex-1 h-0.5 bg-gray-200 mx-2" />}
              </React.Fragment>
            ))}
          </div>

          {/* Success */}
          {step === 'success' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center bg-emerald-100 rounded-full p-5 mb-4">
                <svg className="h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Transfer Successful!</h3>
              <p className="text-gray-500 mb-6">
                {fmtCurrency(parsedAmount)} transferred successfully.
              </p>
              <div className="flex space-x-3 justify-center">
                <button
                  onClick={reset}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                  New Transfer
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                  Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Review */}
          {step === 'review' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Review Transfer</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">From</span>
                  <span className="font-medium text-sm">
                    {fromAccount?.account_type} — {fromAccount?.account_number}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">To</span>
                  <span className="font-medium text-sm">
                    {toAccount?.account_type} — {toAccount?.account_number}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Amount</span>
                  <span className="font-bold text-primary-700 text-lg">{fmtCurrency(parsedAmount)}</span>
                </div>
                {description && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">Description</span>
                    <span className="font-medium text-sm">{description}</span>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 text-sm">Balance after</span>
                  <span className="font-medium text-sm">
                    {fmtCurrency((fromAccount?.balance ?? 0) - parsedAmount)}
                  </span>
                </div>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center"
                >
                  {loading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    'Confirm Transfer'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          {step === 'form' && (
            <form onSubmit={handleReview} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Account</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select account…</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_type} — {acc.account_number} (
                      {fmtCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Account</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select account…</option>
                  {accounts
                    .filter((acc) => String(acc.id) !== fromAccountId)
                    .map((acc) => (
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
                {fromAccount && (
                  <p className="text-xs text-gray-400 mt-1">
                    Available: {fmtCurrency(fromAccount.balance)}
                  </p>
                )}
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
                  placeholder="e.g. Rent payment"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                Review Transfer
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default TransferPage;
