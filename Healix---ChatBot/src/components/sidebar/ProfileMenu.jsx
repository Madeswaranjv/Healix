import { useRef, useEffect } from 'react';
import { Settings, Languages, HelpCircle, Info, LogOut, Users, Shield, UserCheck } from 'lucide-react';
import { useStore } from '../../store/useStore';

export default function ProfileMenu() {
  const {
    isProfileMenuOpen,
    setProfileMenuOpen,
    setProfileOpen,
    setAboutOpen,
    setAuthModalOpen,
    logout,
    userProfile,
    allUsers,
    switchUser,
  } = useStore();

  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen, setProfileMenuOpen]);

  if (!isProfileMenuOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-16 left-3 w-64 flyout-menu py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 shadow-xl border border-border/80"
    >
      {/* Active User Header info */}
      <div className="px-3.5 py-2 border-b border-border/70 mb-1">
        <p className="text-xs font-bold text-ink truncate">{userProfile?.fullName || 'Active Patient'}</p>
        <p className="text-[11px] text-muted truncate">{userProfile?.email || 'Logged in user'}</p>
      </div>

      <button
        className="flyout-item"
        onClick={() => {
          setProfileOpen(true);
          setProfileMenuOpen(false);
        }}
      >
        <Settings size={15} />
        <span>Clinical Profile & Settings</span>
      </button>

      <button className="flyout-item" onClick={() => setProfileMenuOpen(false)}>
        <Languages size={15} />
        <span>Language</span>
      </button>
      
      <div className="h-px bg-border my-1" />
      
      <button
        className="flyout-item"
        onClick={() => {
          setAboutOpen(true);
          setProfileMenuOpen(false);
        }}
      >
        <Info size={15} />
        <span>About Healix</span>
      </button>
      
      <div className="h-px bg-border my-1" />
      
      {/* Real Logout button */}
      <button
        className="flyout-item text-alert hover:bg-sidebar-danger-hover transition-colors font-medium"
        onClick={async () => {
          setProfileMenuOpen(false);
          await logout();
        }}
      >
        <LogOut size={15} />
        <span>Log Out</span>
      </button>
    </div>
  );
}
