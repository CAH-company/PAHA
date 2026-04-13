'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BotMessageSquare, Send, Plus, Trash2, Copy, Check,
  AlertCircle, Loader2, ChevronDown, Paperclip, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  tool?: string;
}

// ─── MARKDOWN-LITE RENDERER ───────────────────────────────────────────────────
function renderContent(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key++} className="bg-bg-muted rounded-lg p-3 overflow-x-auto my-2 border border-border">
          {lang && <div className="text-[10px] text-text-muted mb-2 font-mono uppercase">{lang}</div>}
          <code className="text-xs font-mono text-text-primary whitespace-pre">{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-sm font-bold text-text-primary mt-3 mb-1">{line.slice(4)}</h3>);
      i++; continue;
    }
    // H2
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-sm font-bold text-text-primary mt-4 mb-1.5 border-b border-border pb-1">{line.slice(3)}</h2>);
      i++; continue;
    }
    // H1
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-base font-bold text-text-primary mt-4 mb-2">{line.slice(2)}</h1>);
      i++; continue;
    }

    // Bullet
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="my-1.5 space-y-0.5 pl-4">
          {items.map((item, ii) => (
            <li key={ii} className="text-sm text-text-secondary flex items-start gap-1.5">
              <span className="text-accent mt-1.5 text-[8px]">●</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={key++} className="my-1.5 space-y-0.5 pl-5 list-decimal">
          {items.map((item, ii) => (
            <li key={ii} className="text-sm text-text-secondary">{inlineFormat(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (line === '---' || line === '***') {
      elements.push(<hr key={key++} className="border-border my-3" />);
      i++; continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
      i++; continue;
    }

    // Normal paragraph
    elements.push(
      <p key={key++} className="text-sm text-text-secondary leading-relaxed">
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return elements;
}

function inlineFormat(text: string): React.ReactNode {
  // **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-bg-muted px-1 py-0.5 rounded text-xs font-mono text-accent">{part.slice(1, -1)}</code>;
    return part;
  });
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
function MessageBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const showToolStatus = isStreaming && message.tool && !message.content;
  const showTyping = isStreaming && !message.content && !message.tool;
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser ? 'bg-accent' : 'bg-bg-subtle border border-border'
      )}>
        {isUser
          ? <span className="text-white text-[11px] font-bold">Ty</span>
          : <BotMessageSquare size={13} className="text-accent" />
        }
      </div>

      {/* Content */}
      <div className={cn('max-w-[75%] space-y-1', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'rounded-2xl px-4 py-3',
          isUser
            ? 'bg-accent text-white rounded-tr-sm'
            : 'bg-bg-base border border-border rounded-tl-sm'
        )}>
          {isUser ? (
            <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-sm">
              {/* Animacja pisania — trzy kropki gdy agent jeszcze nie zaczął pisać */}
              {showTyping && (
                <span className="flex items-center gap-1 py-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              )}
              {/* Status narzędzia */}
              {showToolStatus && (
                <span className="flex items-center gap-1.5 text-xs text-text-muted italic">
                  <Loader2 size={11} className="animate-spin" />
                  {message.tool}
                </span>
              )}
              {/* Treść odpowiedzi */}
              {message.content && renderContent(message.content)}
              {/* Kursor streamingu */}
              {isStreaming && message.content && (
                <span className="inline-block w-1.5 h-4 bg-accent/70 rounded-sm animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isStreaming && (
          <div className={cn(
            'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
            isUser ? 'flex-row-reverse' : 'flex-row'
          )}>
            <button onClick={handleCopy}
              className="p-1 rounded hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors">
              {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            </button>
            <span className="text-[10px] text-text-muted">
              {message.createdAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SUGGESTIONS ─────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: '📊', text: 'Podsumuj sytuację finansową firmy w tym miesiącu' },
  { icon: '📋', text: 'Stwórz szablon oferty handlowej dla nowego klienta' },
  { icon: '✅', text: 'Zaplanuj tygodniowy sprint dla zespołu' },
  { icon: '📧', text: 'Napisz email follow-up do potencjalnego klienta' },
];

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noApiKey, setNoApiKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingIdRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    setNoApiKey(false);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date(),
    };

    const assistantId = crypto.randomUUID();
    streamingIdRef.current = assistantId;

    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    // Build history for API (exclude the empty assistant placeholder)
    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (res.status === 422) {
        const data = await res.json();
        if (data.error === 'no_api_key') {
          setNoApiKey(true);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setIsStreaming(false);
          return;
        }
      }

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + parsed.text, tool: undefined } : m
                )
              );
            } else if (parsed.tool) {
              const toolLabels: Record<string, string> = {
                search_crm: 'Przeszukuję CRM...',
                get_emails: 'Sprawdzam emaile...',
                search_drive: 'Przeszukuję Google Drive...',
              };
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, tool: toolLabels[parsed.tool] ?? `Używam: ${parsed.tool}` } : m
                )
              );
            } else if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: `Błąd: ${parsed.error}`, tool: undefined } : m
                )
              );
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setError('Błąd połączenia z agentem. Spróbuj ponownie.');
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      streamingIdRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    setNoApiKey(false);
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-6">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-base flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
            <BotMessageSquare size={16} className="text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Agent AI</h1>
            <p className="text-[10px] text-text-muted">Asystent biznesowy · Claude Sonnet</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-colors"
            >
              <Plus size={12} /> Nowa rozmowa
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <BotMessageSquare size={28} className="text-accent" />
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-1">Agent AI AutomationHub</h2>
            <p className="text-sm text-text-muted max-w-md mb-8">
              Jestem Twoim asystentem biznesowym. Mogę pomagać analizować dane firmy,
              tworzyć dokumenty, planować zadania i odpowiadać na pytania o działalność.
            </p>

            {noApiKey && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 max-w-md text-left">
                <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Brak klucza API</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Dodaj klucz API Anthropic w <strong>Ustawieniach → Integracje</strong>, aby aktywować agenta.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => sendMessage(s.text)}
                  className="flex items-start gap-3 text-left px-4 py-3 rounded-xl bg-bg-base border border-border hover:border-accent/40 hover:bg-accent/5 transition-colors group"
                >
                  <span className="text-lg flex-shrink-0">{s.icon}</span>
                  <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors leading-relaxed">
                    {s.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isStreaming && msg.id === streamingIdRef.current}
              />
            ))}

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-xs">
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* No API key banner (when there are messages) */}
      {noApiKey && messages.length > 0 && (
        <div className="mx-6 mb-2 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Brak klucza API Anthropic. Skonfiguruj go w <strong>Ustawieniach → Integracje</strong>.
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 px-6 pb-6 pt-3 bg-bg-base border-t border-border">
        <div className="max-w-3xl mx-auto">
          <div className={cn(
            'flex items-end gap-3 bg-bg-subtle border rounded-2xl px-4 py-3 transition-colors',
            isStreaming ? 'border-border' : 'border-border hover:border-accent/40 focus-within:border-accent/60'
          )}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Napisz wiadomość… (Enter = wyślij, Shift+Enter = nowa linia)"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted resize-none outline-none leading-relaxed disabled:opacity-50"
              style={{ minHeight: '24px', maxHeight: '160px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
                input.trim() && !isStreaming
                  ? 'bg-accent hover:bg-accent-hover text-white shadow-sm'
                  : 'bg-bg-muted text-text-muted cursor-not-allowed'
              )}
            >
              {isStreaming
                ? <Loader2 size={14} className="animate-spin" />
                : <Send size={14} />
              }
            </button>
          </div>
          <p className="text-[10px] text-text-muted text-center mt-2">
            Agent może popełniać błędy — weryfikuj ważne informacje.
          </p>
        </div>
      </div>
    </div>
  );
}
