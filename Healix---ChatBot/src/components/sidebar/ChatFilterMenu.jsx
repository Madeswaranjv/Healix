import { useRef, useEffect, useState } from 'react';
import { ChevronRight, Check } from 'lucide-react';

export default function ChatFilterMenu({ onClose }) {
  const menuRef = useRef(null);
  
  // State to manage which submenu is open
  const [openSubmenu, setOpenSubmenu] = useState(null);
  
  // Selected filter states (mock for UI)
  const [sortBy, setSortBy] = useState('Last activity');
  const [lastActivity, setLastActivity] = useState('All');

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute top-8 right-4 w-56 flyout-menu py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Type, Status, Group by omitted per prompt simplicity, only doing requested ones */}
      
      {/* Last activity with submenu */}
      <div 
        className="relative"
        onMouseEnter={() => setOpenSubmenu('lastActivity')}
        onMouseLeave={() => setOpenSubmenu(null)}
      >
        <button className="flyout-item justify-between">
          <span>Last activity</span>
          <div className="flex items-center gap-2">
            <span className="text-muted text-xs">{lastActivity}</span>
            <ChevronRight size={14} className="text-muted" />
          </div>
        </button>
        
        {openSubmenu === 'lastActivity' && (
          <div className="absolute top-0 left-full ml-[1px] z-50">
            <div className="w-48 flyout-menu py-1 animate-in fade-in zoom-in-95 duration-100">
              {['1d', '3d', '7d', '30d', 'All'].map((opt) => (
                <button 
                  key={opt}
                  className="flyout-item justify-between"
                  onClick={() => setLastActivity(opt)}
                >
                  <span>{opt}</span>
                  {lastActivity === opt && <Check size={14} className="text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sort by with submenu */}
      <div 
        className="relative"
        onMouseEnter={() => setOpenSubmenu('sortBy')}
        onMouseLeave={() => setOpenSubmenu(null)}
      >
        <button className="flyout-item justify-between">
          <span>Sort by</span>
          <div className="flex items-center gap-2">
            <span className="text-muted text-xs truncate max-w-[60px]">{sortBy}</span>
            <ChevronRight size={14} className="text-muted" />
          </div>
        </button>
        
        {openSubmenu === 'sortBy' && (
          <div className="absolute top-0 left-full ml-[1px] z-50">
            <div className="w-48 flyout-menu py-1 animate-in fade-in zoom-in-95 duration-100">
              {['Name', 'Date created', 'Last activity'].map((opt) => (
                <button 
                  key={opt}
                  className="flyout-item justify-between"
                  onClick={() => setSortBy(opt)}
                >
                  <span>{opt}</span>
                  {sortBy === opt && <Check size={14} className="text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
