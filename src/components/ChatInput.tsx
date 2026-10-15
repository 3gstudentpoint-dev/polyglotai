import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Mic, MicOff, Square, Sparkles } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatInputProps {
  onSendMessage: (message: string, image?: string) => void;
  onInputChange?: (value: string) => void;
  onStopGeneration?: () => void;
  isLoading: boolean;
  selectedMode?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onInputChange, 
  onStopGeneration,
  isLoading,
  selectedMode = 'fast'
}) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    onInputChange?.(value);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        alert("Image must be smaller than 15MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading && onStopGeneration) {
      onStopGeneration();
      return;
    }
    if ((input.trim() || selectedImage) && !isLoading) {
      onSendMessage(input.trim(), selectedImage || undefined);
      setInput('');
      setSelectedImage(null);
      onInputChange?.('');
      if (isListening) {
        stopVoiceRecognition();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Web Speech API Voice Recognition
  const toggleVoiceRecognition = () => {
    if (isListening) {
      stopVoiceRecognition();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(prev => {
            const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
            const updated = prev + separator + transcript;
            onInputChange?.(updated);
            return updated;
          });
        }
      };

      recognition.onerror = (err: any) => {
        console.warn("Speech recognition error:", err);
        stopVoiceRecognition();
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition start failed:", err);
      setIsListening(false);
    }
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div className="max-w-3xl mx-auto w-full">
      {/* Image Preview */}
      {selectedImage && (
        <div className="mb-2 relative inline-flex items-center gap-2 p-1 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-lg">
          <img 
            src={selectedImage} 
            alt="Preview" 
            className="h-16 w-16 object-cover rounded-lg" 
          />
          <div className="pr-2 text-xs text-zinc-400">
            <span>Image attached</span>
          </div>
          <button 
            type="button"
            onClick={() => setSelectedImage(null)}
            className="absolute -top-2 -right-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full p-1 border border-zinc-600 shadow"
            title="Remove image"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Listening Indicator */}
      {isListening && (
        <div className="mb-2 flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-full w-fit animate-pulse">
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
          <span>Listening... Speak into microphone</span>
          <button 
            type="button" 
            onClick={stopVoiceRecognition}
            className="ml-2 underline font-semibold text-rose-300 hover:text-white"
          >
            Stop
          </button>
        </div>
      )}

      {/* Main Input Bar */}
      <form 
        onSubmit={handleSubmit}
        className="relative flex items-end gap-2 p-0"
      >
        <div className={cn(
          "relative flex-1 group flex items-end gap-1.5 chat-input-gradient-border transition-all shadow-2xl p-1 bg-zinc-900/90 rounded-2xl border border-zinc-700/60",
          (input.length > 0 || selectedImage || isListening) && "is-typing"
        )}>
          {/* Image Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload image"
            className="p-2.5 text-zinc-400 hover:text-emerald-400 rounded-xl hover:bg-zinc-800 transition-colors shrink-0 mb-0.5"
          >
            <ImageIcon size={19} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />

          {/* Voice Input Button */}
          <button
            type="button"
            onClick={toggleVoiceRecognition}
            title={isListening ? "Stop listening" : "Voice input (Speak)"}
            className={cn(
              "p-2.5 rounded-xl transition-colors shrink-0 mb-0.5",
              isListening 
                ? "text-rose-400 bg-rose-500/10 animate-pulse" 
                : "text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800"
            )}
          >
            {isListening ? <MicOff size={19} /> : <Mic size={19} />}
          </button>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening 
                ? "Listening to your voice..." 
                : selectedMode === 'image' 
                  ? "Describe the image you want to create..."
                  : "Message Polyglot AI (any language, math, code)..."
            }
            className="flex-1 py-2.5 px-2 bg-transparent border-none focus:ring-0 focus:outline-none resize-none max-h-48 text-sm md:text-base text-zinc-100 placeholder:text-zinc-500 font-sans"
          />

          {/* Action Button: Send or Stop */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStopGeneration}
              title="Stop generating"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all shrink-0 mb-0.5 mr-0.5"
            >
              <Square size={14} className="fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() && !selectedImage}
              title="Send message"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black shadow-lg hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-all shrink-0 mb-0.5 mr-0.5"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
