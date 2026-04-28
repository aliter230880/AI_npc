import { useState } from 'react';
import { X, Key, Eye, EyeOff, ExternalLink, CheckCircle } from 'lucide-react';
import { useStore } from '../store/useStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: Props) {
  const { apiKeys, setApiKey } = useStore();
  const [show, setShow] = useState({ deepseek: false, groq: false });
  const [saved, setSaved] = useState(false);
  const [keys, setKeys] = useState({ deepseek: apiKeys.deepseek, groq: apiKeys.groq });

  if (!open) return null;

  const handleSave = () => {
    setApiKey('deepseek', keys.deepseek);
    setApiKey('groq', keys.groq);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-purple-900/30 border border-purple-800/30">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-900/40 flex items-center justify-center">
              <Key className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-lg">API Ключи</h2>
              <p className="text-xs text-gray-500">Для полноценного AI-общения</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner */}
        <div className="mb-5 p-3 rounded-xl bg-purple-900/20 border border-purple-800/30 text-xs text-purple-300">
          💡 Без ключей работает <strong>демо-режим</strong> с предустановленными ответами.
          Добавь ключи для полноценного AI-общения.
        </div>

        {/* DeepSeek */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">DeepSeek API Key</label>
            <a
              href="https://platform.deepseek.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              Получить <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="relative">
            <input
              type={show.deepseek ? 'text' : 'password'}
              value={keys.deepseek}
              onChange={(e) => setKeys({ ...keys, deepseek: e.target.value })}
              placeholder="sk-..."
              className="input-dark w-full px-4 py-3 pr-11 rounded-xl text-sm"
            />
            <button
              onClick={() => setShow({ ...show, deepseek: !show.deepseek })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {show.deepseek ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">Модель: deepseek-chat · Бесплатный tier доступен</p>
        </div>

        {/* Groq */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Groq API Key</label>
            <a
              href="https://console.groq.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              Получить <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="relative">
            <input
              type={show.groq ? 'text' : 'password'}
              value={keys.groq}
              onChange={(e) => setKeys({ ...keys, groq: e.target.value })}
              placeholder="gsk_..."
              className="input-dark w-full px-4 py-3 pr-11 rounded-xl text-sm"
            />
            <button
              onClick={() => setShow({ ...show, groq: !show.groq })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {show.groq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">Модель: llama-3.3-70b-versatile · Ультра быстрый ⚡</p>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`btn-primary w-full py-3 flex items-center justify-center gap-2 ${
            saved ? 'bg-green-600' : ''
          }`}
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Сохранено!
            </>
          ) : (
            'Сохранить ключи'
          )}
        </button>

        <p className="text-center text-xs text-gray-600 mt-3">
          🔒 Ключи хранятся только в браузере, не передаются на сервер
        </p>
      </div>
    </div>
  );
}
