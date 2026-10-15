import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { User, Bot, Globe, Volume2, VolumeX, Copy, Check, Sparkles } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateSpeech } from '../services/geminiService';
import { CodeBlock } from './CodeBlock';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  language?: string;
  timestamp: Date;
  imageUrl?: string;
  isStreaming?: boolean;
  voice?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  role, 
  content, 
  language, 
  timestamp, 
  imageUrl,
  isStreaming,
  voice
}) => {
  const isUser = role === 'user';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy message:", e);
    }
  };

  const handleSpeak = async () => {
    if (isSpeaking) {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }

    try {
      setIsSpeaking(true);
      const audioUrl = await generateSpeech(content, voice);
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      audio.onended = () => {
        setIsSpeaking(false);
        setCurrentAudio(null);
      };
      audio.onerror = () => {
        // Fallback to browser synthesis
        fallbackSpeech();
      };
      await audio.play();
    } catch {
      fallbackSpeech();
    }
  };

  const fallbackSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content.replace(/[#*`_]/g, ''));
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "w-full py-6 md:py-8 flex justify-center group/bubble transition-colors",
        isUser ? "bg-transparent" : "bg-zinc-800/20 border-y border-white/[0.02]"
      )}
    >
      <div className="w-full max-w-3xl px-4 md:px-6 flex gap-3.5 md:gap-5">
        {/* Avatar */}
        <div className={cn(
          "flex h-8 w-8 md:h-9 md:w-9 shrink-0 select-none items-center justify-center rounded-xl border text-sm font-medium transition-all shadow-md",
          isUser 
            ? "bg-zinc-200 text-zinc-900 border-zinc-300" 
            : "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20"
        )}>
          {isUser ? (
            <User size={16} />
          ) : (
            <div className="relative flex items-center justify-center">
              <Bot size={18} />
              {isStreaming && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Content container */}
        <div className="flex-1 space-y-2 overflow-hidden min-w-0">
          <div className="font-semibold text-xs md:text-sm text-zinc-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{isUser ? "You" : "Polyglot AI"}</span>
              <span className="text-[10px] font-normal text-zinc-500 uppercase tracking-wider">
                {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            {/* Quick Actions (Copy / Speak) */}
            {!isUser && content && !isStreaming && (
              <div className="flex items-center gap-1 opacity-80 md:opacity-0 md:group-hover/bubble:opacity-100 transition-opacity">
                <button 
                  onClick={handleCopy}
                  title="Copy text"
                  className="p-1.5 hover:bg-zinc-700/80 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                <button 
                  onClick={handleSpeak}
                  title={isSpeaking ? "Stop listening" : "Read aloud"}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    isSpeaking 
                      ? "text-emerald-400 bg-emerald-500/10" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-700/80"
                  )}
                >
                  {isSpeaking ? <VolumeX size={14} className="animate-pulse" /> : <Volume2 size={14} />}
                </button>
              </div>
            )}
          </div>
          
          {/* Attached or Generated Image */}
          {imageUrl && (
            <div className="my-3 rounded-2xl overflow-hidden border border-zinc-700/60 bg-zinc-950/60 shadow-2xl max-w-md group/img relative">
              <img 
                src={imageUrl} 
                alt="Visual" 
                className="w-full h-auto max-h-96 object-contain rounded-2xl"
                loading="lazy"
              />
            </div>
          )}

          {/* Markdown Content */}
          <div className="prose prose-sm md:prose-base max-w-none prose-invert break-words leading-relaxed">
            {content ? (
              <>
                <ReactMarkdown
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeValue = String(children).replace(/\n$/, '');
                      if (!inline && match) {
                        return (
                          <CodeBlock
                            language={match[1]}
                            value={codeValue}
                          />
                        );
                      }
                      if (!inline && codeValue.includes('\n')) {
                        return (
                          <CodeBlock
                            language="text"
                            value={codeValue}
                          />
                        );
                      }
                      return (
                        <code className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-emerald-300 font-mono text-xs" {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 bg-emerald-500 animate-pulse align-middle" />
                )}
              </>
            ) : isStreaming ? (
              <div className="flex items-center gap-1.5 py-2">
                <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce" />
                <span className="text-xs text-zinc-500 ml-1.5 font-sans">Thinking...</span>
              </div>
            ) : null}
          </div>
          
          {language && (
            <div className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wider pt-2">
              <Globe size={11} className="text-zinc-600" />
              <span>{language}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
