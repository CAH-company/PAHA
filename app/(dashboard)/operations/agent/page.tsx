'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BotMessageSquare, Send, Plus, Copy, Check,
  AlertCircle, Loader2, Paperclip, X, FileText, FileSpreadsheet, Image,
  MessageSquare, ChevronLeft, Trash2, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface AttachedFile {
  name: string;
  type: string;
  data: string;
  size: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string; // ISO string for serialization
  tool?: string;
  files?: AttachedFile[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'agent_conversations';
const MAX_CONVERSATIONS = 50;

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convos: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, MAX_CONVERSATIONS)));
  } catch {}
}

function makeTitle(firstUserMessage: string): string {
  return firstUserMessage.trim().slice(0, 45) + (firstUserMessage.length > 45 ? '…' : '');
}

function groupByDate(convos: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const groups: Record<string, Conversation[]> = { Dziś: [], Wczoraj: [], 'Ten tydzień': [], Wcześniej: [] };
  for (const c of convos) {
    const d = new Date(c.updatedAt);
    const ds = d.toDateString();
    if (ds === today) groups['Dziś'].push(c);
    else if (ds === yesterday) groups['Wczoraj'].push(c);
    else if (d >= weekAgo) groups['Ten tydzień'].push(c);
    else groups['Wcześniej'].push(c);
  }
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

// ─── MARKDOWN-LITE RENDERER ───────────────────────────────────────────────────

function inlineFormat(text: string): React.ReactNode {
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

function renderContent(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0, key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(
        <pre key={key++} className="bg-bg-muted rounded-lg p-3 overflow-x-auto my-2 border border-border">
          {lang && <div className="text-[10px] text-text-muted mb-2 font-mono uppercase">{lang}</div>}
          <code className="text-xs font-mono text-text-primary whitespace-pre">{codeLines.join('\n')}</code>
        </pre>
      );
      i++; continue;
    }
    if (line.startsWith('### ')) { elements.push(<h3 key={key++} className="text-sm font-bold text-text-primary mt-3 mb-1">{line.slice(4)}</h3>); i++; continue; }
    if (line.startsWith('## ')) { elements.push(<h2 key={key++} className="text-sm font-bold text-text-primary mt-4 mb-1.5 border-b border-border pb-1">{line.slice(3)}</h2>); i++; continue; }
    if (line.startsWith('# ')) { elements.push(<h1 key={key++} className="text-base font-bold text-text-primary mt-4 mb-2">{line.slice(2)}</h1>); i++; continue; }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) { items.push(lines[i].slice(2)); i++; }
      elements.push(<ul key={key++} className="my-1.5 space-y-0.5 pl-4">{items.map((item, ii) => <li key={ii} className="text-sm text-text-secondary flex items-start gap-1.5"><span className="text-accent mt-1.5 text-[8px]">●</span><span>{inlineFormat(item)}</span></li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++; }
      elements.push(<ol key={key++} className="my-1.5 space-y-0.5 pl-5 list-decimal">{items.map((item, ii) => <li key={ii} className="text-sm text-text-secondary">{inlineFormat(item)}</li>)}</ol>);
      continue;
    }
    if (line === '---' || line === '***') { elements.push(<hr key={key++} className="border-border my-3" />); i++; continue; }
    if (line.trim() === '') { elements.push(<div key={key++} className="h-2" />); i++; continue; }
    elements.push(<p key={key++} className="text-sm text-text-secondary leading-relaxed">{inlineFormat(line)}</p>);
    i++;
  }
  return elements;
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────

function fileIcon(type: string, name: string) {
  if (type.startsWith('image/')) return <Image size={12} />;
  if (type.includes('pdf')) return <FileText size={12} />;
  if (type.includes('sheet') || type.includes('excel') || name.endsWith('.csv')) return <FileSpreadsheet size={12} />;
  return <FileText size={12} />;
}

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const showToolStatus = isStreaming && message.tool && !message.content;
  const showTyping = isStreaming && !message.content && !message.tool;
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', isUser ? 'bg-accent' : 'bg-bg-subtle border border-border')}>
        {isUser ? <span className="text-white text-[11px] font-bold">Ty</span> : <BotMessageSquare size={13} className="text-accent" />}
      </div>
      <div className={cn('max-w-[75%] space-y-1', isUser ? 'items-end' : 'items-start')}>
        <div className={cn('rounded-2xl px-4 py-3', isUser ? 'bg-accent text-white rounded-tr-sm' : 'bg-bg-base border border-border rounded-tl-sm')}>
          {isUser ? (
            <div className="space-y-2">
              {message.files && message.files.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {message.files.map((f, i) => (
                    <span key={i} className="flex items-center gap-1 bg-white/20 rounded-md px-2 py-1 text-[11px] text-white/90">
                      {fileIcon(f.type, f.name)}<span className="max-w-[120px] truncate">{f.name}</span>
                    </span>
                  ))}
                </div>
              )}
              {message.content && <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{message.content}</p>}
            </div>
          ) : (
            <div className="prose-sm">
              {showTyping && <span className="flex items-center gap-1 py-1"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>}
              {showToolStatus && <span className="flex items-center gap-1.5 text-xs text-text-muted italic"><Loader2 size={11} className="animate-spin" />{message.tool}</span>}
              {message.content && renderContent(message.content)}
              {isStreaming && message.content && <span className="inline-block w-1.5 h-4 bg-accent/70 rounded-sm animate-pulse ml-0.5 align-middle" />}
            </div>
          )}
        </div>
        {!isStreaming && (
          <div className={cn('flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity', isUser ? 'flex-row-reverse' : 'flex-row')}>
            <button onClick={() => { navigator.clipboard.writeText(message.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
              className="p-1 rounded hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors">
              {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            </button>
            <span className="text-[10px] text-text-muted">
              {new Date(message.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
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

const ACCEPTED = '.pdf,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp';

// ─── HISTORY SIDEBAR ──────────────────────────────────────────────────────────

function HistorySidebar({
  conversations, activeId, onSelect, onNew, onDelete, collapsed, onToggle,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const groups = groupByDate(conversations);

  return (
    <div className={cn(
      'flex flex-col border-r border-border bg-bg-subtle transition-all duration-200 flex-shrink-0',
      collapsed ? 'w-12' : 'w-64'
    )}>
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        {!collapsed && (
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Historia</span>
        )}
        <button onClick={onToggle}
          className={cn('w-6 h-6 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors', collapsed && 'mx-auto')}>
          <ChevronLeft size={14} className={cn('transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* New conversation */}
      <div className="px-2 py-2 border-b border-border">
        <button onClick={onNew}
          className={cn(
            'w-full flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors',
            collapsed && 'justify-center'
          )}>
          <Plus size={13} className="flex-shrink-0 text-accent" />
          {!collapsed && <span>Nowa rozmowa</span>}
        </button>
      </div>

      {/* Conversation list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto py-2">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Clock size={20} className="text-text-muted mb-2" />
              <p className="text-xs text-text-muted">Brak historii rozmów</p>
            </div>
          ) : (
            groups.map(({ label, items }) => (
              <div key={label} className="mb-3">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 py-1">{label}</p>
                {items.map(c => (
                  <div key={c.id}
                    className={cn(
                      'group flex items-center gap-2 mx-2 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                      activeId === c.id ? 'bg-accent/10 text-accent' : 'hover:bg-bg-base text-text-secondary hover:text-text-primary'
                    )}
                    onClick={() => onSelect(c.id)}>
                    <MessageSquare size={12} className="flex-shrink-0 opacity-60" />
                    <span className="text-xs flex-1 truncate leading-snug">{c.title}</span>
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(c.id); }}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-500 transition-all flex-shrink-0 p-0.5 rounded">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Collapsed: icon only list */}
      {collapsed && (
        <div className="flex-1 overflow-y-auto py-2 flex flex-col items-center gap-1">
          {conversations.slice(0, 20).map(c => (
            <button key={c.id} onClick={() => onSelect(c.id)} title={c.title}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                activeId === c.id ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary hover:bg-bg-base'
              )}>
              <MessageSquare size={13} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noApiKey, setNoApiKey] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingIdRef = useRef<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const convos = loadConversations();
    setConversations(convos);
  }, []);

  // Persist whenever conversations change
  const persistConversations = useCallback((convos: Conversation[]) => {
    setConversations(convos);
    saveConversations(convos);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const loaded: AttachedFile[] = await Promise.all(picked.map(f => new Promise<AttachedFile>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ name: f.name, type: f.type, data: base64, size: f.size });
      };
      reader.readAsDataURL(f);
    })));
    setFiles(prev => [...prev, ...loaded]);
    e.target.value = '';
  }

  const startNewConversation = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setFiles([]);
    setError(null);
    setNoApiKey(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const selectConversation = useCallback((id: string) => {
    const convo = conversations.find(c => c.id === id);
    if (!convo) return;
    setActiveId(id);
    setMessages(convo.messages);
    setError(null);
    setNoApiKey(false);
  }, [conversations]);

  const deleteConversation = useCallback((id: string) => {
    const updated = conversations.filter(c => c.id !== id);
    persistConversations(updated);
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }, [conversations, activeId, persistConversations]);

  const sendMessage = useCallback(async (text: string, attachedFiles?: AttachedFile[]) => {
    const trimmed = text.trim();
    const filesToSend = attachedFiles ?? files;
    if ((!trimmed && !filesToSend.length) || isStreaming) return;

    setError(null);
    setNoApiKey(false);

    const now = new Date().toISOString();
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: now,
      files: filesToSend.length > 0 ? filesToSend : undefined,
    };

    const assistantId = crypto.randomUUID();
    streamingIdRef.current = assistantId;

    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);
    setInput('');
    setFiles([]);
    setIsStreaming(true);

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content, files: m.files }));

    let finalContent = '';

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
          setMessages(prev => prev.filter(m => m.id !== assistantId));
          setIsStreaming(false);
          return;
        }
      }

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

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
              finalContent += parsed.text;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: m.content + parsed.text, tool: undefined } : m)
              );
            } else if (parsed.tool) {
              const toolLabels: Record<string, string> = {
                search_crm: 'Przeszukuję CRM...',
                get_emails: 'Sprawdzam emaile...',
                create_task: 'Tworzę zadanie...',
              };
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, tool: toolLabels[parsed.tool] ?? `Używam: ${parsed.tool}` } : m)
              );
            }
          } catch {}
        }
      }
    } catch {
      setError('Błąd połączenia z agentem. Spróbuj ponownie.');
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      streamingIdRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);

      // Save conversation to history
      if (finalContent) {
        const completedAssistantMsg: Message = {
          id: assistantId,
          role: 'assistant',
          content: finalContent,
          createdAt: new Date().toISOString(),
        };
        const finalMessages = [...messages, userMsg, completedAssistantMsg];
        const updatedAt = new Date().toISOString();

        setConversations(prev => {
          let updated: Conversation[];
          if (activeId) {
            updated = prev.map(c =>
              c.id === activeId ? { ...c, messages: finalMessages, updatedAt } : c
            );
          } else {
            const newConvo: Conversation = {
              id: crypto.randomUUID(),
              title: makeTitle(trimmed || 'Nowa rozmowa'),
              messages: finalMessages,
              createdAt: updatedAt,
              updatedAt,
            };
            setActiveId(newConvo.id);
            updated = [newConvo, ...prev];
          }
          saveConversations(updated);
          return updated;
        });
      }
    }
  }, [messages, isStreaming, files, activeId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-6 overflow-hidden">

      {/* History sidebar */}
      <HistorySidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNew={startNewConversation}
        onDelete={deleteConversation}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v => !v)}
      />

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-base flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
              <BotMessageSquare size={16} className="text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text-primary">
                {activeId ? (conversations.find(c => c.id === activeId)?.title ?? 'Agent AI') : 'Agent AI'}
              </h1>
              <p className="text-[10px] text-text-muted">Asystent biznesowy · Claude Sonnet</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button onClick={startNewConversation}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-colors">
              <Plus size={12} /> Nowa rozmowa
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
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
                    <p className="text-xs text-amber-700 mt-0.5">Dodaj klucz API Anthropic w <strong>Ustawieniach → Integracje</strong>.</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map(s => (
                  <button key={s.text} onClick={() => sendMessage(s.text)}
                    className="flex items-start gap-3 text-left px-4 py-3 rounded-xl bg-bg-base border border-border hover:border-accent/40 hover:bg-accent/5 transition-colors group">
                    <span className="text-lg flex-shrink-0">{s.icon}</span>
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors leading-relaxed">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} isStreaming={isStreaming && msg.id === streamingIdRef.current} />
              ))}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-xs">
                  <AlertCircle size={13} />{error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* No API key banner */}
        {noApiKey && messages.length > 0 && (
          <div className="mx-6 mb-2 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">Brak klucza API Anthropic. Skonfiguruj go w <strong>Ustawieniach → Integracje</strong>.</p>
          </div>
        )}

        {/* Input */}
        <div className="flex-shrink-0 px-6 pb-6 pt-3 bg-bg-base border-t border-border">
          <div className="max-w-3xl mx-auto space-y-2">
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-accent/10 border border-accent/20 rounded-lg px-2.5 py-1.5 text-xs text-accent">
                    {fileIcon(f.type, f.name)}<span className="max-w-[140px] truncate">{f.name}</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500 transition-colors ml-0.5"><X size={11} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className={cn('flex items-end gap-2 bg-bg-subtle border rounded-2xl px-3 py-3 transition-colors', isStreaming ? 'border-border' : 'border-border hover:border-accent/40 focus-within:border-accent/60')}>
              <input ref={fileInputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={handleFiles} />
              <button onClick={() => fileInputRef.current?.click()} disabled={isStreaming}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-text-muted hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-30" title="Załącz plik">
                <Paperclip size={15} />
              </button>
              <textarea ref={inputRef} value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
                onKeyDown={handleKeyDown}
                placeholder="Napisz wiadomość… (Enter = wyślij, Shift+Enter = nowa linia)"
                rows={1} disabled={isStreaming}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted resize-none outline-none leading-relaxed disabled:opacity-50"
                style={{ minHeight: '24px', maxHeight: '160px' }}
              />
              <button onClick={() => sendMessage(input)} disabled={(!input.trim() && !files.length) || isStreaming}
                className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
                  (input.trim() || files.length) && !isStreaming ? 'bg-accent hover:bg-accent-hover text-white shadow-sm' : 'bg-bg-muted text-text-muted cursor-not-allowed')}>
                {isStreaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-text-muted text-center">PDF, Excel, CSV, obrazy · Agent może popełniać błędy — weryfikuj ważne informacje.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
