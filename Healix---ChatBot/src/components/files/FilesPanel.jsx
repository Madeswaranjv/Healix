import { useState, useEffect, useCallback } from 'react';
import { FileText, FileOutput, ChevronRight, X, FolderOpen } from 'lucide-react';
import ResizeHandle from './ResizeHandle';
import FileDetailToolbar from './FileDetailToolbar';
import TiltCard from '../shared/TiltCard';
import { useStore } from '../../store/useStore';

/**
 * Files panel — right-hand column alongside the chat canvas.
 * STATE A: List view (default) — shows all user files.
 * STATE B: Detail view — shows one file with preview/code toggle.
 */
export default function FilesPanel() {
  const {
    isFilesPanelOpen,
    setFilesPanelOpen,
    filesList,
    activeFileId,
    setActiveFileId,
    loadUserFiles,
  } = useStore();

  const [panelWidth, setPanelWidth] = useState(420);
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load files when panel opens
  useEffect(() => {
    if (isFilesPanelOpen) {
      loadUserFiles();
    }
  }, [isFilesPanelOpen, loadUserFiles]);

  const handleResize = useCallback((newWidth) => {
    setPanelWidth(newWidth);
  }, []);

  const handleClose = () => {
    setActiveFileId(null);
    setFilesPanelOpen(false);
    setIsFullscreen(false);
  };

  const handleBackToList = () => {
    setActiveFileId(null);
    setViewMode('preview');
    setIsFullscreen(false);
  };

  const handleToggleViewMode = (mode) => {
    setViewMode(mode);
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const activeFile = activeFileId
    ? filesList.find((f) => f.id === activeFileId)
    : null;

  const getTypeIcon = (type) => {
    if (type === 'pdf') return <FileOutput size={16} className="text-alert flex-shrink-0" />;
    return <FileText size={16} className="text-primary flex-shrink-0" />;
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Fullscreen overlay
  if (isFullscreen && activeFile) {
    return (
      <div className="fixed inset-0 z-50 bg-canvas flex flex-col">
        <FileDetailToolbar
          file={activeFile}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onClose={handleBackToList}
        />
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'code' ? (
            <pre className="font-mono text-xs text-ink leading-relaxed whitespace-pre-wrap break-words">
              {activeFile.content || ''}
            </pre>
          ) : (
            <div className="prose-healix max-w-[800px] mx-auto">
              <MarkdownPreview content={activeFile.content || ''} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-files-panel
      className="relative flex-shrink-0 h-full border-l border-border/60 bg-surface flex flex-col overflow-hidden"
      style={{ width: isFilesPanelOpen ? `${panelWidth}px` : '0px' }}
    >
      <ResizeHandle onResize={handleResize} />

      {activeFile ? (
        /* ── STATE B: Detail View ── */
        <>
          <FileDetailToolbar
            file={activeFile}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewMode}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onClose={handleBackToList}
          />
          <div className="flex-1 overflow-y-auto p-4">
            {viewMode === 'code' ? (
              <pre className="font-mono text-xs text-ink leading-relaxed whitespace-pre-wrap break-words">
                {activeFile.content || ''}
              </pre>
            ) : (
              <div className="prose-healix">
                <MarkdownPreview content={activeFile.content || ''} />
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── STATE A: List View ── */
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60 flex-shrink-0">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-primary" />
              <span className="text-sm font-semibold text-ink">Files</span>
              {filesList.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {filesList.length}
                </span>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg text-muted hover:text-ink hover:bg-border/40 transition-colors"
              title="Close Files panel"
              aria-label="Close Files panel"
            >
              <X size={15} />
            </button>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto">
            {filesList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <FolderOpen size={36} className="text-border mb-3" />
                <p className="text-sm font-medium text-muted mb-1">No files yet</p>
                <p className="text-xs text-muted/70 leading-relaxed">
                  Ask Healix to create a document, note, or report — it'll appear here.
                </p>
              </div>
            ) : (
              <div className="py-1">
                {filesList.map((file) => (
                  <div key={file.id} className="px-2 mb-1">
                    <TiltCard className="rounded-lg">
                      <button
                        onClick={() => {
                          setActiveFileId(file.id);
                          setViewMode('preview');
                        }}
                        className="
                          w-full flex items-center gap-3 px-3 py-2.5
                          bg-canvas border border-border/40 shadow-sm
                          hover:bg-accent-soft/60 transition-colors duration-100
                          text-left group hover:border-border/60 rounded-lg
                        "
                      >
                        {getTypeIcon(file.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {file.title || 'Untitled'}
                          </p>
                          <p className="text-[11px] text-muted truncate">
                            Document · {(file.type || 'md').toUpperCase()}
                            {file.updated_at && (
                              <span className="ml-1.5">· {formatDate(file.updated_at)}</span>
                            )}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-muted/50 group-hover:text-muted flex-shrink-0" />
                      </button>
                    </TiltCard>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function parseTableCells(rowStr) {
  let cleaned = rowStr.trim();
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
  return cleaned.split('|').map((cell) => cell.trim());
}

function isTableDivider(rowStr) {
  const cells = parseTableCells(rowStr);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

function renderTable(tableLines, key) {
  if (!tableLines || tableLines.length === 0) return null;

  const rawRows = tableLines.filter((l) => l.trim().length > 0);
  if (rawRows.length === 0) return null;

  const headerRow = parseTableCells(rawRows[0]);
  let bodyRows = [];

  if (rawRows.length > 1 && isTableDivider(rawRows[1])) {
    bodyRows = rawRows.slice(2).map((r) => parseTableCells(r));
  } else {
    bodyRows = rawRows.slice(1).map((r) => parseTableCells(r));
  }

  return (
    <div
      key={key}
      className="my-3.5 overflow-x-auto rounded-xl border border-table-border bg-surface"
      style={{
        boxShadow:
          '0 4px 24px rgba(0,0,0,0.10), 0 1.5px 6px rgba(0,85,204,0.08)',
      }}
    >
      <table className="w-full table-fixed text-left text-xs border-collapse min-w-[320px]">
        <thead>
          <tr
            className="border-b border-table-border"
            style={{ background: 'var(--color-table-header)' }}
          >
            {headerRow.map((col, ci) => (
              <th
                key={ci}
                className="px-3.5 py-2.5 font-bold tracking-tight text-ink"
              >
                {renderInline(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-table-border/60">
          {bodyRows.map((row, ri) => (
            <tr
              key={ri}
              className="transition-colors duration-100"
              style={{
                background:
                  ri % 2 === 0
                    ? 'var(--color-table-bg)'
                    : 'var(--color-table-alt)',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--color-accent-soft)')
              }
              onMouseLeave={(e) =>
              (e.currentTarget.style.background =
                ri % 2 === 0
                  ? 'var(--color-table-bg)'
                  : 'var(--color-table-alt)')
              }
            >
              {row.map((cell, ci) => (
                <td key={ci} className="px-3.5 py-2 text-ink/90 leading-relaxed align-top">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/**
 * Simple markdown preview renderer.
 * Handles headings, bold, italic, inline code, bullet/numbered lists, and paragraphs.
 * Reuses Healix's existing typography scale.
 */
function MarkdownPreview({ content }) {
  if (!content) return null;

  const blocks = content.split(/\n\n+/);

  return (
    <>
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const lines = trimmed.split('\n');

        // Check if entire block is a table
        const hasTableDivider = lines.some((l) => isTableDivider(l));
        if (lines.length >= 2 && lines[0].includes('|') && hasTableDivider) {
          return renderTable(lines, bi);
        }

        // Heading
        if (lines.length === 1) {
          const headMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
          if (headMatch) {
            const level = headMatch[1].length;
            const text = headMatch[2];
            if (level === 1) return <h1 key={bi} className="text-lg font-bold text-ink mt-4 mb-2 first:mt-0 tracking-tight">{renderInline(text)}</h1>;
            if (level === 2) return <h2 key={bi} className="text-base font-bold text-ink mt-3 mb-1.5 first:mt-0">{renderInline(text)}</h2>;
            if (level === 3) return <h3 key={bi} className="text-sm font-bold text-ink mt-2.5 mb-1.5 first:mt-0">{renderInline(text)}</h3>;
            return <h4 key={bi} className="text-xs font-bold text-ink uppercase tracking-wider mt-2.5 mb-1 first:mt-0">{renderInline(text)}</h4>;
          }
        }

        // HR
        if (/^[-*_]{3,}$/.test(trimmed)) {
          return <hr key={bi} className="my-3 border-border/80" />;
        }

        // Bullet list
        const isBullet = lines.every((l) => /^\s*[-*+]\s+/.test(l));
        if (isBullet) {
          return (
            <ul key={bi} className="list-disc ml-5 mb-3 space-y-1 text-ink/90">
              {lines.map((line, li) => (
                <li key={li} className="text-sm leading-relaxed">
                  {renderInline(line.replace(/^\s*[-*+]\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        }

        // Numbered list
        const isNum = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (isNum) {
          return (
            <ol key={bi} className="list-decimal ml-5 mb-3 space-y-1 text-ink/90">
              {lines.map((line, li) => (
                <li key={li} className="text-sm leading-relaxed">
                  {renderInline(line.replace(/^\s*\d+[.)]\s+/, ''))}
                </li>
              ))}
            </ol>
          );
        }

        // Paragraph
        return (
          <p key={bi} className="text-sm leading-relaxed mb-2.5 text-ink">
            {lines.map((line, li) => (
              <span key={li}>
                {renderInline(line)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

/**
 * Renders inline markdown tokens: **bold**, *italic*, `code`.
 */
function renderInline(text) {
  if (!text) return null;

  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    // Inline code
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="px-1 py-0.5 mx-0.5 rounded bg-border/40 text-ink text-xs font-mono border border-border/50">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold + Italic
    let processed = part
      .replace(/\*\*\*(.+?)\*\*\*/g, '«BI»$1«/BI»')
      .replace(/\*\*(.+?)\*\*/g, '«B»$1«/B»')
      .replace(/\*(.+?)\*/g, '«I»$1«/I»');

    const tokens = processed.split(/(«BI»[^«]+«\/BI»|«B»[^«]+«\/B»|«I»[^«]+«\/I»)/g);

    return tokens.map((token, ti) => {
      if (token.startsWith('«BI»')) return <strong key={`${i}-${ti}`}><em>{token.slice(4, -5)}</em></strong>;
      if (token.startsWith('«B»')) return <strong key={`${i}-${ti}`} className="font-semibold">{token.slice(3, -4)}</strong>;
      if (token.startsWith('«I»')) return <em key={`${i}-${ti}`} className="italic">{token.slice(3, -4)}</em>;
      return <span key={`${i}-${ti}`}>{token}</span>;
    });
  });
}
