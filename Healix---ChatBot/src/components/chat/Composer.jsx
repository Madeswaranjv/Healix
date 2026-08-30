import { useState, useRef, useEffect } from 'react';
import { Paperclip, Image as ImageIcon, Plus, CornerDownLeft, X, File as FileIcon, Globe, Check, Square } from 'lucide-react';
import ModelSelector from './ModelSelector';
import { useStore } from '../../store/useStore';

/**
 * Composer — bottom-docked, auto-growing textarea.
 * Left: attach button with menu (1. Add Lab Documents, 2. Add Images, 3. Web Search), Right: model selector, send/stop button.
 */
export default function Composer({ onSend, onStop, isGenerating = false, disabled = false }) {
  const { useWebSearch, toggleWebSearch } = useStore();
  const [value, setValue] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const textareaRef = useRef(null);
  const menuRef = useRef(null);
  const docInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newAttachments = files.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      type: file.type,
      isImage: file.type.startsWith('image/'),
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    
    // Reset inputs
    if (docInputRef.current) docInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => {
      const filtered = prev.filter(a => a.id !== id);
      const removed = prev.find(a => a.id === id);
      if (removed && removed.url) URL.revokeObjectURL(removed.url);
      return filtered;
    });
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach(a => {
        if (a.url) URL.revokeObjectURL(a.url);
      });
    };
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleSubmit = () => {
    const text = value.trim();
    if ((!text && attachments.length === 0) || disabled || isGenerating) return;
    onSend({
      text,
      attachments: [...attachments],
    });
    setValue('');
    setAttachments([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasContent = value.trim().length > 0 || attachments.length > 0;

  return (
    <div className="flex flex-col gap-[1px] w-full">
      {/* Hidden file inputs for Lab Documents and Images */}
      <input 
        type="file" 
        multiple 
        accept=".pdf,.docx,.doc,.txt,.csv,.json,.tsv,.md,.rtf"
        ref={docInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
      />
      <input 
        type="file" 
        multiple 
        accept="image/*"
        ref={imageInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
      />

      {/* Attachments Container (Top) */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-1">
          {attachments.map((att) => (
            <div 
              key={att.id} 
              className="
                relative group
                w-24 h-24 rounded-xl 
                bg-surface border border-inputborder 
                flex items-center justify-center 
                shadow-sm overflow-hidden
              "
            >
              {att.isImage ? (
                <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center p-2 text-center">
                  <FileIcon size={20} className="text-primary mb-1" />
                  <span className="text-[10px] text-ink break-all line-clamp-2 leading-tight">
                    {att.name}
                  </span>
                </div>
              )}
              
              {/* Remove button (appears on hover) */}
              <button
                onClick={() => removeAttachment(att.id)}
                className="
                  absolute top-1 right-1
                  w-5 h-5 rounded-full bg-backdrop/80 hover:bg-backdrop text-white
                  flex items-center justify-center
                  opacity-0 group-hover:opacity-100 transition-opacity duration-150
                "
                aria-label="Remove attachment"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="
        flex flex-col gap-2
        bg-input border border-inputborder rounded-xl
        px-3 py-2
        transition-colors duration-150
        focus-within:border-primary
      ">
      {/* Textarea (Top Row) */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={attachments.length > 0 ? "Ask a question about your attached files/images..." : "Ask for Medical related queries..."}
        disabled={disabled}
        autoFocus={!disabled}
        rows={1}
        className="
          w-full resize-none
          text-sm text-ink
          bg-transparent
          placeholder:text-muted
          focus:outline-none
          py-2 pl-3
          min-h-[40px]
          max-h-[200px]
          leading-relaxed
        "
        aria-label="Message input"
      />

      {/* Toolbar (Bottom Row) */}
      <div className="flex items-center justify-between">
        {/* Left Controls */}
        <div className="relative flex items-center gap-2" ref={menuRef}>
          {/* Attach (+) button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`
              flex-shrink-0
              p-2 rounded-lg
              transition-colors duration-150
              ${useWebSearch
                ? 'text-primary bg-primary/10 hover:bg-primary/20'
                : 'text-ink hover:text-ink hover:bg-sidebar-icon-hover active:text-ink'
              }
            `}
            aria-label="Add attachment or tools"
            aria-expanded={isMenuOpen}
          >
            <Plus size={18} />
          </button>

          {/* Web Search Active Badge (if enabled) */}
          {useWebSearch && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium border border-primary/20 animate-in fade-in duration-150">
              <Globe size={11} className="animate-pulse" />
              <span>Web Search</span>
            </span>
          )}

          {/* Dropdown Menu with 3 distinct options */}
          {isMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-56 flyout-menu animate-in fade-in zoom-in-95 duration-100 z-50 py-1">
              {/* 1. Add Lab Documents */}
              <button
                className="flyout-item w-full"
                onClick={() => {
                  docInputRef.current?.click();
                  setIsMenuOpen(false);
                }}
              >
                <Paperclip size={16} className="text-muted" />
                <span>Add Lab Documents</span>
              </button>

              {/* 2. Add Images */}
              <button
                className="flyout-item w-full"
                onClick={() => {
                  imageInputRef.current?.click();
                  setIsMenuOpen(false);
                }}
              >
                <ImageIcon size={16} className="text-muted" />
                <span>Add Images</span>
              </button>

              <div className="h-px bg-border/60 my-1" />

              {/* 3. Web Search */}
              <button
                className={`flyout-item w-full justify-between ${useWebSearch ? 'text-primary font-medium bg-primary/10' : ''}`}
                onClick={() => {
                  toggleWebSearch();
                  setIsMenuOpen(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <Globe size={16} className={useWebSearch ? 'text-primary' : 'text-muted'} />
                  <span>Web Search</span>
                </div>
                {useWebSearch && <Check size={14} className="text-primary" />}
              </button>
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5">
          <ModelSelector />

          {/* Send / Stop button */}
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              className="
                flex-shrink-0
                p-2 rounded-lg
                bg-ink text-canvas hover:bg-ink/80
                transition-all duration-150 shadow-sm
                flex items-center justify-center
              "
              title="Stop generating"
              aria-label="Stop generating"
            >
              <Square size={15} className="fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasContent || disabled}
              className={`
                flex-shrink-0
                p-2 rounded-lg
                transition-all duration-150
                ${hasContent && !disabled
                  ? 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                  : 'text-muted cursor-not-allowed'
                }
              `}
              aria-label="Send message"
            >
              <CornerDownLeft size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}


