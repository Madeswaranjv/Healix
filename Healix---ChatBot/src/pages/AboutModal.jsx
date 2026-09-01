import Modal from '../components/common/Modal';
import { useStore } from '../store/useStore';

/**
 * About Healix — modal, opened from Help menu.
 * Short, plain-language description of what Healix is and isn't,
 * version number, privacy link, support contact.
 */
export default function AboutModal() {
  const { isAboutOpen, setAboutOpen, theme } = useStore();

  return (
    <Modal
      isOpen={isAboutOpen}
      onClose={() => setAboutOpen(false)}
      title="About Healix"
    >
      <div className="space-y-4">
        {/* Header with logo */}
        <div className="flex items-center gap-3 pb-2 border-b border-border">
          <img src={theme === 'dark' ? '/logo_dark.png' : '/logo.png'} alt="Healix Logo" className="w-10 h-10 object-contain flex-shrink-0" />
          <div>
            <h4 className="text-base font-bold text-ink">Healix AI</h4>
            <p className="text-xs text-muted">Healthcare Intelligence Platform</p>
          </div>
        </div>

        {/* What it is */}
        <div>
          <h3 className="text-sm font-semibold text-ink mb-1">What Healix is</h3>
          <p className="text-sm text-muted leading-relaxed">
            Healix is a general-purpose health information assistant. It can help you
            understand medical terms, lab results, medication interactions, and
            prepare questions for your healthcare provider.
          </p>
        </div>

        {/* What it is not */}
        <div>
          <h3 className="text-sm font-semibold text-ink mb-1">What Healix is not</h3>
          <p className="text-sm text-muted leading-relaxed">
            Healix is not a doctor, nurse, or licensed medical professional.
            It does not diagnose conditions, prescribe treatments, or replace
            professional medical advice. Always consult a qualified healthcare
            provider for medical decisions.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Details */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Version</span>
            <span className="text-sm font-mono text-ink">1.0.0</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Privacy</span>
            <a
              href="#"
              className="text-sm text-primary hover:text-primary-hover transition-colors duration-150"
            >
              Privacy policy
            </a>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Support</span>
            <a
              href="mailto:support@healix.health"
              className="text-sm text-primary hover:text-primary-hover transition-colors duration-150"
            >
              support@healix.health
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
}
