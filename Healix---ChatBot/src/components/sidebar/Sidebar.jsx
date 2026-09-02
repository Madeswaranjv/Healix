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
 * Desktop sidebar behaviour (controlled via inline transition styles):
 *  CLOSE → content vanishes instantly (delay 0), width collapses to 20px (delay 0)
 *  OPEN  → width expands after 150ms delay, content fades in after 200ms delay
 *  HOVER → hovering 7px below toggle peeks sidebar; exits on mouse-leave
 */
export function Sidebar() {
  const {
    isSidebarOpen,
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

  // Sidebar is visually open if toggle-open OR hover-peeked
  const isOpen = isSidebarOpen || isHoverOpen;

  const handleNewChat = () => {
    setActiveConversation(null);
  };

  // Close must also kill hover state, otherwise hover keeps isOpen=true
  const handleToggle = () => {
    if (isSidebarOpen) setIsHoverOpen(false);
    toggleSidebar();
  };

  // ── Inline transition styles ──────────────────────────────────────
  // Using style objects instead of Tailwind classes so open/close
  // each get their own independent transition timing.

  const asideStyle = isOpen
    ? { width: '280px', transition: 'width 400ms ease-out 150ms' }
    : { width: '60px', transition: 'width 400ms ease-out 150ms' };

  const contentStyle = isOpen
    ? { opacity: 1, pointerEvents: 'auto', transition: 'opacity 200ms ease-out 500ms' }
    : { opacity: 0, pointerEvents: 'none', transition: 'opacity 80ms ease-out 100ms' };

  return (
    <aside
      onMouseLeave={() => setIsHoverOpen(false)}
      onMouseMove={(e) => {
        if (!isOpen) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (e.clientY - rect.top >= 47) {
            setIsHoverOpen(true);
          }
        }
      }}
      style={asideStyle}
      className="
        relative z-30 h-screen bg-surface flex-shrink-0 min-w-0
        hidden lg:flex flex-col
        border-r border-border
      "
      aria-label="Desktop navigation sidebar"
    >
      {/* Toggle button — centered on right border via left-full + -translate-x-1/2 */}
      <button
        onClick={handleToggle}
        className="
          absolute top-3 left-full -translate-x-1/2 z-50
          flex items-center justify-center
          w-7 h-7 rounded-full
          border border-border bg-surface
          shadow-sm cursor-pointer
          text-muted hover:text-ink hover:bg-sidebar-icon-hover
          transition-colors duration-200 ease-out
        "
        aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
      </button>

      {/* Content wrapper */}
      <div style={contentStyle} className="w-full h-full">
        <div className="flex flex-col h-full w-[280px] min-w-[280px]">

          {/* Top icon row — Menu + Search */}
          <div className="flex items-center gap-0 px-4 pt-4 pb-2">
            <div className="relative">
              <IconButton
                icon={Menu}
                label="Options"
                onClick={toggleOptions}
                active={isOptionsOpen}
                size={16}
              />
              {isOptionsOpen && (
                <OptionsMenu onClose={() => setOptionsOpen(false)} />
              )}
            </div>
            <div className="relative">
              <IconButton
                icon={Search}
                label="Search conversations"
                onClick={toggleSearch}
                active={isSearchOpen}
                size={16}
              />
              {isSearchOpen && (
                <SearchPanel onClose={() => setSearchOpen(false)} />
              )}
            </div>
          </div>

          {/* New chat button */}
          <div className="px-3 pb-3">
            <button
              onClick={handleNewChat}
              className="
                new-chat-btn
                flex items-center justify-center gap-2
                w-full py-2 rounded-lg
                text-xs font-semibold
              "
              title="Start new consultation"
            >
              <Plus size={14} />
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
          <div className="mt-auto border-t border-border p-3 overflow-visible">
            <div className="relative overflow-visible">
              <button
                onClick={isAuthenticated ? toggleProfileMenu : () => setAuthModalOpen(true)}
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-sidebar-icon-hover transition-colors duration-150 text-left"
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
        className="absolute inset-0 bg-backdrop backdrop-blur-sm backdrop-enter"
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
          <span className="text-lg font-semibold text-ink tracking-tight">Healix</span>
          <IconButton
            icon={() => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            label="Close sidebar"
            onClick={() => setMobileSidebarOpen(false)}
          />
        </div>

        {/* Top icons */}
        <div className="flex items-center gap-0 px-4 pt-3 pb-2">
          <div className="relative">
            <IconButton
              icon={Menu}
              label="Options"
              onClick={toggleOptions}
              active={isOptionsOpen}
              size={16}
            />
            {isOptionsOpen && <OptionsMenu onClose={() => setOptionsOpen(false)} />}
          </div>
          <div className="relative">
            <IconButton
              icon={Search}
              label="Search conversations"
              onClick={toggleSearch}
              active={isSearchOpen}
              size={16}
            />
            {isSearchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}
          </div>
        </div>

        {/* New chat button */}
        <div className="px-3 pb-3">
          <button
            onClick={handleNewChat}
            className="
              new-chat-btn
              flex items-center justify-center gap-2
              w-full py-2 rounded-lg
              text-xs font-semibold
            "
            title="Start new consultation"
          >
            <Plus size={14} />
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
