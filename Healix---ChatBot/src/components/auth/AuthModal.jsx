import { useState, useEffect } from 'react';
import { X, AlertCircle, Eye, EyeOff, Activity } from 'lucide-react';
import { useStore } from '../../store/useStore';

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

/* ── Password Strength Calculator ── */
function getPasswordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(4, score);
}

/* ══════════════════════════════════════════════════════
   LOGIN VIEW
   ══════════════════════════════════════════════════════ */
function LoginView({ switchView }) {
  const { login } = useStore();
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
    } catch (err) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="font-serif text-[28px] leading-[1.3] font-bold text-ink text-center mb-1.5">Log In</h2>
      <p className="text-[14px] text-center text-muted mb-5">Welcome back to Healix Intelligence.</p>

      {/* Google OAuth */}
      <button 
        type="button" 
        className="flex items-center justify-center gap-2.5 w-full h-11 rounded-full border border-ink text-ink font-medium text-[14px] hover:bg-ink/5 transition-colors"
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </button>

      {/* OR Divider */}
      <div className="flex items-center gap-4 my-4">
        <div className="flex-1 h-px bg-border"></div>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">OR</span>
        <div className="flex-1 h-px bg-border"></div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2 text-center justify-center">
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Email or username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 rounded-[10px] px-3.5 text-[14px] bg-canvas border border-border text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder-muted/70"
          />
        </div>

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
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="flex justify-between items-center px-1 pt-1">
          <button type="button" onClick={handleDemoLogin} className="text-[12px] font-medium text-primary hover:underline">
            Use Demo Login
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
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <div className="mt-4 text-center text-[14px] text-ink">
        New to Healix?{' '}
        <button
          type="button"
          onClick={() => switchView('signup')}
          className="font-semibold text-primary hover:underline"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SIGNUP VIEW
   ══════════════════════════════════════════════════════ */
function SignupView({ switchView }) {
  const { register } = useStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  
  const [confirmPwError, setConfirmPwError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Clinical Details
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [showClinical, setShowClinical] = useState(false);

  const passwordStrength = getPasswordStrength(password);
  
  const isFormValid = 
    fullName.trim() && 
    email.trim() && 
    password.trim() && 
    confirmPw.trim() && 
    confirmPw === password && 
    !loading;

  const handleConfirmBlur = () => {
    if (confirmPw && confirmPw !== password) {
      setConfirmPwError('Passwords do not match');
    } else {
      setConfirmPwError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (confirmPw !== password) {
      setConfirmPwError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const payload = {
        full_name: fullName.trim(),
        preferred_name: fullName.trim().split(' ')[0],
        email: email.trim(),
        password: password,
        age: age ? parseInt(age, 10) : null,
        gender: gender,
        blood_group: bloodGroup,
        allergies: allergies ? allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
        chronic_conditions: conditions ? conditions.split(',').map(s => s.trim()).filter(Boolean) : [],
      };
      await register(payload);
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
      <h2 className="font-serif text-[28px] leading-[1.3] font-bold text-ink text-center mb-1.5">Sign Up</h2>
      <p className="text-[14px] text-center text-muted mb-5">Join our personalized healthcare platform.</p>

      {/* Google OAuth */}
      <button 
        type="button" 
        className="flex items-center justify-center gap-2.5 w-full h-11 rounded-full border border-ink text-ink font-medium text-[14px] hover:bg-ink/5 transition-colors"
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </button>

      {/* OR Divider */}
      <div className="flex items-center gap-4 my-4">
        <div className="flex-1 h-px bg-border"></div>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">OR</span>
        <div className="flex-1 h-px bg-border"></div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-[13px] flex items-center justify-center gap-2 text-center">
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type="text"
            required
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full h-11 rounded-[10px] px-3.5 text-[14px] bg-canvas border border-border text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder-muted/70"
          />
        </div>

        <div className="relative">
          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 rounded-[10px] px-3.5 text-[14px] bg-canvas border border-border text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder-muted/70"
          />
        </div>

        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            required
            placeholder="Create a password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (confirmPwError) setConfirmPwError('');
            }}
            className="w-full h-11 rounded-[10px] px-3.5 pr-11 text-[14px] bg-canvas border border-border text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder-muted/70"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            onClick={() => setShowPw(!showPw)}
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Password Strength Bar */}
        {password.length > 0 && (
          <div className="flex gap-1 h-1">
            {[1, 2, 3, 4].map(seg => {
              let bgClass = 'bg-border';
              if (seg <= passwordStrength) {
                if (passwordStrength === 1) bgClass = 'bg-red-500';
                else if (passwordStrength === 2) bgClass = 'bg-amber-500';
                else if (passwordStrength === 3) bgClass = 'bg-yellow-500';
                else bgClass = 'bg-primary';
              }
              return (
                <div key={seg} className={`flex-1 rounded-[2px] transition-colors duration-200 ${bgClass}`} />
              );
            })}
          </div>
        )}

        <div className="relative">
          <input
            type={showConfirmPw ? 'text' : 'password'}
            required
            placeholder="Confirm password"
            value={confirmPw}
            onBlur={handleConfirmBlur}
            onChange={(e) => {
              setConfirmPw(e.target.value);
              if (confirmPwError) setConfirmPwError('');
            }}
            className={`w-full h-11 rounded-[10px] px-3.5 pr-11 text-[14px] bg-canvas border text-ink focus:outline-none transition-all placeholder-muted/70 ${confirmPwError ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'}`}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            onClick={() => setShowConfirmPw(!showConfirmPw)}
          >
            {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {confirmPwError && (
          <p className="text-[12px] text-red-500 mt-1">{confirmPwError}</p>
        )}

        {/* Clinical Attributes (Optional) */}
        <div className="pt-2">
          <button type="button" onClick={() => setShowClinical(!showClinical)} className="flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-wider mb-2">
            <Activity size={12} />
            <span>Clinical Profile (Optional) {showClinical ? '-' : '+'}</span>
          </button>
          
          {showClinical && (
            <div className="space-y-3 animate-in slide-in-from-top-2 fade-in duration-200 border-l-2 border-primary/30 pl-3 ml-1 mb-2">
              <div className="grid grid-cols-3 gap-2">
                <input type="number" placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} className="w-full h-9 rounded-lg px-2.5 text-xs bg-canvas border border-border text-ink focus:outline-none focus:border-primary" />
                <input type="text" placeholder="Gender" value={gender} onChange={(e) => setGender(e.target.value)} className="w-full h-9 rounded-lg px-2.5 text-xs bg-canvas border border-border text-ink focus:outline-none focus:border-primary" />
                <input type="text" placeholder="Blood" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="w-full h-9 rounded-lg px-2.5 text-xs bg-canvas border border-border text-ink focus:outline-none focus:border-primary" />
              </div>
              <input type="text" placeholder="Allergies (comma separated)" value={allergies} onChange={(e) => setAllergies(e.target.value)} className="w-full h-9 rounded-lg px-2.5 text-xs bg-canvas border border-border text-ink focus:outline-none focus:border-primary" />
              <input type="text" placeholder="Conditions (comma separated)" value={conditions} onChange={(e) => setConditions(e.target.value)} className="w-full h-9 rounded-lg px-2.5 text-xs bg-canvas border border-border text-ink focus:outline-none focus:border-primary" />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!isFormValid}
          className="w-full h-11 mt-3 rounded-full bg-ink text-surface font-semibold text-[15px] hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      
      <p className="text-center text-[12px] text-muted mt-4">
        By continuing, you agree to our{' '}
        <button type="button" className="font-medium text-ink hover:underline">Terms</button>
        {' '}and{' '}
        <button type="button" className="font-medium text-ink hover:underline">Privacy Policy</button>.
      </p>

      <div className="mt-4 text-center text-[14px] text-ink">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => switchView('login')}
          className="font-semibold text-primary hover:underline"
        >
          Log In
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   AUTH MODAL (Main Export)
   ══════════════════════════════════════════════════════ */
export default function AuthModal() {
  const { isAuthModalOpen, setAuthModalOpen } = useStore();
  const [view, setView] = useState('login'); // 'login' | 'signup'

  // Reset to login view when opened
  useEffect(() => {
    if (isAuthModalOpen) setView('login');
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-[400px] bg-surface rounded-2xl shadow-2xl border border-border px-8 py-7 overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-ink/70 hover:text-ink hover:bg-border/50 transition-colors z-10"
          aria-label="Close"
        >
          <X size={20} strokeWidth={2.5} />
        </button>

        {view === 'login' ? (
          <LoginView switchView={setView} />
        ) : (
          <SignupView switchView={setView} />
        )}
      </div>
    </div>
  );
}
