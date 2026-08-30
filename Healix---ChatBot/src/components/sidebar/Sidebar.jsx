import { useState, useRef, useEffect } from 'react';
import {
  Menu, Search, Plus, PanelLeftClose, PanelLeft
} from 'lucide-react';
import IconButton from '../common/IconButton';
import OptionsMenu from './OptionsMenu';
import SearchPanel from './SearchPanel';
import ChatList from './ChatList';
import ProfileMenu from './ProfileMenu';
import { useStore } from '../../store/useStore';

/**
 * Desktop sidebar:
 * - 280px expanded, 0px fully closed when collapsed (nothing visible except floating border toggle button)
 * - Sidebar controlling icon sits directly on the boundary line of the sidebar
 */
export function Sidebar() {
  const {
    isSidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    isSearchOpen,
    toggleSearch,
    isOptionsOpen,
    toggleOptions,
    setOptionsOpen,
    setSearchOpen,
    setActiveConversation,
    isProfileMenuOpen,
    toggleProfileMenu,
    userProfile,
    isAuthenticated,
    setAuthModalOpen,
  } = useStore();

  const [isHoverOpen, setIsHoverOpen] = useState(false);
  const hoverTimeoutRef = useRef(null);

  // True if sidebar is either toggled open OR currently peeked via hover
  const isOpen = isSidebarOpen || isHoverOpen;

  const handleMouseEnter = () => {
    if (!isSidebarOpen) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHoverOpen(true);
      }, 350); // 350ms hover delay
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (!isSidebarOpen) {
      setIsHoverOpen(false);
    }
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (isOpen) {
      if (isHoverOpen && !isSidebarOpen) {
        // While hovering, pressing the sidebar icon locks it to STAY visible!
        setSidebarOpen(true);
        setIsHoverOpen(false);
      } else {
        // Collapses permanently
        setSidebarOpen(false);
        setIsHoverOpen(false);
      }
    } else {
      setSidebarOpen(true);
      setIsHoverOpen(false);
    }
  };

  const handleNewChat = () => {
    setActiveConversation(null);
  };

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        hidden lg:flex flex-col flex-shrink-0
        bg-surface transition-all duration-350 ease-in-out
        relative select-none h-full z-30
        ${isOpen ? 'w-[280px] border-r border-border' : 'w-0 border-r-0'}
      `}
      aria-label="Desktop navigation sidebar"
    >
      {/* Hover Peek trigger zone along left edge when closed */}
      {!isSidebarOpen && (
        <div
          onMouseEnter={handleMouseEnter}
          className="absolute top-14 bottom-0 -right-6 w-8 z-40 cursor-pointer"
          aria-hidden="true"
        />
      )}

      {/* Sidebar controlling toggle button — permanently anchored to boundary edge */}
      <button
        onClick={handleToggleClick}
        className="
          absolute top-5 -right-4 z-50
          flex items-center justify-center
          w-8 h-8 rounded-full
          border border-border bg-surface
          shadow-sm cursor-pointer
          text-muted hover:text-primary hover:bg-accent-soft
          hover:border-primary active:border-primary focus:border-primary
          transition-colors duration-150 ease-out
        "
        aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
      </button>

      {/* Inner wrapper: overflow-visible when open so submenus float over canvas; overflow-hidden when closed */}
      <div className={`w-full h-full ${isOpen ? 'overflow-visible' : 'overflow-hidden'} transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex flex-col h-full w-[280px] min-w-[280px]">
          {/* Top Header */}
          <div className="flex items-center justify-between p-3.5 pb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex-shrink-0 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Healix Logo"
                  className="w-6 h-6 object-contain"
                />
              </div>
              <span className="text-lg font-bold text-ink tracking-tight truncate">
                Healix
              </span>
            </div>

            {/* Header Action Icons */}
            <div className="flex items-center gap-0.5 pr-2">
              <div className="relative">
                <IconButton
                  icon={Search}
                  label="Search conversations"
                  onClick={toggleSearch}
                  active={isSearchOpen}
                />
                {isSearchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}
              </div>

              <div className="relative">
                <IconButton
                  icon={Menu}
                  label="Options"
                  onClick={toggleOptions}
                  active={isOptionsOpen}
                />
                {isOptionsOpen && <OptionsMenu onClose={() => setOptionsOpen(false)} />}
              </div>
            </div>
          </div>

          {/* New chat button */}
          <div className="px-3 pb-3">
            <button
              onClick={handleNewChat}
              className="
                flex items-center justify-center gap-2
                w-full py-2 rounded-lg
                border border-primary text-primary
                text-xs font-semibold
                hover:bg-primary hover:text-white
                transition-colors duration-150 ease-out
              "
              title="Start new consultation"
            >
              <Plus size={16} />
              <span>New chat</span>
            </button>
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-border" />

          {/* Chats list */}
          <div className="flex-1 flex flex-col min-h-0">
            <ChatList />
          </div>

          {/* Profile / Auth Section */}
          <div className="mt-auto border-t border-border p-3">
            <div className="relative">
              <button
                onClick={isAuthenticated ? toggleProfileMenu : () => setAuthModalOpen(true)}
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-sidebar-btn-hover transition-colors duration-150 text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-xs flex-shrink-0 shadow-xs">
                  {userProfile?.preferredName ? userProfile.preferredName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-ink truncate">
                    {userProfile?.fullName || 'Patient Profile'}
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    {isAuthenticated ? 'Settings & Profile' : 'Click to Sign In'}
                  </div>
                </div>
              </button>
              {isProfileMenuOpen && <ProfileMenu />}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * Mobile sidebar drawer — overlay below 768px.
 */
export function MobileSidebarDrawer() {
  const {
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    isOptionsOpen,
    toggleOptions,
    setOptionsOpen,
    isSearchOpen,
    toggleSearch,
    setSearchOpen,
    setActiveConversation,
    isProfileMenuOpen,
    toggleProfileMenu,
    userProfile,
    isAuthenticated,
    setAuthModalOpen,
  } = useStore();

  const handleNewChat = () => {
    setActiveConversation(null);
    setMobileSidebarOpen(false);
  };

  if (!isMobileSidebarOpen) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm backdrop-enter"
        onClick={() => setMobileSidebarOpen(false)}
      />

      {/* Drawer */}
      <aside className="
        absolute left-0 top-0 bottom-0
        w-[300px] bg-surface
        border-r border-border
        shadow-sm
        drawer-enter
        flex flex-col
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Healix" className="w-6 h-6 object-contain" />
            <span className="text-lg font-semibold text-ink tracking-tight">Healix</span>
          </div>
          <IconButton
            icon={() => (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            label="Close sidebar"
            onClick={() => setMobileSidebarOpen(false)}
          />
        </div>

        {/* Top icons */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-2">
          <div className="relative">
            <IconButton
              icon={Menu}
              label="Options"
              onClick={toggleOptions}
              active={isOptionsOpen}
            />
            {isOptionsOpen && <OptionsMenu onClose={() => setOptionsOpen(false)} />}
          </div>
          <div className="relative">
            <IconButton
              icon={Search}
              label="Search conversations"
              onClick={toggleSearch}
              active={isSearchOpen}
            />
            {isSearchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}
          </div>
        </div>

        {/* New chat button */}
        <div className="px-4 pb-3">
          <button
            onClick={handleNewChat}
            className="
              flex items-center justify-center gap-2
              w-full py-2.5 rounded-lg
              border border-primary text-primary
              text-sm font-medium
              hover:bg-primary hover:text-white
              transition-colors duration-150 ease-out
            "
          >
            <Plus size={18} />
            <span>New chat</span>
          </button>
        </div>

        <div className="mx-4 border-t border-border" />

        {/* Chats list */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatList onNavigate={() => setMobileSidebarOpen(false)} />
        </div>

        {/* Profile Section */}
        <div className="mt-auto border-t border-border p-3">
          <div className="relative">
            <button
              onClick={isAuthenticated ? toggleProfileMenu : () => { setAuthModalOpen(true); setMobileSidebarOpen(false); }}
              className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-sidebar-btn-hover transition-colors duration-150 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-sm">
                {userProfile?.preferredName ? userProfile.preferredName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink truncate">{userProfile?.fullName || 'Patient Profile'}</div>
                <div className="text-xs text-muted truncate">{isAuthenticated ? 'Settings & Profile' : 'Click to Sign In'}</div>
              </div>
            </button>
            {isProfileMenuOpen && <ProfileMenu />}
          </div>
        </div>
      </aside>
    </div>
  );
}
