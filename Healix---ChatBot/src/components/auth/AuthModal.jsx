import { useState } from 'react';
import { X, Lock, Mail, User, Heart, Shield, Sparkles, ArrowRight, Activity, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';

export default function AuthModal() {
  const { isAuthModalOpen, setAuthModalOpen, login, register } = useStore();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regPreferredName, setRegPreferredName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState('');
  const [regBloodGroup, setRegBloodGroup] = useState('');
  const [regAllergies, setRegAllergies] = useState('');
  const [regConditions, setRegConditions] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setError('Please enter your email or username.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(loginEmail.trim(), loginPassword);
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

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regEmail.trim() || !regPassword.trim() || !regFullName.trim()) {
      setError('Full Name, Email, and Password are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        full_name: regFullName.trim(),
        preferred_name: regPreferredName.trim() || regFullName.trim().split(' ')[0],
        email: regEmail.trim(),
        password: regPassword,
        age: regAge ? parseInt(regAge, 10) : null,
        gender: regGender,
        blood_group: regBloodGroup,
        allergies: regAllergies ? regAllergies.split(',').map(s => s.trim()).filter(Boolean) : [],
        chronic_conditions: regConditions ? regConditions.split(',').map(s => s.trim()).filter(Boolean) : [],
      };
      await register(payload);
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-backdrop/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-surface border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header Banner */}
        <div className="bg-canvas border-b border-border/70 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <img src="/logo.png" alt="Healix" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink tracking-tight flex items-center gap-1.5">
                <span>Healix Patient Portal</span>
                <Shield size={14} className="text-primary" />
              </h2>
              <p className="text-xs text-muted">Secure, personalized health intelligence</p>
            </div>
          </div>

          <button
            onClick={() => setAuthModalOpen(false)}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/40 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border bg-surface px-6 pt-3">
          <button
            onClick={() => { setTab('login'); setError(''); }}
            className={`
              flex-1 pb-3 text-sm font-semibold border-b-2 transition-all duration-150
              ${tab === 'login'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-ink'
              }
            `}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('register'); setError(''); }}
            className={`
              flex-1 pb-3 text-sm font-semibold border-b-2 transition-all duration-150
              ${tab === 'register'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-ink'
              }
            `}
          >
            Create Patient Account
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Email or Account ID</label>
                <div className="relative flex items-center">
                  <Mail size={15} className="absolute left-3 text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. jane.doe@healix.ai or demo"
                    className="w-full pl-9 pr-3 py-2 text-sm text-ink bg-canvas border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Password</label>
                <div className="relative flex items-center">
                  <Lock size={15} className="absolute left-3 text-muted pointer-events-none" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password (optional for demo)"
                    className="w-full pl-9 pr-3 py-2 text-sm text-ink bg-canvas border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
                <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Alexander Vance"
                    className="w-full px-3 py-2 text-xs text-ink bg-canvas border border-border rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Preferred Name</label>
                  <input
                    type="text"
                    value={regPreferredName}
                    onChange={(e) => setRegPreferredName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full px-3 py-2 text-xs text-ink bg-canvas border border-border rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="alex.vance@example.com"
                  className="w-full px-3 py-2 text-xs text-ink bg-canvas border border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create secure password"
                  className="w-full px-3 py-2 text-xs text-ink bg-canvas border border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              {/* Clinical Attributes for Safety Grounding */}
              <div className="pt-2 border-t border-border/70">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity size={12} className="text-primary" />
                  <span>Clinical Safety Profile (Optional)</span>
                </p>

                <div className="grid grid-cols-3 gap-2 mb-2.5">
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Age</label>
                    <input
                      type="number"
                      value={regAge}
                      onChange={(e) => setRegAge(e.target.value)}
                      placeholder="e.g. 45"
                      className="w-full px-2.5 py-1.5 text-xs text-ink bg-canvas border border-border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Gender</label>
                    <input
                      type="text"
                      value={regGender}
                      onChange={(e) => setRegGender(e.target.value)}
                      placeholder="e.g. Male"
                      className="w-full px-2.5 py-1.5 text-xs text-ink bg-canvas border border-border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Blood Group</label>
                    <input
                      type="text"
                      value={regBloodGroup}
                      onChange={(e) => setRegBloodGroup(e.target.value)}
                      placeholder="e.g. A+"
                      className="w-full px-2.5 py-1.5 text-xs text-ink bg-canvas border border-border rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Known Allergies (comma separated)</label>
                    <input
                      type="text"
                      value={regAllergies}
                      onChange={(e) => setRegAllergies(e.target.value)}
                      placeholder="e.g. Penicillin, Peanuts"
                      className="w-full px-2.5 py-1.5 text-xs text-ink bg-canvas border border-border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Chronic Conditions (comma separated)</label>
                    <input
                      type="text"
                      value={regConditions}
                      onChange={(e) => setRegConditions(e.target.value)}
                      placeholder="e.g. Asthma, Hypertension"
                      className="w-full px-2.5 py-1.5 text-xs text-ink bg-canvas border border-border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-2.5 px-4 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Complete Registration'}
                <ArrowRight size={15} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
