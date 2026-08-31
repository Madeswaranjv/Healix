import { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronRight, Check } from 'lucide-react';
import { useStore } from '../../store/useStore';

const MODELS = [
  {
    name: 'Ling 3.0',
    options: ['Ling 3.0 Flash'],
  },
  {
    name: 'MiniMax',
    options: ['MiniMax M3', 'MiniMax M2.7'],
  },
  {
    name: 'Gemma 4',
    options: ['Gemma 4 31B'],
  },
  {
    name: 'Nemotron 3',
    options: ['Nemotron 3 Super', 'Nemotron 3.5 Lightning', 'Nemotron 3 Nano Omni'],
  },
  {
    name: 'Liquid LFM',
    options: [],
  },
  {
    name: 'Dots 3 Note',
    options: [],
  }
];

export default function ModelSelector() {
  const { selectedModel, setSelectedModel } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
        setOpenSubmenu(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (modelName) => {
    setSelectedModel(modelName);
    setIsOpen(false);
    setOpenSubmenu(null);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-1.5
          px-2.5 py-2 rounded-lg
          text-[13px] font-medium text-ink
          hover:bg-sidebar-icon-hover
          transition-colors duration-150
        "
        aria-label="Select Model"
        aria-expanded={isOpen}
      >
        <span>{selectedModel}</span>
        <ChevronUp size={14} className="text-muted" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-52 max-w-[85vw] flyout-menu animate-in fade-in zoom-in-95 duration-100 z-50 max-h-[70vh] overflow-y-auto">
          {MODELS.map((model) => {
            const hasSubmenu = model.options.length > 0;
            const isSubmenuActive = openSubmenu === model.name;
            
            return (
              <div 
                key={model.name}
                className="relative"
                onMouseEnter={() => setOpenSubmenu(model.name)}
                onMouseLeave={() => setOpenSubmenu(null)}
              >
                <button 
                  className={`flyout-item justify-between ${isSubmenuActive ? 'bg-sidebar-icon-hover text-ink' : ''}`}
                  onClick={() => {
                    if (hasSubmenu) {
                      setOpenSubmenu(isSubmenuActive ? null : model.name);
                    } else {
                      handleSelect(model.name);
                    }
                  }}
                >
                  <span className="truncate">{model.name}</span>
                  {hasSubmenu && (
                    <ChevronRight 
                      size={14} 
                      className={`text-muted transition-transform duration-150 ${isSubmenuActive ? 'rotate-90 sm:rotate-0' : ''}`} 
                    />
                  )}
                  {!hasSubmenu && selectedModel === model.name && <Check size={14} className="text-primary" />}
                </button>
                
                {/* Submenu — on desktop flyout leftwards, on mobile clean nested accordion */}
                {hasSubmenu && isSubmenuActive && (
                  <div className="sm:absolute sm:bottom-0 sm:right-full sm:mr-1 z-50">
                    <div className="sm:w-48 flyout-menu py-1 animate-in fade-in zoom-in-95 duration-100 bg-surface/95 border-l-2 border-primary/40 sm:border-l sm:border sm:border-inputborder pl-2 sm:pl-0 my-1 sm:my-0">
                      {model.options.map((opt) => (
                        <button 
                          key={opt}
                          className="flyout-item justify-between text-xs sm:text-sm"
                          onClick={() => handleSelect(opt)}
                        >
                          <span className="truncate">{opt}</span>
                          {selectedModel === opt && <Check size={14} className="text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
