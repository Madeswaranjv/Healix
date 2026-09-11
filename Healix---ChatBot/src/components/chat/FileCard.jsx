import { useState, useRef, useEffect } from 'react';
import { FileText, ChevronDown, Download, Monitor, Folder, HardDrive } from 'lucide-react';
import TiltCard from '../shared/TiltCard';
import { useStore } from '../../store/useStore';

export default function FileCard({ fileInfo }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { loadUserFiles, setActiveFileId, setFilesPanelOpen } = useStore();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleOpenFilesPanel = () => {
    loadUserFiles();
    setActiveFileId(fileInfo.file_id);
    setFilesPanelOpen(true);
  };

  const handleDownloadMD = async () => {
    setDropdownOpen(false);
    // Usually the content is not in fileInfo since it's just metadata, 
    // we fetch it via the store or api, but here we can just open it in the panel.
    // The user wants a dropdown with options like the image.
    // Let's open it in the IDE panel for now.
    handleOpenFilesPanel();
  };

  return (
    <div className="mt-4 mb-2 max-w-[400px]">
      <TiltCard className="rounded-xl border border-border/60 bg-accent-soft shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between p-3.5">
          <div className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1" onClick={handleOpenFilesPanel}>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
              <FileText size={20} />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-ink truncate">
                {fileInfo.title || "Untitled Document"}
              </span>
              <span className="text-xs text-muted truncate">
                Document &middot; {fileInfo.file_type?.toUpperCase() || "MD"}
              </span>
            </div>
          </div>
          
          <div className="relative ml-3" ref={dropdownRef}>
            <div className="flex items-center rounded-lg border border-border/50 bg-canvas/50">
              <button 
                onClick={handleDownloadMD}
                className="px-3 py-1.5 text-xs font-medium text-ink hover:bg-border/30 transition-colors border-r border-border/50 rounded-l-lg"
              >
                Download
              </button>
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="p-1.5 text-muted hover:text-ink hover:bg-border/30 transition-colors rounded-r-lg"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-canvas border border-border shadow-lg z-50 overflow-hidden py-1 animate-in fade-in zoom-in duration-150">
                <button onClick={handleOpenFilesPanel} className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-border/30 flex items-center gap-2">
                  <Monitor size={14} /> Open in Files Panel
                </button>
                <button onClick={() => setDropdownOpen(false)} className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-border/30 flex items-center gap-2">
                  <HardDrive size={14} /> Download to Device
                </button>
                <button onClick={() => setDropdownOpen(false)} className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-border/30 flex items-center gap-2">
                  <Folder size={14} /> Save to Drive
                </button>
              </div>
            )}
          </div>
        </div>
      </TiltCard>
    </div>
  );
}
