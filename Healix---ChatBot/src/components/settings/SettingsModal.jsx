import { useState, useRef, useEffect } from 'react';
import {
  X, User, Activity, Monitor, Database, Plus, Trash2, Check, ShieldCheck, HeartPulse,
  ChevronDown, ChevronUp, Search, Clock
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import IconButton from '../common/IconButton';

/* ── Shared focus class for all text inputs / textareas ── */
const INPUT_CLS =
  'w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink text-sm ' +
  'focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-0 focus:border-primary ' +
  'transition-colors duration-150';

const INPUT_SM_CLS =
  'w-full px-3 py-1.5 rounded-lg border border-border bg-canvas text-ink text-sm ' +
  'focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-0 focus:border-primary ' +
  'transition-colors duration-150';

const INPUT_XS_CLS =
  'w-full px-3 py-1.5 rounded-lg border border-border bg-canvas text-ink text-xs ' +
  'focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-0 focus:border-primary ' +
  'transition-colors duration-150';

const SEARCHABLE_SETTINGS = [
  { label: 'Full Legal Name', tab: 'general' },
  { label: 'Preferred Name', tab: 'general' },
  { label: 'Email Address', tab: 'general' },
  { label: 'Age', tab: 'general' },
  { label: 'Gender / Sex', tab: 'general' },
  { label: 'Blood Group', tab: 'health' },
  { label: 'Known Allergies', tab: 'health' },
  { label: 'Chronic Health Conditions', tab: 'health' },
  { label: 'Current Medications', tab: 'health' },
  { label: 'Emergency Contact', tab: 'health' },
  { label: 'Theme (Light/Dark)', tab: 'account' },
  { label: 'Typography & Reading Size', tab: 'account' },
  { label: 'Local Database Status', tab: 'memory' },
];

/* ── Custom flyout-style dropdown (matches ModelSelector design) ── */
function FlyoutSelect({ value, onChange, options, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink text-sm hover:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors duration-150"
      >
        <span>{value}</span>
        <ChevronDown size={14} className="text-muted flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 flyout-menu min-w-full animate-in fade-in zoom-in-95 duration-100">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className="flyout-item justify-between"
              onClick={() => { onChange(opt); setIsOpen(false); }}
            >
              <span className="truncate">{opt}</span>
              {value === opt && <Check size={13} className="text-primary flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Font-size stepper (12–18 px) ── */
const MIN_FONT = 12;
const MAX_FONT = 18;

function FontSizeStepper({ fontSize, setFontSize }) {
  const [limitMsg, setLimitMsg] = useState(null);

  const change = (delta) => {
    const next = fontSize + delta;
    if (next < MIN_FONT || next > MAX_FONT) {
      setLimitMsg(`Cannot change size beyond ${delta < 0 ? MIN_FONT : MAX_FONT}px`);
      setTimeout(() => setLimitMsg(null), 1800);
      return;
    }
    setFontSize(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {/* Decrease button */}
        <button
          type="button"
          onClick={() => change(-1)}
          className="group p-1.5 rounded border border-border hover:border-primary text-muted hover:text-primary active:bg-primary active:text-white transition-colors duration-100"
          aria-label="Decrease font size"
        >
          <ChevronDown size={15} />
        </button>

        {/* Size badge */}
        <span className="px-3 py-1 rounded border border-border bg-canvas text-ink text-sm font-mono min-w-[64px] text-center select-none">
          {fontSize}px
        </span>

        {/* Increase button */}
        <button
          type="button"
          onClick={() => change(1)}
          className="group p-1.5 rounded border border-border hover:border-primary text-muted hover:text-primary active:bg-primary active:text-white transition-colors duration-100"
          aria-label="Increase font size"
        >
          <ChevronUp size={15} />
        </button>

        <span className="text-xs text-muted">Range: {MIN_FONT}px – {MAX_FONT}px</span>
      </div>

      {/* Limit toast */}
      {limitMsg && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-alert/10 border border-alert/20 text-alert text-xs font-medium animate-in fade-in duration-150">
          {limitMsg}
        </div>
      )}
    </div>
  );
}

export default function SettingsModal() {
  const {
    isSettingsModalOpen,
    setSettingsModalOpen,
    userProfile,
    saveUserProfile,
    theme,
    setTheme,
    fontSize,
    setFontSize,
    activeConversationId,
    conversations,
  } = useStore();

  // Derived values for Memory & Sessions
  const activeConv = conversations.find(c => c.id === activeConversationId);
  let sessionDuration = "No active session";
  if (activeConv) {
    const diffMs = (activeConv.updatedAt || Date.now()) - (activeConv.createdAt || Date.now());
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    sessionDuration = mins > 0 ? `${mins} min${mins > 1 ? 's' : ''}` : "< 1 min";
  }

  // Use a mock last login time or current session start
  const lastLogin = activeConv && activeConv.createdAt 
    ? new Date(activeConv.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  const [activeTab, setActiveTab] = useState('general');
  const [isSaved, setIsSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  // Form local state
  const [formData, setFormData] = useState({
    fullName: userProfile.fullName || '',
    preferredName: userProfile.preferredName || '',
    email: userProfile.email || '',
    age: userProfile.age || '',
    gender: userProfile.gender || 'Female',
    bloodGroup: userProfile.bloodGroup || 'O+',
    allergies: Array.isArray(userProfile.allergies) ? [...userProfile.allergies] : [],
    chronicConditions: Array.isArray(userProfile.chronicConditions) ? [...userProfile.chronicConditions] : [],
    currentMedications: Array.isArray(userProfile.currentMedications) ? [...userProfile.currentMedications] : [],
    emergencyContact: {
      name: userProfile.emergencyContact?.name || '',
      phone: userProfile.emergencyContact?.phone || '',
      relation: userProfile.emergencyContact?.relation || '',
    },
  });

  // Tag inputs
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [medicationInput, setMedicationInput] = useState('');

  // Close search dropdown on outside click
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!isSettingsModalOpen) return null;

  const handleSave = async () => {
    await saveUserProfile(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const addTag = (field, value, setter) => {
    if (!value.trim()) return;
    const trimmed = value.trim();
    if (!formData[field].includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        [field]: [...prev[field], trimmed],
      }));
    }
    setter('');
  };

  const removeTag = (field, index) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-backdrop backdrop-blur-md backdrop-enter"
        onClick={() => setSettingsModalOpen(false)}
      />

      {/* Modal Card */}
      <div className="relative bg-surface rounded-xl shadow-2xl border border-border w-full max-w-4xl h-[650px] max-h-[92vh] flex overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Left Sidebar */}
        <div className="w-50 bg-canvas border-r border-border flex flex-col p-4 space-y-1">

          {/* Search Bar */}
          <div className="relative mb-3" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors duration-150"
              />
            </div>

            {/* Search Dropdown */}
            {isSearchOpen && searchQuery.trim() && (
              <div className="absolute top-full left-0 mt-1 w-full bg-surface border border-border rounded-lg shadow-md z-50 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                {SEARCHABLE_SETTINGS.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                  SEARCHABLE_SETTINGS.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase())).map((setting, idx) => (
                    <button
                      key={idx}
                      className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-sidebar-icon-hover transition-colors truncate"
                      onClick={() => {
                        setActiveTab(setting.tab);
                        setSearchQuery('');
                        setIsSearchOpen(false);
                      }}
                    >
                      {setting.label}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-muted">No results found</div>
                )}
              </div>
            )}
          </div>

          <div className="text-[11px] font-medium text-muted tracking-wider mb-2 px-1">
            Settings
          </div>

          <button
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-[13px] transition-colors duration-150 ${activeTab === 'general' ? 'bg-primary/10 text-primary font-medium' : 'text-ink hover:bg-border/50'}`}
            onClick={() => setActiveTab('general')}
          >
            <User size={17} />
            <span>General</span>
          </button>

          <button
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-[13px] transition-colors duration-150 ${activeTab === 'health' ? 'bg-primary/10 text-primary font-medium' : 'text-ink hover:bg-border/50'}`}
            onClick={() => setActiveTab('health')}
          >
            <Activity size={17} />
            <span>Health Profile</span>
          </button>

          <button
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-[13px] transition-colors duration-150 ${activeTab === 'account' ? 'bg-primary/10 text-primary font-medium' : 'text-ink hover:bg-border/50'}`}
            onClick={() => setActiveTab('account')}
          >
            <Monitor size={17} />
            <span>Appearance &amp; App</span>
          </button>

          <button
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-[13px] transition-colors duration-150 ${activeTab === 'memory' ? 'bg-primary/10 text-primary font-medium' : 'text-ink hover:bg-border/50'}`}
            onClick={() => setActiveTab('memory')}
          >
            <Database size={17} />
            <span>Memory &amp; Sessions</span>
          </button>

          <div className="mt-auto pt-4 border-t border-border">
            <div className="px-3 py-2 text-xs text-muted">
              Logged in as <span className="font-semibold text-ink">{userProfile.preferredName}</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full bg-surface min-w-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h3 className="text-lg font-semibold text-ink capitalize">
                {activeTab === 'health' ? 'Clinical Health Profile' : activeTab === 'account' ? 'Appearance & Theme' : activeTab}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                {activeTab === 'health' ? 'Personalized health background used for safe, grounded AI context' : 'Manage your personal profile and preferences'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-all duration-150 shadow-sm"
              >
                <span>{isSaved ? 'Saved!' : 'Save'}</span>
              </button>
              <IconButton icon={X} label="Close settings" onClick={() => setSettingsModalOpen(false)} />
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-6">

            {/* 1. GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="space-y-6 max-w-xl">
                <section>
                  <h4 className="text-sm font-semibold text-ink mb-4 pb-2 border-b border-border">Basic Identity</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">Full Legal Name</label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">Preferred Name</label>
                      <input
                        type="text"
                        value={formData.preferredName}
                        onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">Age</label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">Gender / Sex</label>
                      <FlyoutSelect
                        className="w-full"
                        value={formData.gender}
                        onChange={(v) => setFormData({ ...formData, gender: v })}
                        options={['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say']}
                      />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* 2. HEALTH PROFILE TAB */}
            {activeTab === 'health' && (
              <div className="space-y-6 max-w-2xl">
                {/* Notice */}
                <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-3 text-xs text-ink/80 leading-relaxed">
                  <ShieldCheck className="text-primary flex-shrink-0 mt-0.5" size={16} />
                  <span>
                    Your health properties are stored securely on your local instance and provided to the LLM as confidential background context to alert for potential contraindications and personalized care advice.
                  </span>
                </div>

                {/* Blood Group */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Blood Group</label>
                  <FlyoutSelect
                    className="w-48"
                    value={formData.bloodGroup}
                    onChange={(v) => setFormData({ ...formData, bloodGroup: v })}
                    options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']}
                  />
                </div>

                {/* Allergies Tag Input */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Known Allergies</label>
                  <p className="text-[11px] text-muted mb-2">e.g. Penicillin, Peanuts, Sulfa drugs, Latex</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formData.allergies.map((allergy, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-alert/10 text-alert text-xs font-medium border border-alert/20"
                      >
                        {allergy}
                        <button onClick={() => removeTag('allergies', idx)} className="hover:text-alert/80">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add an allergy and press Enter"
                      value={allergyInput}
                      onChange={(e) => setAllergyInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('allergies', allergyInput, setAllergyInput))}
                      className={INPUT_SM_CLS.replace('w-full', 'flex-1')}
                    />
                    <button
                      onClick={() => addTag('allergies', allergyInput, setAllergyInput)}
                      className="px-3 py-1.5 bg-canvas border border-border rounded-lg text-xs font-medium hover:bg-border/40 text-ink flex items-center gap-1"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>

                {/* Chronic Conditions */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Chronic Health Conditions</label>
                  <p className="text-[11px] text-muted mb-2">e.g. Hypertension, Type 2 Diabetes, Asthma, Hypothyroidism</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formData.chronicConditions.map((cond, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                      >
                        {cond}
                        <button onClick={() => removeTag('chronicConditions', idx)} className="hover:text-primary/80">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a condition and press Enter"
                      value={conditionInput}
                      onChange={(e) => setConditionInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('chronicConditions', conditionInput, setConditionInput))}
                      className={INPUT_SM_CLS.replace('w-full', 'flex-1')}
                    />
                    <button
                      onClick={() => addTag('chronicConditions', conditionInput, setConditionInput)}
                      className="px-3 py-1.5 bg-canvas border border-border rounded-lg text-xs font-medium hover:bg-border/40 text-ink flex items-center gap-1"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>

                {/* Current Medications */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Current Medications &amp; Dosages</label>
                  <p className="text-[11px] text-muted mb-2">e.g. Lisinopril 10mg daily, Metformin 500mg, Vitamin D3</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formData.currentMedications.map((med, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-soft text-ink text-xs font-medium border border-border"
                      >
                        {med}
                        <button onClick={() => removeTag('currentMedications', idx)} className="hover:text-ink/60">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a medication and press Enter"
                      value={medicationInput}
                      onChange={(e) => setMedicationInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('currentMedications', medicationInput, setMedicationInput))}
                      className={INPUT_SM_CLS.replace('w-full', 'flex-1')}
                    />
                    <button
                      onClick={() => addTag('currentMedications', medicationInput, setMedicationInput)}
                      className="px-3 py-1.5 bg-canvas border border-border rounded-lg text-xs font-medium hover:bg-border/40 text-ink flex items-center gap-1"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="pt-2 border-t border-border">
                  <h4 className="text-xs font-semibold text-ink mb-3">Emergency Contact Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-muted mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={formData.emergencyContact.name}
                        onChange={(e) => setFormData({
                          ...formData,
                          emergencyContact: { ...formData.emergencyContact, name: e.target.value }
                        })}
                        className={INPUT_XS_CLS}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={formData.emergencyContact.phone}
                        onChange={(e) => setFormData({
                          ...formData,
                          emergencyContact: { ...formData.emergencyContact, phone: e.target.value }
                        })}
                        className={INPUT_XS_CLS}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted mb-1">Relationship</label>
                      <input
                        type="text"
                        value={formData.emergencyContact.relation}
                        onChange={(e) => setFormData({
                          ...formData,
                          emergencyContact: { ...formData.emergencyContact, relation: e.target.value }
                        })}
                        className={INPUT_XS_CLS}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. APPEARANCE TAB */}
            {activeTab === 'account' && (
              <div className="space-y-6 max-w-xl">
                <section>
                  <h4 className="text-sm font-semibold text-ink mb-4 pb-2 border-b border-border">Theme</h4>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 p-2 rounded-xl border-2 transition-all duration-150 ${theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    >
                      <div className="relative w-full h-24 rounded-lg mb-2 shadow-sm overflow-hidden border border-border flex items-center justify-center p-[2px]">
                        <img src="/woodbg.jpeg" alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <img src="/f1.png" alt="Light theme preview" className="relative w-full h-full object-cover rounded-lg shadow-sm border border-black/10" />
                      </div>
                      <span className="text-sm font-medium text-ink">Light Mode</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 p-2 rounded-xl border-2 transition-all duration-150 ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    >
                      <div className="relative w-full h-24 rounded-lg mb-2 shadow-sm overflow-hidden border border-border flex items-center justify-center p-[2px]">
                        <img src="/woodbg.jpeg" alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <img src="/f2.png" alt="Dark theme preview" className="relative w-full h-full object-cover rounded-lg shadow-sm border border-white/10" />
                      </div>
                      <span className="text-sm font-medium text-ink">Dark Mode</span>
                    </button>
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-ink mb-3 pb-2 border-b border-border">Typography &amp; Reading Size</h4>
                  <FontSizeStepper fontSize={fontSize} setFontSize={setFontSize} />
                </section>
              </div>
            )}

            {/* 4. MEMORY & SESSIONS TAB */}
            {activeTab === 'memory' && (
              <div className="space-y-6 max-w-xl">
                <div className="p-5 rounded-xl border border-border bg-canvas space-y-4">
                  <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <Clock size={16} className="text-primary" />
                    <span>Session Information</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-surface rounded-lg border border-border shadow-sm">
                      <div className="text-[11px] text-muted mb-1 font-medium uppercase tracking-wider">Last Login</div>
                      <div className="text-sm font-semibold text-ink">{lastLogin}</div>
                    </div>
                    <div className="p-3 bg-surface rounded-lg border border-border shadow-sm">
                      <div className="text-[11px] text-muted mb-1 font-medium uppercase tracking-wider">Current Session Duration</div>
                      <div className="text-sm font-semibold text-ink">{sessionDuration}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
