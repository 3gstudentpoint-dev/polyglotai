import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe2, 
  Settings, 
  Plus, 
  MessageSquare, 
  ChevronRight, 
  Sparkles,
  Trash2,
  Download,
  Share2,
  Zap,
  Brain,
  Palette,
  Search,
  Check,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { SettingsModal, AppSettings } from './components/SettingsModal';
import { generateAIResponseStream, generateImage } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Message } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'auto',
  personality: 'fast',
  voice: 'Kore',
  autoSpeak: false,
};

type AIMode = 'fast' | 'reasoning' | 'image' | 'search';

interface ModeOption {
  id: AIMode;
  title: string;
  badge: string;
  icon: React.ReactNode;
  description: string;
}

const AI_MODES: ModeOption[] = [
  {
    id: 'fast',
    title: 'Polyglot Fast',
    badge: 'Lightning Speed',
    icon: <Zap size={15} className="text-amber-400" />,
    description: 'Ultra-fast multilingual responses and daily assistance'
  },
  {
    id: 'reasoning',
    title: 'Deep Problem Solver',
    badge: 'High Accuracy',
    icon: <Brain size={15} className="text-emerald-400" />,
    description: 'Detailed step-by-step logic, math, STEM & code solutions'
  },
  {
    id: 'image',
    title: 'Visual Studio',
    badge: 'Art & Design',
    icon: <Palette size={15} className="text-purple-400" />,
    description: 'Generate creative vector illustrations and artwork'
  },
  {
    id: 'search',
    title: 'Live Web Grounding',
    badge: 'Real-time Info',
    icon: <Search size={15} className="text-blue-400" />,
    description: 'Verified real-time information with Google Search'
  }
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<AIMode>('fast');
  const [copiedExport, setCopiedExport] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('polyglot_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const userId = "demo-user";

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('polyglot_settings', JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/history/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const saveToHistory = async (message: string, response: string) => {
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          message,
          response,
          language: settings.language
        })
      });
      fetchHistory();
    } catch (err) {
      console.error("Failed to save history", err);
    }
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await fetch(`/api/history/${id}`, { method: 'DELETE' });
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error("Failed to delete history item", err);
    }
  };

  const handleClearAllHistory = async () => {
    try {
      await fetch(`/api/history/all/${userId}`, { method: 'DELETE' });
      setHistory([]);
      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Failed to clear history", err);
    }
  };

  const handleLoadHistoryItem = (item: any) => {
    setMessages([
      {
        id: `h-u-${item.id}`,
        role: 'user',
        content: item.message,
        timestamp: new Date(item.timestamp || Date.now()),
      },
      {
        id: `h-a-${item.id}`,
        role: 'assistant',
        content: item.response,
        timestamp: new Date(item.timestamp || Date.now()),
      }
    ]);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
  };

  const handleExportChat = () => {
    if (messages.length === 0) return;
    const text = messages.map(m => `### ${m.role === 'user' ? 'User' : 'Polyglot AI'}\n\n${m.content}\n\n`).join('---\n\n');
    
    // Copy to clipboard
    navigator.clipboard.writeText(text);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);

    // Download as .md file
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Polyglot_AI_Chat_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async (content: string, image?: string) => {
    if (!content.trim() && !image) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      imageUrl: image,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const isImageGen = activeMode === 'image' || /generate image|show me a picture|draw|create an image/i.test(content);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (isImageGen) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Creating visual illustration...",
          timestamp: new Date(),
          isStreaming: true,
        };
        setMessages(prev => [...prev, assistantMessage]);

        const imageUrl = await generateImage(content);
        
        setMessages(prev => prev.map(m => 
          m.id === assistantMessage.id 
            ? { ...m, content: "Here is your generated illustration:", imageUrl, isStreaming: false } 
            : m
        ));
        saveToHistory(content, "Generated an illustration.");
      } else {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "",
          timestamp: new Date(),
          isStreaming: true,
        };
        setMessages(prev => [...prev, assistantMessage]);

        const aiHistory = messages
          .filter(m => m.content && m.content.trim().length > 0)
          .map(m => ({
            role: m.role === 'user' ? 'user' as const : 'model' as const,
            parts: [{ text: m.content }]
          }));

        let fullResponse = "";
        await generateAIResponseStream(
          content,
          aiHistory,
          (chunk) => {
            fullResponse += chunk;
            setMessages(prev => prev.map(m => 
              m.id === assistantMessage.id ? { ...m, content: fullResponse } : m
            ));
          },
          image,
          activeMode,
          controller.signal
        );

        setMessages(prev => prev.map(m => 
          m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
        ));
        saveToHistory(content, fullResponse);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log("Stream aborted by user");
        return;
      }
      console.error("Chat error:", error);
      const userFriendlyMessage = error?.message && !error.message.includes("failed with status")
        ? error.message
        : "I'm sorry, I encountered an issue. Please try sending your message again.";

      setMessages(prev => {
        const hasStreamingMsg = prev.some(m => m.role === 'assistant' && m.isStreaming);
        if (hasStreamingMsg) {
          return prev.map(m => 
            m.role === 'assistant' && m.isStreaming
              ? { ...m, content: m.content ? `${m.content}\n\n*${userFriendlyMessage}*` : userFriendlyMessage, isStreaming: false }
              : m
          );
        }
        return [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: userFriendlyMessage,
            timestamp: new Date(),
          }
        ];
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const activeModeDetails = AI_MODES.find(m => m.id === activeMode) || AI_MODES[0];

  return (
    <div className="flex h-screen bg-chat-dark text-zinc-100 font-sans overflow-hidden relative selection:bg-emerald-500/30 selection:text-white">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-block-pattern pointer-events-none z-0 opacity-40" />
      
      {/* Animated Live Background Glow (Gemini Style) */}
      <AnimatePresence>
        {(isLoading || isTyping) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.16 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              background: 'radial-gradient(circle at 50% 0%, #4285f4 0%, transparent 50%), radial-gradient(circle at 100% 0%, #34a853 0%, transparent 50%), radial-gradient(circle at 0% 0%, #ea4335 0%, transparent 50%)',
              filter: 'blur(100px)'
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-sidebar-dark border-r border-white/5 flex flex-col overflow-hidden relative z-20 shadow-2xl shrink-0"
      >
        {/* Brand */}
        <div className="p-4 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
              <Globe2 size={18} />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-base text-zinc-100 flex items-center gap-1.5">
                Polyglot AI
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Pro
                </span>
              </h1>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            title="Collapse sidebar"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors md:hidden"
          >
            <PanelLeftClose size={17} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button 
            onClick={() => setMessages([])}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-100 rounded-xl text-xs md:text-sm font-medium transition-all border border-white/5 group shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
              <span>New chat</span>
            </div>
            <div className="h-5 px-1.5 rounded border border-white/10 flex items-center justify-center text-[10px] text-zinc-400 font-mono">
              +
            </div>
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-between">
            <span>Recent Chats</span>
            {history.length > 0 && (
              <span className="text-[10px] text-zinc-600 font-mono">{history.length}</span>
            )}
          </div>

          {history.length === 0 ? (
            <div className="px-4 py-8 text-center space-y-1">
              <p className="text-xs text-zinc-500">No chat history yet</p>
              <p className="text-[11px] text-zinc-600">Your conversations will appear here</p>
            </div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id}
                onClick={() => handleLoadHistoryItem(item)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-zinc-800/80 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
                  <MessageSquare size={14} className="shrink-0 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                  <span className="truncate">{item.message}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                  title="Delete chat"
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 rounded transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Settings Button */}
        <div className="p-3 border-t border-white/[0.04]">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/80 rounded-xl text-xs md:text-sm text-zinc-400 hover:text-white transition-all"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-transparent z-10 min-w-0">
        {/* Header */}
        <header className={cn(
          "h-14 flex items-center justify-between px-3 md:px-5 bg-chat-dark/80 backdrop-blur-md z-20 border-b border-white/[0.04] transition-all duration-300",
          (isLoading || isTyping) && "shadow-[0_0_30px_rgba(66,133,244,0.08)]"
        )}>
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                title="Open sidebar"
                className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}

            {/* AI Mode Dropdown Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                className="px-3 py-1.5 rounded-xl hover:bg-zinc-800/90 transition-all cursor-pointer flex items-center gap-2 bg-zinc-900/60 border border-white/5"
              >
                {activeModeDetails.icon}
                <span className="text-xs md:text-sm font-semibold text-zinc-100">{activeModeDetails.title}</span>
                <ChevronRight size={13} className={cn("text-zinc-500 transition-transform", isModeDropdownOpen && "rotate-90")} />
              </button>

              {/* Mode Menu Dropdown */}
              <AnimatePresence>
                {isModeDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-2 z-50 space-y-1"
                  >
                    <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Select AI Capability
                    </div>
                    {AI_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => {
                          setActiveMode(mode.id);
                          setIsModeDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full p-2.5 rounded-xl text-left transition-all flex items-start gap-2.5",
                          activeMode === mode.id 
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-white" 
                            : "hover:bg-zinc-800/80 text-zinc-300 border border-transparent"
                        )}
                      >
                        <div className="mt-0.5">{mode.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{mode.title}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">{mode.badge}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">{mode.description}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          {/* Header Action Tools */}
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button 
                onClick={handleExportChat}
                title="Export conversation"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                {copiedExport ? <Check size={14} className="text-emerald-400" /> : <Download size={14} />}
                <span className="hidden sm:inline">{copiedExport ? "Exported!" : "Export"}</span>
              </button>
            )}

            <button 
              onClick={() => setIsSettingsOpen(true)}
              title="Open settings"
              className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
            >
              <Settings size={17} />
            </button>
          </div>
        </header>

        {/* Gemini-style Loading Bar */}
        <div className="h-0.5 w-full relative overflow-hidden z-20">
          {(isLoading || isTyping) && <div className="gemini-loader absolute inset-0" />}
        </div>

        {/* Chat Messages Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {messages.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center px-4 md:px-6 py-8"
              >
                {/* Hero Icon */}
                <div className="h-14 w-14 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center mb-5 shadow-2xl shadow-emerald-500/20 border border-white/10">
                  <Globe2 size={28} className="text-white" />
                </div>
                
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 text-zinc-100">
                  Polyglot AI
                </h2>
                <p className="text-xs md:text-sm text-zinc-400 max-w-md mb-8">
                  World-class multilingual AI assistant by <strong>Arif Hasan</strong> from Bangladesh. Capable of translation, math, coding, and problem solving in every language.
                </p>
                
                {/* Prompt Suggestion Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl text-left">
                  {[
                    { 
                      icon: <Globe2 size={16} className="text-emerald-400" />, 
                      title: "Translation & Languages",
                      prompt: "Translate 'Welcome to the world of intelligent artificial intelligence' into 5 languages."
                    },
                    { 
                      icon: <Brain size={16} className="text-amber-400" />, 
                      title: "Math & Problem Solver",
                      prompt: "Solve this step-by-step: A car travels 120 km at 60 km/h and 180 km at 90 km/h. What is the average speed?"
                    },
                    { 
                      icon: <Sparkles size={16} className="text-purple-400" />, 
                      title: "Programming & Code",
                      prompt: "Write a clean Python function with type hints to find prime numbers with explanation."
                    },
                    { 
                      icon: <Palette size={16} className="text-pink-400" />, 
                      title: "Creative Artwork",
                      prompt: "Generate an illustration of a futuristic glowing cityscape at sunset."
                    }
                  ].map((sugg) => (
                    <button 
                      key={sugg.title}
                      onClick={() => handleSendMessage(sugg.prompt)}
                      className="p-3.5 text-xs text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/[0.06] rounded-2xl transition-all text-left flex items-start gap-3 group hover:border-zinc-700 shadow-sm"
                    >
                      <div className="p-2 rounded-xl bg-zinc-800/80 group-hover:bg-zinc-700/80 transition-colors shrink-0">
                        {sugg.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors mb-0.5">
                          {sugg.title}
                        </div>
                        <p className="text-zinc-500 text-[11px] line-clamp-2">{sugg.prompt}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="pb-36">
                {messages.map((msg) => (
                  <MessageBubble 
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.timestamp}
                    imageUrl={msg.imageUrl}
                    isStreaming={msg.isStreaming}
                    voice={settings.voice}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Bar Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-chat-dark via-chat-dark/95 to-transparent pt-12 z-20">
          <ChatInput 
            onSendMessage={handleSendMessage} 
            onInputChange={(val) => setIsTyping(val.length > 0)}
            onStopGeneration={handleStopGeneration}
            isLoading={isLoading} 
            selectedMode={activeMode}
          />
          <p className="text-[11px] text-center pt-2.5 text-zinc-500 font-medium">
            Polyglot AI can make mistakes. Verify critical facts and calculations.
          </p>
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings(prev => ({ ...prev, ...newSettings }))}
        onClearAllHistory={handleClearAllHistory}
      />
    </div>
  );
}
