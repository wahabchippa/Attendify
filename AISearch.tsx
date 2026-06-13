import { useState, useRef, useEffect } from 'react';
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
  "Aaj kaun late aaya?",
  "Sabki attendance summary",
  "Best performer kaun hai?",
  "Aaj kaun absent hai?",
  "Hamza ne kitne ghante kaam kia?",
  "Kaun WFH pe hai?",
];

export default function AISearch({ currentUser }: AISearchProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'ai',
      content: `Hello ${currentUser.name}! I'm your AI Attendance Assistant. Ask me anything about attendance records in English or Urdu.\n\n${
        isAdmin
          ? 'You have admin access - you can view all employee data.'
          : 'You can view your own attendance data.'
      }`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (query?: string) => {
    const text = query || input.trim();
    if (!text) return;

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
    let response: string;
    
    if (!isAdmin) {
      const selfRecords = allRecords.filter(r => r.employeeId === currentUser.id);
      response = processAIQuery(text, selfRecords);
    } else {
      response = processAIQuery(text, allRecords);
    }

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      content: response,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'ai',
        content: 'Chat cleared! Ask me anything about attendance.',
        timestamp: new Date(),
      },
    ]);
  };

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      let processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
      
      if (line.startsWith('•') || line.startsWith('  •')) {
        return (
          <div key={i} className="ml-3 flex items-start gap-2 my-0.5">
            <span className="text-blue-500 mt-1">•</span>
            <span dangerouslySetInnerHTML={{ __html: processedLine.replace(/^•\s*/, '').replace(/^\s*•\s*/, '') }} />
          </div>
        );
      }

      return <div key={i} dangerouslySetInnerHTML={{ __html: processedLine }} className="my-0.5" />;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">AI Assistant</h2>
          <p className="text-slate-500 text-sm">Ask about attendance in English or Urdu</p>
        </div>
        <button
          onClick={clearChat}
          className="px-3 py-2 bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 text-sm transition-colors"
        >
          Clear Chat
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-xl p-4 space-y-4 mb-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {msg.role === 'ai' && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs">🤖</span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">AI Assistant</span>
                </div>
              )}
              <div className="text-sm leading-relaxed">
                {renderContent(msg.content)}
              </div>
              <div className="text-right mt-2">
                <span className={`text-[10px] ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SUGGESTIONS.slice(0, isAdmin ? 6 : 3).map((q, i) => (
          <button
            key={i}
            onClick={() => handleSend(q)}
            className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your question here..."
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 rounded-xl text-white font-medium transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
