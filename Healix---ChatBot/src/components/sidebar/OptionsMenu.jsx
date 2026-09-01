import { useState, useEffect, useRef } from 'react';
import {
  FilePlus, FileDown, LogOut,
  Pencil, RefreshCw, Trash2, Copy,
  Maximize, Minus, Plus, RotateCcw, MonitorUp,
  HelpCircle, Info, Keyboard,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

/**
 * Options flyout menu with 4 top-level sections,
 * each expanding a submenu to its right on hover.
 * Matches the native-app cascade pattern from §4.
 */

const menuSections = [
  {
    label: 'File',
    items: [
      { icon: FilePlus, label: 'New chat', action: 'newChat', shortcut: 'Ctrl+N' },
      { icon: FileDown, label: 'Export conversation', action: 'export' },
      { icon: LogOut, label: 'Close window', action: 'closeWindow', shortcut: 'Ctrl+W' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { icon: Pencil, label: 'Edit last message', action: 'editLast' },
      { icon: RefreshCw, label: 'Regenerate response', action: 'regenerate' },
      { icon: Trash2, label: 'Clear conversation', action: 'clearConversation' },
      { icon: Copy, label: 'Copy conversation', action: 'copyConversation' },
    ],
  },
  {
    label: 'View',
    items: [
      { icon: Plus, label: 'Increase text size', action: 'fontIncrease', shortcut: 'Ctrl+=' },
      { icon: Minus, label: 'Decrease text size', action: 'fontDecrease', shortcut: 'Ctrl+-' },
      { icon: RotateCcw, label: 'Reset text size', action: 'fontReset' },
      { icon: Maximize, label: 'Toggle full screen', action: 'fullscreen', shortcut: 'F11' },
      { icon: MonitorUp, label: 'Refresh conversation', action: 'refresh' },
    ],
  },
  {
    label: 'Help',
    items: [
      { icon: HelpCircle, label: 'Get support', action: 'support' },
      { icon: Info, label: 'About Healix', action: 'about' },
      { icon: Keyboard, label: 'Keyboard shortcuts', action: 'shortcuts' },
    ],
  },
];

export default function OptionsMenu({ onClose }) {
  const [activeSection, setActiveSection] = useState(null);
  const menuRef = useRef(null);
  const closeTimer = useRef(null);
  const { increaseFontSize, decreaseFontSize, resetFontSize, toggleFullScreen, setAboutOpen, addConversation, setActiveConversation } = useStore();

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setActiveSection(null);
    }, 300);
  };

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleAction = (action) => {
    switch (action) {
      case 'newChat': {
        const newConv = {
          id: `conv-${Date.now()}`,
          title: 'New conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
        };
        addConversation(newConv);
        setActiveConversation(newConv.id);
        break;
      }
      case 'fontIncrease':
        increaseFontSize();
        break;
      case 'fontDecrease':
        decreaseFontSize();
        break;
      case 'fontReset':
        resetFontSize();
        break;
      case 'fullscreen':
        toggleFullScreen();
        break;
      case 'about':
        setAboutOpen(true);
        break;
      // TODO(backend): Implement export, clear, copy, support, shortcuts
      default:
        break;
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="absolute top-full left-0 mt-1 z-50 flyout-menu"
      role="menu"
      aria-label="Application menu"
    >
      {menuSections.map((section) => (
        <div
          key={section.label}
          className="relative"
          onMouseEnter={() => { cancelClose(); setActiveSection(section.label); }}
          onMouseLeave={scheduleClose}
        >
          {/* Top-level section trigger */}
          <button
            className="flyout-item w-full flex items-center justify-between"
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={activeSection === section.label}
          >
            <span className="flex-1 text-left">{section.label}</span>
            <ChevronRight size={13} className="text-muted ml-2 flex-shrink-0" />
          </button>

          {/* Submenu — appears to the right on hover */}
          {activeSection === section.label && (
            <div
              className="absolute left-full top-0 ml-[1px] flex z-50"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              {/* Invisible bridge for diagonal mouse movement */}
              <div className="w-2 self-stretch flex-shrink-0" />
              <div
                className="flyout-menu min-w-[220px] animate-in fade-in zoom-in-95 duration-100"
                role="menu"
                aria-label={`${section.label} submenu`}
              >
              {section.items.map((item) => (
                <button
                  key={item.action}
                  className="flyout-item w-full text-left flex items-center gap-2.5"
                  onClick={() => handleAction(item.action)}
                  role="menuitem"
                >
                  <item.icon size={15} className="text-muted flex-shrink-0" />
                  <span className="flex-1 text-xs">{item.label}</span>
                  {item.shortcut && (
                    <span className="shortcut text-[10px] text-muted font-mono">{item.shortcut}</span>
                  )}
                </button>
              ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
