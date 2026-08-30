import { useState } from 'react';
import { Copy, Check, RotateCcw, Pencil, X } from 'lucide-react';
import SourceChips from './SourceChips';

/**
 * Message bubble component.
 * User: right-aligned, accent-soft filled bubble, ink text, with Copy, Re-enter prompt, Edit icons.
 * Assistant: left-aligned, clean typography with Healix mark, with Copy icon.
 */

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Renders inline text with bold, italic, code, and cleans up raw syntax tokens.
 */
function renderInline(text) {
  if (!text) return null;

  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, ci) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={`code-${ci}`}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-border/40 text-ink text-xs font-mono border border-border/50"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const cleanedText = part.replace(/\*\*([^*]+)\*\*/g, '«B»$1«/B»')
      .replace(/__([^_]+)__/g, '«B»$1«/B»')
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1«I»$2«/I»$3')
      .replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1«I»$2«/I»$3')
      .replace(/\*\*+/g, '')
      .replace(/##+/g, '');

    const tokens = cleanedText.split(/(«B»[^«]+«\/B»|«I»[^«]+«\/I»)/g);

    return tokens.map((token, ti) => {
      if (token.startsWith('«B»') && token.endsWith('«/B»')) {
        return (
          <strong key={`${ci}-${ti}`} className="font-semibold text-ink">
            {token.slice(3, -4)}
          </strong>
        );
      }
      if (token.startsWith('«I»') && token.endsWith('«/I»')) {
        return (
          <em key={`${ci}-${ti}`} className="italic text-ink/90">
            {token.slice(3, -4)}
          </em>
        );
      }
      return <span key={`${ci}-${ti}`}>{token}</span>;
    });
  });
}

/**
 * Parses a markdown table row string into individual cells.
 */
function parseTableCells(rowStr) {
  let cleaned = rowStr.trim();
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
  return cleaned.split('|').map((cell) => cell.trim());
}

/**
 * Checks if a row string is a markdown table separator row (|---|---|).
 */
function isTableDivider(rowStr) {
  const cells = parseTableCells(rowStr);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

/**
 * Renders structured markdown table lines as a styled responsive HTML table.
 */
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
    <div key={key} className="my-3.5 overflow-x-auto rounded-xl border border-border/80 shadow-xs bg-surface">
      <table className="w-full text-left text-xs border-collapse min-w-[320px]">
        <thead>
          <tr className="bg-canvas/90 border-b border-border text-ink font-semibold">
            {headerRow.map((col, ci) => (
              <th key={ci} className="px-3.5 py-2.5 font-semibold text-ink tracking-tight">
                {renderInline(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {bodyRows.map((row, ri) => (
            <tr key={ri} className="hover:bg-accent-soft/30 transition-colors duration-100 odd:bg-surface even:bg-canvas/40">
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
 * Clean markdown block parser
 */
function renderMarkdown(text) {
  if (!text) return null;

  const rawBlocks = text.split(/\n\n+/);

  return rawBlocks.map((block, bi) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (/^[-*_]{3,}$/.test(trimmed)) {
      return <hr key={bi} className="my-3 border-border/80" />;
    }

    const lines = trimmed.split('\n');

    // Check if entire block is a table
    const hasTableDivider = lines.some((l) => isTableDivider(l));
    if (lines.length >= 2 && lines[0].includes('|') && hasTableDivider) {
      return renderTable(lines, bi);
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/m);
    if (headingMatch && lines.length === 1) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      if (level === 1) {
        return (
          <h2 key={bi} className="text-base font-bold text-ink mt-3 mb-1.5 first:mt-0 tracking-tight">
            {renderInline(headingText)}
          </h2>
        );
      }
      if (level === 2) {
        return (
          <h3 key={bi} className="text-sm font-bold text-ink mt-2.5 mb-1.5 first:mt-0">
            {renderInline(headingText)}
          </h3>
        );
      }
      return (
        <h4 key={bi} className="text-xs font-bold text-ink uppercase tracking-wider mt-2.5 mb-1 first:mt-0">
          {renderInline(headingText)}
        </h4>
      );
    }

    const isBulletList = lines.every((l) => /^\s*[-*+]\s+/.test(l));
    if (isBulletList) {
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

    const isNumberedList = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
    if (isNumberedList) {
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

    // Check if block has embedded tables among normal lines
    if (hasTableDivider) {
      const elements = [];
      let currentTextLines = [];
      let currentTableLines = [];
      let inTable = false;

      lines.forEach((line, li) => {
        if (line.includes('|')) {
          if (!inTable) {
            if (currentTextLines.length > 0) {
              elements.push(
                <p key={`text-${li}`} className="text-sm leading-relaxed mb-2 text-ink">
                  {renderInline(currentTextLines.join(' '))}
                </p>
              );
              currentTextLines = [];
            }
            inTable = true;
          }
          currentTableLines.push(line);
        } else {
          if (inTable) {
            elements.push(renderTable(currentTableLines, `table-${li}`));
            currentTableLines = [];
            inTable = false;
          }
          if (line.trim()) {
            currentTextLines.push(line);
          }
        }
      });

      if (inTable && currentTableLines.length > 0) {
        elements.push(renderTable(currentTableLines, `table-end`));
      } else if (currentTextLines.length > 0) {
        elements.push(
          <p key="text-end" className="text-sm leading-relaxed mb-2 text-ink">
            {renderInline(currentTextLines.join(' '))}
          </p>
        );
      }

      return <div key={bi}>{elements}</div>;
    }

    return (
      <div key={bi} className="text-sm leading-relaxed mb-3 last:mb-0 text-ink">
        {lines.map((line, li) => {
          const subHeading = line.match(/^(#{1,4})\s+(.+)$/);
          if (subHeading) {
            return (
              <p key={li} className="font-semibold text-ink mt-2 mb-1">
                {renderInline(subHeading[2])}
              </p>
            );
          }
          if (/^\s*[-*+]\s+/.test(line)) {
            return (
              <div key={li} className="flex items-start gap-2 ml-2 my-1">
                <span className="text-primary font-bold">•</span>
                <span>{renderInline(line.replace(/^\s*[-*+]\s+/, ''))}</span>
              </div>
            );
          }
          return (
            <span key={li}>
              {renderInline(line)}
              {li < lines.length - 1 && <br />}
            </span>
          );
        })}
      </div>
    );
  });
}

export default function MessageBubble({ message, onResend, onEdit }) {
  const { id, role, content, timestamp, sources, isStreaming } = message;
  const isUser = role === 'user';

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed) {
      onEdit?.(id, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-5 group`}>
      <div className={`max-w-[85%] lg:max-w-[75%] ${isUser ? '' : 'flex gap-3'}`}>
        {/* Healix logo for assistant messages */}
        {!isUser && (
          <div className="flex-shrink-0 mt-1">
            <div className="w-6 h-6 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Healix"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col">
          {/* Message content */}
          {isUser && isEditing ? (
            <div className="bg-input border border-primary/50 rounded-2xl rounded-br-md p-3 flex flex-col gap-2 min-w-[280px] shadow-sm">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditText(content);
                  }
                }}
                className="w-full bg-transparent text-sm text-ink resize-none focus:outline-none leading-relaxed"
                rows={Math.min(6, Math.max(2, editText.split('\n').length))}
                autoFocus
              />
              <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-border/40">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(content);
                  }}
                  className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/40 transition-colors"
                  title="Cancel edit"
                  aria-label="Cancel edit"
                >
                  <X size={14} />
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm"
                  title="Save & Submit"
                  aria-label="Save and submit"
                >
                  <Check size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`
                ${isUser
                  ? 'bg-accent-soft rounded-2xl rounded-br-md px-4 py-3'
                  : ''
                }
              `}
            >
              <div className={isUser ? 'text-sm text-ink leading-relaxed whitespace-pre-wrap' : 'text-ink'}>
                {isUser ? content : renderMarkdown(content)}
              </div>
            </div>
          )}

          {/* Source chips for Assistant */}
          {!isUser && sources && sources.length > 0 && (
            <div className="mt-2">
              <SourceChips sources={sources} />
            </div>
          )}

          {/* Actions & Timestamp bar */}
          <div
            className={`
              flex items-center gap-1.5 mt-1.5
              ${isUser ? 'justify-end' : 'justify-start'}
            `}
          >
            {isUser ? (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-muted mr-1">
                  {formatTimestamp(timestamp)}
                </span>

                {/* User Action Icons: visible only on hover */}
                <div className={`flex items-center gap-0.5 transition-opacity duration-150 ${copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <button
                    onClick={handleCopy}
                    className="p-1 rounded-md text-muted hover:text-ink hover:bg-border/40 transition-colors"
                    title={copied ? "Copied!" : "Copy prompt"}
                    aria-label="Copy prompt"
                  >
                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>

                  <button
                    onClick={() => onResend?.(content)}
                    className="p-1 rounded-md text-muted hover:text-ink hover:bg-border/40 transition-colors"
                    title="Re-enter same prompt"
                    aria-label="Re-enter same prompt"
                  >
                    <RotateCcw size={13} />
                  </button>

                  <button
                    onClick={() => {
                      setEditText(content);
                      setIsEditing(true);
                    }}
                    className="p-1 rounded-md text-muted hover:text-ink hover:bg-border/40 transition-colors"
                    title="Edit prompt"
                    aria-label="Edit prompt"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                {/* Assistant Action: Copy Icon with feedback */}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-muted hover:text-ink hover:bg-border/40 transition-colors cursor-pointer text-xs"
                  title={copied ? "Copied to clipboard!" : "Copy response"}
                  aria-label="Copy response"
                >
                  {copied ? (
                    <>
                      <Check size={13} className="text-emerald-500" />
                      <span className="text-[11px] text-emerald-600 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span className="text-[11px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">Copy</span>
                    </>
                  )}
                </button>

                <span className="font-mono text-[11px] text-muted">
                  {formatTimestamp(timestamp)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
