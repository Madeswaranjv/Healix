import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Eye, EyeOff, Activity } from 'lucide-react';
import { useStore } from '../../store/useStore';
import './auth.css';

/* ── Google SVG Icon ── */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/* ── Left panel: a real, characteristic Healix answer card, not marketing copy ── */
function BrandPanel() {
  return (
    <div className="auth-brand hidden lg:flex lg:flex-col lg:justify-between p-10 xl:p-14">
      <div className="flex items-center gap-2">
        <Activity size={20} strokeWidth={2} className="text-canvas" />
        <span className="font-serif text-[18px] font-semibold text-canvas">Healix</span>
      </div>

      <div className="max-w-[380px] animate-in fade-in slide-in-from-left-4 duration-500">
        <p className="font-serif text-[26px] leading-[1.35] text-canvas mb-6">
          Pick up your care conversation right where you left it.
        </p>

        <div className="auth-preview-card p-4">
          <p className="auth-preview-question mb-2">
            Is it normal for my resting heart rate to drop after starting the new medication?
          </p>
          <p className="text-[13px] leading-[1.6] text-ink mb-2">
            Yes — some blood pressure medications slow resting heart rate as part of how they work. A drop of 10&ndash;15 bpm is common and usually not a concern.
          </p>
          <div className="skeleton h-3 w-3/5 mb-3" />
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="source-chip">Mayo Clinic</span>
            <span className="source-chip">MedlinePlus</span>
          </div>
          <p className="disclaimer-text">
            General guidance only. Always confirm with your care provider.
          </p>
        </div>
      </div>

      <p className="text-[13px] text-canvas/60">
        Every answer traces back to a real, checkable source.
      </p>
    </div>
  );
}

/* ── Compact header shown in place of the panel below the lg breakpoint ── */
function CompactBrandHeader() {
  return (
    <div className="lg:hidden flex items-center gap-2 px-6 pt-8">
      <Activity size={18} strokeWidth={2} className="text-primary" />
      <span className="font-serif text-[16px] font-semibold text-ink">Healix</span>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDisabled = !email.trim() || !password.trim() || loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid login credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await login('demo', '');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell grid lg:grid-cols-[minmax(420px,560px)_1fr]">
      <BrandPanel />

      <div className="flex flex-col min-h-screen">
        <CompactBrandHeader />

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-right-4 duration-300">

            <h1 className="font-serif text-[28px] leading-[1.3] font-bold text-ink mb-1.5">Log in</h1>
            <p className="text-[14px] text-muted mb-6">Welcome back to Healix Intelligence.</p>

            <button
              type="button"
              className="flex items-center justify-center gap-2.5 w-full h-11 rounded-full border border-ink text-ink font-medium text-[14px] hover:bg-ink/5 transition-colors"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-4 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[13px] text-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-[13px] flex items-center gap-2 justify-center">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Email or username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 rounded-[10px] px-3.5 text-[14px] bg-canvas border border-border text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder-muted/70"
              />

              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 rounded-[10px] px-3.5 pr-11 text-[14px] bg-canvas border border-border text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder-muted/70"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="flex justify-between items-center px-1 pt-1">
                <button type="button" onClick={handleDemoLogin} className="text-[12px] font-medium text-primary hover:underline">
                  Use demo login
                </button>
                <button type="button" className="text-[12px] text-muted hover:text-ink hover:underline transition-colors">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isDisabled}
                className="w-full h-11 mt-1 rounded-full bg-ink text-surface font-semibold text-[15px] hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>
            </form>

            <div className="mt-5 text-center text-[14px] text-ink">
              New to Healix?{' '}
              <Link to="/signup" className="font-semibold text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
