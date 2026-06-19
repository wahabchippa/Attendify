// src/components/AISearch.tsx

import { useState, useRef, useEffect, useCallback } from 'react';
import { Employee } from '../types';
import { getAttendanceRecords } from '../store';
import { processAIQuery } from '../aiSearch';

interface AISearchProps {
  currentUser: Employee;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  { text: "Aaj kaun late aaya?", icon: "⏰" },
  { text: "Sabki summary dikhao", icon: "📊" },
  { text: "Best performer kaun hai?", icon: "🏆" },
  { text: "Aaj kaun absent hai?", icon: "❌" },
  { text: "Hamza ne kitne ghante kaam kia?", icon: "👤" },
  { text: "Kaun WFH pe hai?", icon: "🏠" },
];

const getInitials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

export default function AISearch({ currentUser }: AISearchProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'ai',
      content: `Hello ${currentUser.name}! I'm your Attendify AI Assistant. Ask me anything in English or Urdu.\n\n${
        isAdmin
          ? '🔓 You have **admin access** — you can view all employee data.'
          : '🔒 You can view your **own data** only.'
      }`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mounted, setMounted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = useCallback(async (query?: string) => {
    const text = query || input.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 800));

    const allRecords = getAttendanceRecords();
    const response = processAIQuery(text, allRecords, currentUser.id, isAdmin);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      content: response,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
    inputRef.current?.focus();
  }, [input, isTyping, currentUser.id, isAdmin]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'ai',
        content: '✨ Chat cleared! Ask me anything about attendance.',
        timestamp: new Date(),
      },
    ]);
  }, []);

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      let processedLine = line.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="font-black text-slate-900">$1</strong>'
      );

      if (line.startsWith('•') || line.startsWith('  •')) {
        return (
          <div key={i} className="ml-1 flex items-start gap-2.5 my-1">
            <span className="w-1.5 h-1.5 bg-[#1E40AF] rounded-full mt-2 shrink-0" />
            <span
              dangerouslySetInnerHTML={{
                __html: processedLine.replace(/^•\s*/, '').replace(/^\s*•\s*/, ''),
              }}
            />
          </div>
        );
      }

      if (!processedLine.trim()) return <div key={i} className="h-2" />;

      return (
        <div
          key={i}
          dangerouslySetInnerHTML={{ __html: processedLine }}
          className="my-0.5"
        />
      );
    });
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-180px)] min-h-[500px] font-sans transition-all duration-700 ${
      mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
    }`}>

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] rounded-3xl p-5 mb-5 relative overflow-hidden shadow-xl shadow-blue-900/20">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-indigo-400/20 rounded-full blur-2xl" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">AI Assistant</h2>
              <p className="text-blue-200 text-xs font-bold">Ask anything in English or Urdu</p>
            </div>
          </div>

          <button
            onClick={clearChat}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl text-white/80 hover:text-white text-xs font-bold border border-white/10 transition-all active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Clear
          </button>
        </div>
      </div>

      {/* ===== CHAT AREA ===== */}
      <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-3xl p-5 space-y-4 mb-4 shadow-sm scrollbar-thin">
        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-msg-in`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {/* AI Avatar */}
            {msg.role === 'ai' && (
              <div className="w-8 h-8 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] rounded-xl flex items-center justify-center mr-2.5 mt-1 shrink-0 shadow-md shadow-blue-500/20">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white shadow-lg shadow-blue-600/20'
                  : 'bg-slate-50 text-slate-700 border border-slate-100'
              }`}
            >
              {msg.role === 'ai' && (
                <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-200">
                  <span className="text-[10px] font-black text-[#1E40AF] uppercase tracking-widest">AI Assistant</span>
                </div>
              )}
              <div className="text-sm leading-relaxed font-medium">
                {renderContent(msg.content)}
              </div>
              <div className={`text-right mt-2.5 ${msg.role === 'user' ? '' : 'border-t border-slate-100 pt-2'}`}>
                <span className={`text-[10px] font-bold ${
                  msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                }`}>
                  {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* User Avatar */}
            {msg.role === 'user' && (
              <div className="w-8 h-8 bg-slate-200 rounded-xl flex items-center justify-center ml-2.5 mt-1 shrink-0 text-[10px] font-black text-slate-600">
                {getInitials(currentUser.name)}
              </div>
            )}
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start animate-msg-in">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] rounded-xl flex items-center justify-center mr-2.5 mt-1 shrink-0 shadow-md shadow-blue-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#1E40AF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[#2563EB] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-1.5">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ===== SUGGESTIONS ===== */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SUGGESTIONS.slice(0, isAdmin ? 6 : 3).map((q, i) => (
          <button
            key={i}
            onClick={() => handleSend(q.text)}
            disabled={isTyping}
            className="group flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-[#1E40AF] hover:border-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:shadow-blue-500/10"
          >
            <span className="text-sm group-hover:scale-110 transition-transform">{q.icon}</span>
            {q.text}
          </button>
        ))}
      </div>

      {/* ===== INPUT BAR ===== */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <svg className="w-4.5 h-4.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question here..."
            disabled={isTyping}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 text-slate-800 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
          />
        </div>
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping}
          className="w-12 h-12 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] hover:from-[#1d4ed8] hover:to-[#3b82f6] disabled:from-slate-200 disabled:to-slate-300 rounded-2xl text-white flex items-center justify-center shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 disabled:shadow-none transition-all active:scale-95 shrink-0"
          aria-label="Send message"
        >
          {isTyping ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>

      {/* ===== GLOBAL STYLES ===== */}
      <style>{`
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-msg-in {
          animation: msgIn 0.3s ease-out forwards;
        }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}