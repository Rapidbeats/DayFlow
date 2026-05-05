import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/BrandLogo';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div
        className="w-full max-w-md p-8 rounded-[24px] border border-[var(--border2)]"
        style={{ background: 'var(--surface)', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-5">
            <BrandLogo size={48} />
          </div>
          <p className="text-[13px] text-[var(--muted2)]">Plan your day with ease</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[15px] outline-none transition-colors focus:border-[var(--accent)]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[15px] outline-none transition-colors focus:border-[var(--accent)]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 rounded-[var(--r)] bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] text-[var(--danger)] text-[13px]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-[var(--r)] bg-[var(--accent)] text-[var(--bg)] font-semibold text-[15px] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Sign up' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="text-[13px] text-[var(--accent)] hover:underline"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
