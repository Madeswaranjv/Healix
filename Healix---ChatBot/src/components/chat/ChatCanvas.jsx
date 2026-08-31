import { useState, useRef, useEffect } from 'react';
import { Menu } from 'lucide-react';
import EmptyState from './EmptyState';
import MessageList from './MessageList';
import Composer from './Composer';
import DisclaimerStrip from './DisclaimerStrip';
import PulseIndicator from './PulseIndicator';
import IconButton from '../common/IconButton';
import { useStore } from '../../store/useStore';
import { sendChatMessage, streamChatMessage, uploadDocument, analyzeImage, checkBackendHealth } from '../../services/api';

/**
 * Main chat canvas — centered message column, inline-editable title header.
 * Full-bleed canvas background; message column capped at ~760px.
 */
export default function ChatCanvas() {
  const {
    activeUserId,
    loadUserProfile,
    loadUserSessions,
    activeConversationId,
    setActiveConversation,
    addConversation,
    conversations,
    messages,
    setMessages,
    addMessage,
    updateMessage,
    loadSessionMessages,
    createSessionOnBackend,
    isTyping,
    setIsTyping,
    renameConversation,
    setMobileSidebarOpen,
    selectedModel,
    useWebSearch,
    addIndexedDoc,
    backendConnected,
    setBackendConnected,
  } = useStore();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolStatus, setToolStatus] = useState(null);
  const titleInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const tickerRef = useRef(null);
  const currentMsgIdRef = useRef(null);

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = activeConversationId ? (messages[activeConversationId] || []) : [];

  // Check backend health, load profile & sessions on initial mount
  useEffect(() => {
    checkBackendHealth().then((res) => {
      setBackendConnected(!!res);
    });
    loadUserProfile();
    loadUserSessions();
  }, [setBackendConnected, loadUserProfile, loadUserSessions]);

  // When active conversation changes, load its messages from backend if not already present
  useEffect(() => {
    if (activeConversationId && (!messages[activeConversationId] || messages[activeConversationId].length === 0)) {
      loadSessionMessages(activeConversationId);
    }
  }, [activeConversationId, messages, loadSessionMessages]);

  // Auto-focus title input when editing
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  const handleTitleSubmit = () => {
    if (titleValue.trim() && activeConversationId) {
      renameConversation(activeConversationId, titleValue.trim());
    }
    setEditingTitle(false);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (err) {
        console.warn('Abort error:', err);
      }
      abortControllerRef.current = null;
    }
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setIsGenerating(false);
    setIsTyping(false);
    setToolStatus(null);
    if (currentMsgIdRef.current && activeConversationId) {
      updateMessage(activeConversationId, currentMsgIdRef.current, {
        isStreaming: false,
      });
    }
  };

  const handleSendMessage = async (payload) => {
    let text = '';
    let attachments = [];
    setToolStatus(null);

    if (typeof payload === 'string') {
      text = payload.trim();
    } else if (payload && typeof payload === 'object') {
      text = (payload.text || '').trim();
      attachments = payload.attachments || [];
    }

    if (!text && attachments.length === 0) return;

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      targetConvId = `conv-${Date.now()}`;
      const titlePrompt = text || (attachments.length > 0 ? `Analysis: ${attachments[0].name}` : 'Consultation');
      const title = titlePrompt.slice(0, 36) + (titlePrompt.length > 36 ? '...' : '');
      
      const newConv = {
        id: targetConvId,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
      };
      addConversation(newConv);
      setActiveConversation(targetConvId);

      // Async create on backend
      createSessionOnBackend(title, targetConvId);
    } else {
      const currentConv = conversations.find((c) => c.id === targetConvId);
      if (currentConv && (!currentConv.title || currentConv.title === 'New Consultation' || currentConv.title === 'Untitled consultation')) {
        const titlePrompt = text || (attachments.length > 0 ? `Analysis: ${attachments[0].name}` : 'Consultation');
        const title = titlePrompt.slice(0, 36) + (titlePrompt.length > 36 ? '...' : '');
        renameConversation(targetConvId, title);
      }
    }

    // Process attachments for rich visual rendering
    const processedAttachments = attachments.map((a) => ({
      id: a.id || Math.random().toString(36).substring(2, 9),
      name: a.name,
      type: a.type,
      isImage: a.isImage || (a.file && a.file.type && a.file.type.startsWith('image/')),
      url: a.url || (a.file ? URL.createObjectURL(a.file) : null),
    }));

    // Add user message to local state with rich attachments
    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text || '',
      attachments: processedAttachments,
      timestamp: Date.now(),
    };
    addMessage(targetConvId, userMsg);
    setIsTyping(true);
    setIsGenerating(true);

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    try {
      // 1. Process document uploads (PDF, DOCX, TXT)
      const docAttachments = attachments.filter((a) => !a.isImage && a.file);
      for (const doc of docAttachments) {
        try {
          const uploadRes = await uploadDocument(doc.file, targetConvId, activeUserId);
          addIndexedDoc(targetConvId, {
            filename: doc.name,
            chunks: uploadRes.chunks_count || 0,
          });
        } catch (uploadErr) {
          console.warn(`Failed to index document ${doc.name}:`, uploadErr);
        }
      }

      // 2. Process image attachments with Vision API
      const imageAttachments = attachments.filter((a) => a.isImage && a.file);
      if (imageAttachments.length > 0) {
        for (const img of imageAttachments) {
          const visionRes = await analyzeImage(img.file, text || "Please analyze this medical image.", targetConvId, activeUserId);
          const assistantMsg = {
            id: `msg-${Date.now()}-vis`,
            role: 'assistant',
            content: visionRes.answer || visionRes.detail || "Image analysis completed.",
            timestamp: Date.now(),
            sources: [
              { id: 'img-1', title: `Vision Analysis: ${img.name}`, type: 'document' },
            ],
          };
          addMessage(targetConvId, assistantMsg);
        }
        setIsTyping(false);
        setIsGenerating(false);
        setBackendConnected(true);
        return;
      }

      // 3. Real-Time Word-by-Word Streaming Chat / RAG query with User Context
      const chatQuery = text || "Please summarize the attached document.";
      const asstMsgId = `msg-${Date.now()}-stream`;
      currentMsgIdRef.current = asstMsgId;

      let hasStarted = false;
      let displayedContent = '';
      let pendingBuffer = '';
      let isNetworkDone = false;
      let finalMessageId = null;
      let metadataObj = { sources: [], isEmergency: false, chunksUsed: 0 };

      // Word-by-word progressive rendering ticker
      const startDrainTicker = () => {
        if (tickerRef.current) return;
        tickerRef.current = setInterval(() => {
          if (pendingBuffer.length > 0) {
            let takeLen = 0;
            const backlog = pendingBuffer.length;
            const wordsToTake = backlog > 80 ? 3 : backlog > 30 ? 2 : 1;

            let wordCount = 0;
            for (let i = 0; i < pendingBuffer.length; i++) {
              if (pendingBuffer[i] === ' ' || pendingBuffer[i] === '\n') {
                wordCount++;
                if (wordCount >= wordsToTake) {
                  takeLen = i + 1;
                  break;
                }
              }
            }

            if (takeLen === 0) {
              takeLen = isNetworkDone ? pendingBuffer.length : Math.min(3, pendingBuffer.length);
            }

            const nextSlice = pendingBuffer.slice(0, takeLen);
            pendingBuffer = pendingBuffer.slice(takeLen);
            displayedContent += nextSlice;

            if (!hasStarted) {
              hasStarted = true;
              setIsTyping(false);
              addMessage(targetConvId, {
                id: asstMsgId,
                role: 'assistant',
                content: displayedContent,
                isStreaming: true,
                sources: metadataObj.sources,
                isEmergency: metadataObj.isEmergency,
                timestamp: Date.now(),
              });
            } else {
              updateMessage(targetConvId, asstMsgId, {
                content: displayedContent,
                sources: metadataObj.sources,
                isEmergency: metadataObj.isEmergency,
              });
            }
          } else if (isNetworkDone) {
            // Finished draining all text
            if (tickerRef.current) {
              clearInterval(tickerRef.current);
              tickerRef.current = null;
            }
            setIsTyping(false);
            setIsGenerating(false);
            updateMessage(targetConvId, asstMsgId, {
              id: finalMessageId || asstMsgId,
              content: displayedContent,
              isStreaming: false,
              sources: metadataObj.sources,
              isEmergency: metadataObj.isEmergency,
            });
            setBackendConnected(true);
          }
        }, 22);
      };

      await streamChatMessage({
        sessionId: targetConvId,
        userId: activeUserId,
        message: chatQuery,
        useWebSearch,
        model: selectedModel,
        signal: abortCtrl.signal,
        onMetadata: (meta) => {
          metadataObj = { ...metadataObj, ...meta };
        },
        onToolCall: (tc) => {
          setToolStatus({ type: 'tool_call', ...tc });
        },
        onToolResult: (tr) => {
          setToolStatus({ type: 'tool_result', ...tr });
          if (tr.sources && tr.sources.length > 0) {
            metadataObj.sources = [...metadataObj.sources, ...tr.sources];
            if (hasStarted) {
              updateMessage(targetConvId, asstMsgId, {
                sources: metadataObj.sources,
              });
            }
          }
        },
        onDelta: (chunk) => {
          pendingBuffer += chunk;
          startDrainTicker();
        },
        onDone: ({ messageId }) => {
          finalMessageId = messageId;
          isNetworkDone = true;
          setToolStatus(null);
          startDrainTicker();
        },
        onError: (err) => {
          setToolStatus(null);
          if (err.name === 'AbortError') {
            console.log('Stream stopped by user.');
            return;
          }
          console.error('Streaming Chat Error:', err);
          if (tickerRef.current) {
            clearInterval(tickerRef.current);
            tickerRef.current = null;
          }
          setBackendConnected(false);
          setIsTyping(false);
          setIsGenerating(false);

          if (!hasStarted) {
            const errorMessage = {
              id: `msg-${Date.now()}-err`,
              role: 'assistant',
              content: `**Connection Error:** Unable to reach the Healix backend at \`http://localhost:8000\`.\n\n*Error details: ${err.message}*\n\nPlease make sure your FastAPI backend is running and that your OpenRouter API key is configured in \`backend/.env\`.`,
              timestamp: Date.now(),
              sources: [],
            };
            addMessage(targetConvId, errorMessage);
          }
        },
      });

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Chat General Error:', err);
        setBackendConnected(false);
      }
      setIsTyping(false);
      setIsGenerating(false);
    } finally {
      // Keep isGenerating true if still draining buffer, otherwise false
      if (!tickerRef.current) {
        setIsTyping(false);
        setIsGenerating(false);
      }
    }
  };

  const handlePromptSelect = (prompt) => {
    const targetConvId = `conv-${Date.now()}`;
    const newConv = {
      id: targetConvId,
      title: prompt.slice(0, 40),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    };
    addConversation(newConv);
    setActiveConversation(targetConvId);
    createSessionOnBackend(newConv.title, targetConvId);

    // Send prompt
    setTimeout(() => handleSendMessage(prompt), 100);
  };

  const handleEditAndResend = (msgId, newText) => {
    if (!newText || !newText.trim()) return;
    if (activeConversationId && msgId) {
      updateMessage(activeConversationId, msgId, { content: newText });
    }
    handleSendMessage(newText);
  };

  return (
    <div className="flex-1 flex flex-col bg-canvas h-[100dvh] max-h-[100dvh] overflow-hidden">
      {/* Header — minimal single row with editable title */}
      <header className="flex-shrink-0 z-20 bg-canvas/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-[760px] mx-auto px-3 sm:px-4 lg:px-0 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3">
          {/* Mobile menu button */}
          <div className="lg:hidden">
            <IconButton
              icon={Menu}
              label="Open menu"
              onClick={() => setMobileSidebarOpen(true)}
            />
          </div>

          {!activeConversationId ? (
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Healix" className="w-5 h-5 object-contain" />
              <span className="text-base font-semibold text-ink tracking-tight">New Consultation</span>
            </div>
          ) : editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              className="
                flex-1 text-base font-semibold text-ink
                bg-transparent border-b-2 border-primary
                focus:outline-none
                py-0.5
              "
              aria-label="Edit conversation title"
            />
          ) : (
            <button
              onClick={() => {
                setTitleValue(activeConv?.title || '');
                setEditingTitle(true);
              }}
              className="
                text-base font-semibold text-ink
                text-left hover:text-primary
                transition-colors duration-150
                truncate
              "
              title="Click to edit title"
            >
              {activeConv?.title || 'Untitled consultation'}
            </button>
          )}
        </div>
      </header>

      {/* Scrollable messages area — ONLY this container scrolls */}
      <main className="flex-1 overflow-y-auto min-h-0 relative">
        <div className="max-w-[760px] w-full mx-auto px-3 sm:px-4 lg:px-0 flex flex-col min-h-full">
          {activeMessages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8 sm:py-12">
              <EmptyState onPromptSelect={handlePromptSelect} />
            </div>
          ) : (
            <div className="flex-1 py-3 sm:py-4">
              <MessageList
                messages={activeMessages}
                onResend={handleSendMessage}
                onEdit={handleEditAndResend}
              />
              {/* Pulse-line typing indicator inside scrollable chat so it flows under the latest message */}
              {isTyping && (
                <div className="py-2">
                  <PulseIndicator isWebSearch={useWebSearch} toolStatus={toolStatus} />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Fixed / Pinned Input Area — ALWAYS present at bottom */}
      <footer className="flex-shrink-0 z-20 bg-canvas/95 backdrop-blur-md border-t border-border/40 pt-2.5 pb-3 sm:pt-3 sm:pb-4">
        <div className="max-w-[760px] w-full mx-auto px-3 sm:px-4 lg:px-0">
          <Composer
            onSend={handleSendMessage}
            onStop={handleStop}
            isGenerating={isGenerating}
          />
          {/* Disclaimer — only visible on a new chat before prompts are entered */}
          {activeMessages.length === 0 && <DisclaimerStrip />}
        </div>
      </footer>
    </div>
  );
}

