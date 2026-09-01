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
  const sidebarRef = useRef(null);

  // True if sidebar should visually appear open (toggled OR hover-peeked)
  const isOpen = isSidebarOpen || isHoverOpen;

  const handleMouseEnter = () => {
    setIsHoverOpen(true);
  };

  const handleMouseLeave = () => {
    setIsHoverOpen(false);
  };

  const handleNewChat = () => {
    setActiveConversation(null);
  };

  return (
    <aside
      ref={sidebarRef}
      onMouseLeave={handleMouseLeave}
      className={`
        relative z-30 h-screen bg-surface flex-shrink-0
        hidden lg:flex flex-col
        border-r border-border
        transition-all duration-300 ease-out
        ${isOpen ? 'w-[280px]' : 'w-16'}
      `}
      aria-label="Desktop navigation sidebar"
    >
      {/* Toggle button — positioned on the right edge */}
      <button
        onClick={toggleSidebar}
        className="
          absolute top-3.5 -right-3.5 z-50
          flex items-center justify-center
          w-7 h-7 rounded-full
          border border-inputborder bg-surface
          shadow-sm
          text-muted hover:text-ink hover:bg-sidebar-btn-hover active:text-ink
          hover:border-ink/50 active:border-ink focus:border-ink
          transition-colors duration-150 ease-out
        "
        aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
      </button>

      {/*
        Hover-to-peek trigger zone — only active when sidebar is collapsed.
        Starts 49px from top (5px below the 32px toggle button at top-3)
        so hovering on the toggle button or above it does NOT open the sidebar.
      */}
      {!isOpen && (
        <div
          onMouseEnter={handleMouseEnter}
          className="absolute top-[49px] bottom-0 left-0 right-0 z-20"
          aria-hidden="true"
        />
      )}

      {/* Inner wrapper: overflow-visible when open so submenus float over canvas; overflow-hidden when closed */}
      <div className={`w-full h-full ${isOpen ? 'overflow-visible' : 'overflow-hidden'} transition-opacity ${isOpen ? 'opacity-100 duration-200 delay-[300ms]' : 'opacity-0 duration-100 delay-100 pointer-events-none'}`}>
        <div className="flex flex-col h-full w-[280px] min-w-[280px]">
          {/* Top icon row — Menu + Search, left-aligned */}
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
              flex items-center justify-center gap-2
              w-full py-2 rounded-lg
              border border-primary text-primary
              text-xs font-semibold
              hover:bg-primary hover:text-white
              transition-colors duration-150 ease-out
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
