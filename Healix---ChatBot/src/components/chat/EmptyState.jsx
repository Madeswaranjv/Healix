/**
 * Empty / welcome state — centered on the canvas when no messages.
 * "Healix" wordmark + calm subtitle + suggested-prompt chips.
 * No stethoscope, no heartbeat icons, no emoji — per §9.
 */
import { useStore } from '../../store/useStore';

export default function EmptyState({ onPromptSelect }) {
  const { userProfile, theme } = useStore();
  
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';

  return (
    <div className="text-center max-w-lg mx-auto">
      {/* Logo */}
      <div className="flex justify-center mb-5">
        <img
          src={theme === 'dark' ? '/logo_dark.png' : '/logo.png'}
          alt="Healix Logo"
          className="w-12 h-12 object-contain animate-in fade-in zoom-in-90 duration-300"
        />
      </div>

      {/* Greeting */}
      <h1 className="text-4xl font-semibold text-ink tracking-tight mb-3">
        {greeting}, {userProfile?.preferredName || 'there'}
      </h1>

      {/* Subtitle */}
      <p className="text-muted text-base mb-2">
        Ask about symptoms, medications, or general health information.
      </p>
    </div>
  );
}
