import { useState } from 'react';
import {
  X, User, Activity, Monitor, Database, Plus, Trash2, Check, ShieldCheck, HeartPulse
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import IconButton from '../common/IconButton';

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

  const [activeTab, setActiveTab] = useState('general');
  const [isSaved, setIsSaved] = useState(false);

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
        <div className="w-64 bg-canvas border-r border-border flex flex-col p-4 space-y-1">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <HeartPulse className="text-primary" size={20} />
            <h2 className="text-sm font-semibold text-ink">Preferences & Profile</h2>
          </div>

          <button
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${activeTab === 'general' ? 'bg-primary/10 text-primary font-medium' : 'text-ink hover:bg-border/50'}`}
            onClick={() => setActiveTab('general')}
          >
            <User size={18} />
            <span>General</span>
          </button>

          <button
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${activeTab === 'health' ? 'bg-primary/10 text-primary font-medium' : 'text-ink hover:bg-border/50'}`}
            onClick={() => setActiveTab('health')}
          >
            <Activity size={18} />
            <span>Health Profile</span>
          </button>

          <button
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${activeTab === 'account' ? 'bg-primary/10 text-primary font-medium' : 'text-ink hover:bg-border/50'}`}
            onClick={() => setActiveTab('account')}
          >
            <Monitor size={18} />
            <span>Appearance & App</span>
          </button>

          <button
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${activeTab === 'memory' ? 'bg-primary/10 text-primary font-medium' : 'text-ink hover:bg-border/50'}`}
            onClick={() => setActiveTab('memory')}
          >
            <Database size={18} />
            <span>Memory & Sessions</span>
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
                {isSaved ? <Check size={14} /> : <ShieldCheck size={14} />}
                <span>{isSaved ? 'Saved!' : 'Save Changes'}</span>
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
                        className="w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">Preferred Name</label>
                      <input
                        type="text"
                        value={formData.preferredName}
                        onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                        className="w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">Gender / Sex</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
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
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-48 px-3 py-2 rounded-lg border border-border bg-canvas text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
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
                      className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-canvas text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                      className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-canvas text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                  <label className="block text-xs font-semibold text-ink mb-1">Current Medications & Dosages</label>
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
                      className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-canvas text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-canvas text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-canvas text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-canvas text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                      <img src="/f1.png" alt="Light theme preview" className="w-full h-24 object-cover rounded-lg border border-border mb-2 shadow-sm" />
                      <span className="text-sm font-medium text-ink">Light Mode</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 p-2 rounded-xl border-2 transition-all duration-150 ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    >
                      <img src="/f2.png" alt="Dark theme preview" className="w-full h-24 object-cover rounded-lg border border-border mb-2 shadow-sm" />
                      <span className="text-sm font-medium text-ink">Dark Mode</span>
                    </button>
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-ink mb-3 pb-2 border-b border-border">Typography & Reading Size</h4>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted">A (12px)</span>
                    <input
                      type="range"
                      min="12"
                      max="24"
                      step="1"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-base text-ink font-semibold">A ({fontSize}px)</span>
                  </div>
                </section>
              </div>
            )}

            {/* 4. MEMORY & SESSIONS TAB */}
            {activeTab === 'memory' && (
              <div className="space-y-6 max-w-xl">
                <div className="p-4 rounded-xl border border-border bg-canvas space-y-3">
                  <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <Database size={16} className="text-primary" />
                    <span>Local Database & Storage Status</span>
                  </h4>
                  <div className="text-xs space-y-1.5 text-muted">
                    <p>• Database: <span className="text-ink font-mono">SQLite (backend/data/healix.db)</span></p>
                    <p>• Vector Engine: <span className="text-ink font-mono">ChromaDB (sentence-transformers)</span></p>
                    <p>• Total Sessions Tracked: <span className="text-ink font-semibold">{conversations.length}</span></p>
                    <p>• Active Session ID: <span className="text-ink font-mono">{activeConversationId || 'None'}</span></p>
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
