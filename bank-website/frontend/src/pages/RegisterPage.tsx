import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = (): string => {
    if (!form.full_name.trim()) return 'Full name is required';
    if (!form.username.trim()) return 'Username is required';
    if (!form.email.trim()) return 'Email is required';
    if (!EMAIL_RE.test(form.email)) return 'Invalid email format';
    if (!form.password) return 'Password is required';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    return '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) return setError(validationError);

    setError('');
    setLoading(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fields: { id: keyof typeof form; label: string; type: string; placeholder: string; autoComplete: string }[] = [
    { id: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Jane Doe', autoComplete: 'name' },
    { id: 'username', label: 'Username', type: 'text', placeholder: 'janedoe', autoComplete: 'username' },
    { id: 'email', label: 'Email', type: 'email', placeholder: 'jane@example.com', autoComplete: 'email' },
    { id: 'password', label: 'Password', type: 'password', placeholder: 'Min. 8 characters', autoComplete: 'new-password' },
    { id: 'confirmPassword', label: 'Confirm Password', type: 'password', placeholder: 'Repeat password', autoComplete: 'new-password' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-primary-700 rounded-full p-4 mb-4">
            <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.5 1L2 6v2h19V6L11.5 1zM3 9v9H1v2h21v-2h-2V9H3zm4 0v9H5V9h2zm4 0v9H9V9h2zm4 0v9h-2V9h2zm4 0v9h-2V9h2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SecureBank</h1>
          <p className="text-gray-500 mt-1">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {fields.map(({ id, label, type, placeholder, autoComplete }) => (
              <div key={id}>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={id}>
                  {label}
                </label>
                <input
                  id={id}
                  type={type}
                  autoComplete={autoComplete}
                  value={form[id]}
                  onChange={set(id)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                  placeholder={placeholder}
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center space-x-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Creating account…</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
