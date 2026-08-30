/**
 * Medical disclaimer strip — always visible, never dismissible.
 * IBM Plex Serif italic, muted color, small size.
 * "A user should never be able to make it go away." — §5
 */
export default function DisclaimerStrip() {
  return (
    <div className="mt-3 text-center" role="contentinfo" aria-label="Medical disclaimer">
      <p className="disclaimer-text">
        Healix offers general health information, not medical advice. In an emergency, contact your local emergency number immediately.
      </p>
    </div>
  );
}
