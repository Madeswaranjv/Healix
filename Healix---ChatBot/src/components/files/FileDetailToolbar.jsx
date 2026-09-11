import { useState, useRef, useEffect } from 'react';
import {
  Eye, Code, HardDrive, Copy, ChevronDown,
  Download, Printer, Maximize2, Minimize2, X
} from 'lucide-react';

/**
 * Toolbar for the file detail view.
 * Left: preview/code toggle, file title + type badge.
 * Right: Drive stub, Copy dropdown, fullscreen, close.
 */
export default function FileDetailToolbar({
  file,
  viewMode,
  onToggleViewMode,
  isFullscreen,
  onToggleFullscreen,
  onClose,
}) {
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!copyMenuOpen) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCopyMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [copyMenuOpen]);

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(file.content || '');
    } catch (err) {
      console.warn('Copy failed:', err);
    }
    setCopyMenuOpen(false);
  };

  const handleDownloadMd = () => {
    const blob = new Blob([file.content || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.title || 'file'}.${file.type || 'md'}`;
    a.click();
    URL.revokeObjectURL(url);
    setCopyMenuOpen(false);
  };

  const handlePrintPdf = async () => {
    setCopyMenuOpen(false);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      // Create a styled container for PDF export
      const container = document.createElement('div');
      container.style.cssText = 'font-family: "IBM Plex Sans", sans-serif; padding: 40px; max-width: 700px; color: #0F172A; line-height: 1.7;';
      container.innerHTML = renderMarkdownToHtml(file.content || '');
      document.body.appendChild(container);

      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `${file.title || 'file'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(container).save();

      document.body.removeChild(container);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  const handleDriveStub = () => {
    console.log('[Healix] Google Drive integration — coming soon.');
  };

  const typeBadge = (file.type || 'md').toUpperCase();

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-surface/80 backdrop-blur-sm flex-shrink-0 min-h-[44px]">
      {/* Left side */}
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          onClick={() => onToggleViewMode('preview')}
          className={`p-1.5 rounded-lg transition-colors ${viewMode === 'preview' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-ink hover:bg-border/40'}`}
          title="Preview"
          aria-label="Preview mode"
        >
          <Eye size={15} />
        </button>
        <button
          onClick={() => onToggleViewMode('code')}
          className={`p-1.5 rounded-lg transition-colors ${viewMode === 'code' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-ink hover:bg-border/40'}`}
          title="Raw source"
          aria-label="Code mode"
        >
          <Code size={15} />
        </button>
        <span className="text-xs font-semibold text-ink truncate ml-1.5 max-w-[160px]">
          {file.title || 'Untitled'}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium flex-shrink-0">
          {typeBadge}
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-0.5">
        {/* Drive stub */}
        <button
          onClick={handleDriveStub}
          className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/40 transition-colors"
          title="Save to Drive (coming soon)"
          aria-label="Save to Google Drive"
        >
          <HardDrive size={15} />
        </button>

        {/* Copy + dropdown */}
        <div ref={dropdownRef} className="relative">
          <div className="flex items-center">
            <button
              onClick={handleCopyRaw}
              className="p-1.5 rounded-l-lg text-muted hover:text-ink hover:bg-border/40 transition-colors"
              title="Copy raw content"
              aria-label="Copy content"
            >
              <Copy size={15} />
            </button>
            <button
              onClick={() => setCopyMenuOpen(!copyMenuOpen)}
              className="p-1.5 rounded-r-lg text-muted hover:text-ink hover:bg-border/40 transition-colors border-l border-border/40"
              aria-label="Copy options"
            >
              <ChevronDown size={12} />
            </button>
          </div>

          {/* Dropdown menu */}
          {copyMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-dropdown border border-border rounded-lg shadow-md py-1 min-w-[160px]">
              <button
                onClick={handleDownloadMd}
                className="flex items-center gap-2 px-3 py-1.5 w-full text-left text-xs text-ink hover:bg-accent-soft transition-colors"
              >
                <Download size={13} />
                <span>Download as {typeBadge}</span>
              </button>
              <button
                onClick={handlePrintPdf}
                className="flex items-center gap-2 px-3 py-1.5 w-full text-left text-xs text-ink hover:bg-accent-soft transition-colors"
              >
                <Printer size={13} />
                <span>Print as PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* Fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/40 transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/40 transition-colors"
          title="Close"
          aria-label="Close detail view"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

/**
 * Minimal markdown-to-HTML renderer for PDF export.
 * Converts headings, bold, italic, lists, and paragraphs.
 */
function renderMarkdownToHtml(md) {
  if (!md) return '';

  const parseInline = (text) => {
    return text
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  };

  const blocks = md.split(/\n\n+/);

  const htmlBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';

    // Check for tables
    const lines = trimmed.split('\n');
    if (lines.length >= 2 && lines[0].includes('|') && lines[1].includes('|--')) {
      const parseCells = (row) => {
        let cleaned = row.trim();
        if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
        if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
        return cleaned.split('|').map(c => c.trim());
      };

      const headerCells = parseCells(lines[0]);
      const bodyLines = lines.slice(2);

      let tableHtml = '<table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:12px; text-align:left;">';
      
      tableHtml += '<thead><tr style="border-bottom:2px solid #e2e8f0; background:#f8fafc;">';
      headerCells.forEach(cell => {
        tableHtml += `<th style="padding:10px 14px; font-weight:600; color:#0f172a;">${parseInline(cell)}</th>`;
      });
      tableHtml += '</tr></thead>';

      tableHtml += '<tbody>';
      bodyLines.forEach((row, idx) => {
        if (!row.includes('|')) return;
        const cells = parseCells(row);
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        tableHtml += `<tr style="border-bottom:1px solid #f1f5f9; background:${bg};">`;
        cells.forEach(cell => {
          tableHtml += `<td style="padding:10px 14px; color:#334155;">${parseInline(cell)}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table>';
      return tableHtml;
    }

    // Default block processing
    let html = trimmed
      .replace(/^#### (.+)$/gm, '<h4 style="font-size:14px;font-weight:600;margin:16px 0 6px;">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;margin:18px 0 8px;">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:700;margin:20px 0 8px;">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:700;margin:24px 0 10px;">$1</h1>')
      .replace(/^[-*+] (.+)$/gm, '<li style="margin:3px 0;">$1</li>')
      .replace(/^\d+[.)] (.+)$/gm, '<li style="margin:3px 0;">$1</li>')
      .replace(/(<li[^>]*>.*?<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:8px 0;">$&</ul>');

    if (!html.startsWith('<h') && !html.startsWith('<ul')) {
      html = `<p style="margin:8px 0;">${html.replace(/\n/g, '<br>')}</p>`;
    }

    return parseInline(html);
  });

  return htmlBlocks.join('');
}
