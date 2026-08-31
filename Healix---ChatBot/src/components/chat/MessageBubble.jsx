import { useState } from 'react';
import { Copy, Check, RotateCcw, Pencil, X, FileText, ExternalLink, ThumbsUp, Share2 } from 'lucide-react';
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
  const [liked, setLiked] = useState(false);
  const [shared, setShared] = useState(false);
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

  const handleLike = () => {
    setLiked((prev) => !prev);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Healix Health Consultation',
          text: content,
        });
      } else {
        await navigator.clipboard.writeText(content);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(content);
          setShared(true);
          setTimeout(() => setShared(false), 2000);
        } catch (copyErr) {
          console.warn('Share copy fallback failed:', copyErr);
        }
      }
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
                  ? 'bg-accent-soft rounded-2xl rounded-br-md p-3 sm:px-4 sm:py-3'
                  : ''
                }
              `}
            >
              {/* User Attachments Preview (Rendered visually ABOVE the text) */}
              {isUser && message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {message.attachments.map((att, idx) => {
                    const isImg = att.isImage || (att.url && /\.(jpe?g|png|gif|webp|svg|bmp)/i.test(att.name || att.url));
                    return isImg ? (
                      <div
                        key={att.id || idx}
                        className="
                          relative rounded-xl overflow-hidden
                          border border-border/70 bg-surface/90
                          shadow-sm group/img cursor-pointer
                          max-w-[280px] max-h-[220px]
                        "
                        onClick={() => att.url && window.open(att.url, '_blank')}
                        title="Click to view full image"
                      >
                        <img
                          src={att.url}
                          alt={att.name || 'Attached Image'}
                          className="w-full h-full object-cover max-h-[200px] rounded-xl transition-transform duration-200 group-hover/img:scale-[1.02]"
                        />
                        {att.name && (
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 text-[10px] truncate flex items-center justify-between">
                            <span className="truncate">{att.name}</span>
                            <ExternalLink size={10} className="ml-1 opacity-80 flex-shrink-0" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        key={att.id || idx}
                        className="
                          flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                          bg-surface border border-border text-xs text-ink font-medium shadow-sm
                        "
                      >
                        <FileText size={14} className="text-primary flex-shrink-0" />
                        <span className="truncate max-w-[200px]">{att.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* User prompt text or Assistant formatted content */}
              {isUser ? (
                (() => {
                  let userText = content || '';
                  if (message.attachments && message.attachments.length > 0) {
                    userText = userText
                      .replace(/\n*\*Attached:\s*📎[^*]*\*/gi, '')
                      .replace(/\n*\*Attached files:[^*]*\*/gi, '')
                      .trim();
                  }
                  return userText ? (
                    <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                      {userText}
                    </div>
                  ) : null;
                })()
              ) : (
                <div className="text-ink">
                  {renderMarkdown(content)}
                </div>
              )}
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

                {/* User Action Icons: visible on mobile touch, visible on hover on desktop */}
                <div className={`flex items-center gap-0.5 transition-opacity duration-150 ${copied ? 'opacity-100' : 'opacity-80 sm:opacity-0 sm:group-hover:opacity-100'}`}>
                  <button
                    onClick={handleCopy}
                    className="relative group/btn p-1 rounded-md text-muted hover:text-ink hover:bg-border/40 transition-colors"
                    aria-label="Copy prompt"
                  >
                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span className="
                      absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2
                      px-2 py-0.5 rounded-md
                      bg-ink text-canvas text-[10px] font-medium
                      shadow-md pointer-events-none whitespace-nowrap
                      opacity-0 translate-y-1 group-hover/btn:opacity-100 group-hover/btn:translate-y-0
                      transition-all duration-150 z-30
                    ">
                      {copied ? 'Copied!' : 'Copy'}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-ink" />
                    </span>
                  </button>

                  <button
                    onClick={() => onResend?.(content)}
                    className="relative group/btn p-1 rounded-md text-muted hover:text-ink hover:bg-border/40 transition-colors"
                    aria-label="Re-enter same prompt"
                  >
                    <RotateCcw size={13} />
                    <span className="
                      absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2
                      px-2 py-0.5 rounded-md
                      bg-ink text-canvas text-[10px] font-medium
                      shadow-md pointer-events-none whitespace-nowrap
                      opacity-0 translate-y-1 group-hover/btn:opacity-100 group-hover/btn:translate-y-0
                      transition-all duration-150 z-30
                    ">
                      Retry
                      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-ink" />
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setEditText(content);
                      setIsEditing(true);
                    }}
                    className="relative group/btn p-1 rounded-md text-muted hover:text-ink hover:bg-border/40 transition-colors"
                    aria-label="Edit prompt"
                  >
                    <Pencil size={13} />
                    <span className="
                      absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2
                      px-2 py-0.5 rounded-md
                      bg-ink text-canvas text-[10px] font-medium
                      shadow-md pointer-events-none whitespace-nowrap
                      opacity-0 translate-y-1 group-hover/btn:opacity-100 group-hover/btn:translate-y-0
                      transition-all duration-150 z-30
                    ">
                      Edit
                      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-ink" />
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-1.5">
                {/* Assistant Action: Copy Button with floating tooltip */}
                <button
                  onClick={handleCopy}
                  className="relative group/btn p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/40 transition-colors cursor-pointer flex items-center justify-center"
                  aria-label="Copy response"
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span className="
                    absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2
                    px-2 py-0.5 rounded-md
                    bg-ink text-canvas text-[10px] font-medium
                    shadow-md pointer-events-none whitespace-nowrap
                    opacity-0 translate-y-1 group-hover/btn:opacity-100 group-hover/btn:translate-y-0
                    transition-all duration-150 z-30
                  ">
                    {copied ? 'Copied!' : 'Copy'}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-ink" />
                  </span>
                </button>

                {/* Assistant Action: Like Button with floating tooltip */}
                <button
                  onClick={handleLike}
                  className={`
                    relative group/btn p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center
                    ${liked
                      ? 'text-primary bg-primary/10'
                      : 'text-muted hover:text-ink hover:bg-border/40'
                    }
                  `}
                  aria-label="Like response"
                >
                  <ThumbsUp size={13} className={liked ? "fill-primary text-primary" : ""} />
                  <span className="
                    absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2
                    px-2 py-0.5 rounded-md
                    bg-ink text-canvas text-[10px] font-medium
                    shadow-md pointer-events-none whitespace-nowrap
                    opacity-0 translate-y-1 group-hover/btn:opacity-100 group-hover/btn:translate-y-0
                    transition-all duration-150 z-30
                  ">
                    {liked ? 'Liked' : 'Like'}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-ink" />
                  </span>
                </button>

                {/* Assistant Action: Share Button with floating tooltip */}
                <button
                  onClick={handleShare}
                  className="relative group/btn p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/40 transition-colors cursor-pointer flex items-center justify-center"
                  aria-label="Share response"
                >
                  {shared ? <Check size={13} className="text-emerald-500" /> : <Share2 size={13} />}
                  <span className="
                    absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2
                    px-2 py-0.5 rounded-md
                    bg-ink text-canvas text-[10px] font-medium
                    shadow-md pointer-events-none whitespace-nowrap
                    opacity-0 translate-y-1 group-hover/btn:opacity-100 group-hover/btn:translate-y-0
                    transition-all duration-150 z-30
                  ">
                    {shared ? 'Shared!' : 'Share'}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-ink" />
                  </span>
                </button>

                <span className="font-mono text-[11px] text-muted ml-1.5">
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
