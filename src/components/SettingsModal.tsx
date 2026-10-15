import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, User, Volume2, Trash2, Sparkles, Check, Heart } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../constants';

export interface AppSettings {
  language: string;
  personality: 'balanced' | 'fast' | 'reasoning' | 'creative';
  voice: 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr' | 'Charon';
  autoSpeak: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClearAllHistory: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearAllHistory,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Sparkles size={16} />
              </div>
              <h2 className="text-base font-semibold text-zinc-100">Polyglot AI Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar text-sm">
            {/* Preferred Language */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-medium text-zinc-200">
                <Globe size={15} className="text-emerald-400" />
                Response Language
              </label>
              <p className="text-xs text-zinc-400">
                Choose default response language or leave as Auto-Detect.
              </p>
              <select
                value={settings.language}
                onChange={(e) => onUpdateSettings({ language: e.target.value })}
                className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500 transition-all text-sm"
              >
                <option value="auto">Auto-Detect (Matches your message)</option>
                <option value="bn">বাংলা (Bengali)</option>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* AI Personality / Mode */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-medium text-zinc-200">
                <User size={15} className="text-emerald-400" />
                AI Reasoning & Tone
              </label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { id: 'fast', title: '⚡ Fast & Concise', desc: 'Direct, rapid answers' },
                  { id: 'balanced', title: '⚖️ Balanced', desc: 'Detailed & friendly' },
                  { id: 'reasoning', title: '🧠 Deep Reasoner', desc: 'Step-by-step problem solver' },
                  { id: 'creative', title: '🎨 Creative', desc: 'Rich & expressive style' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onUpdateSettings({ personality: item.id as any })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      settings.personality === item.id
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="font-medium text-xs text-zinc-200 flex items-center justify-between">
                      {item.title}
                      {settings.personality === item.id && <Check size={12} className="text-emerald-400" />}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Model for TTS */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-medium text-zinc-200">
                <Volume2 size={15} className="text-emerald-400" />
                Text-to-Speech Voice
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: 'Kore', label: 'Kore (Balanced)' },
                  { name: 'Puck', label: 'Puck (Lively)' },
                  { name: 'Fenrir', label: 'Fenrir (Deep)' },
                  { name: 'Zephyr', label: 'Zephyr (Soft)' },
                  { name: 'Charon', label: 'Charon (Formal)' },
                ].map((v) => (
                  <button
                    key={v.name}
                    onClick={() => onUpdateSettings({ voice: v.name as any })}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium text-center transition-all ${
                      settings.voice === v.name
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear History */}
            <div className="pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">Clear Conversation History</h4>
                  <p className="text-[11px] text-zinc-500">Permanently delete stored chat records</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to clear all chat history?")) {
                      onClearAllHistory();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/80 border border-red-500/20 transition-all"
                >
                  <Trash2 size={13} />
                  Clear All
                </button>
              </div>
            </div>

            {/* Creator Credit */}
            <div className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart size={14} className="text-rose-500 fill-rose-500" />
                <span>Created with passion by <strong>Arif Hasan</strong> from Bangladesh</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                v2.5 Pro
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-lg shadow-emerald-600/20"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
