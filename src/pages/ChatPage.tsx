import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Send, Mic, MicOff, Volume2, VolumeX,
  RotateCcw, Info, Star, Users, Zap, ChevronDown
} from 'lucide-react';
import { useStore, Message } from '../store/useStore';
import { sendMessage, speakText, stopSpeaking, startRecognition } from '../services/aiService';

export default function ChatPage() {
  const {
    selectedCharacter: char,
    setPage,
    chatSessions,
    addMessage,
    clearChat,
    apiKeys,
    isVoiceMode, setIsVoiceMode,
    isRecording, setIsRecording,
    isSpeaking, setIsSpeaking,
  } = useStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const messages = char ? (chatSessions[char.id]?.messages || []) : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!char && messages.length === 0) {
      // Greeting message
    }
  }, [char]);

  const handleSend = useCallback(async (text?: string) => {
    if (!char) return;
    const content = (text || input).trim();
    if (!content || isLoading) return;

    setInput('');
    setError('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    addMessage(char.id, userMsg);
    setIsLoading(true);

    try {
      const reply = await sendMessage(char, messages, content, apiKeys);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      addMessage(char.id, aiMsg);

      if (autoSpeak || isVoiceMode) {
        setIsSpeaking(true);
        try {
          await speakText(reply);
        } catch (_e) {
          // ignore TTS errors
        } finally {
          setIsSpeaking(false);
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка при получении ответа');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [char, input, isLoading, messages, apiKeys, addMessage, autoSpeak, isVoiceMode, setIsSpeaking]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    recognitionRef.current = startRecognition(
      (text) => {
        setInput(text);
        setIsRecording(false);
        // Auto send on voice input
        setTimeout(() => handleSend(text), 100);
      },
      () => setIsRecording(false),
      (err) => {
        setError('Ошибка микрофона: ' + err);
        setIsRecording(false);
      }
    );
    if (recognitionRef.current) setIsRecording(true);
  };

  const toggleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      setAutoSpeak(!autoSpeak);
    }
  };

  if (!char) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center gradient-bg">
        <div className="text-center">
          <div className="text-5xl mb-4">🤖</div>
          <p className="text-gray-400 mb-6">Персонаж не выбран</p>
          <button onClick={() => setPage('characters')} className="btn-primary px-6 py-3">
            Выбрать персонажа
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 flex flex-col gradient-bg">
      {/* Chat header */}
      <div className="glass border-b border-purple-900/20 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setPage('characters')}
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Character info */}
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${char.color} flex items-center justify-center text-xl flex-shrink-0`}>
          {char.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-white">{char.name}</h2>
            <div className="flex items-center gap-1 text-xs text-yellow-400">
              <Star className="w-3 h-3 fill-yellow-400" />
              {char.rating}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="online-dot w-1.5 h-1.5 bg-green-400 rounded-full" />
            <span>{char.role}</span>
            <span>·</span>
            <Zap className="w-3 h-3" />
            <span>{char.model === 'groq' ? 'Groq/Llama' : 'DeepSeek'}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Auto-speak toggle */}
          <button
            onClick={toggleSpeak}
            className={`p-2 rounded-lg transition-all ${
              autoSpeak || isSpeaking
                ? 'bg-purple-600 text-white'
                : 'hover:bg-white/5 text-gray-400 hover:text-white'
            }`}
            title={autoSpeak ? 'Выключить озвучку' : 'Включить озвучку'}
          >
            {isSpeaking ? (
              <div className="flex gap-0.5 items-end h-4 w-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="wave-bar w-0.5 bg-white rounded-full flex-1" />
                ))}
              </div>
            ) : autoSpeak ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {/* Info */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-2 rounded-lg transition-all ${
              showInfo ? 'bg-purple-900/40 text-purple-300' : 'hover:bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Clear chat */}
          <button
            onClick={() => clearChat(char.id)}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            title="Очистить чат"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Character info panel */}
      {showInfo && (
        <div className="glass border-b border-purple-900/20 px-5 py-4">
          <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500 mb-1">Характер</div>
              <div className="flex flex-wrap gap-1">
                {char.personality.map(p => (
                  <span key={p} className="tag">{p}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">История</div>
              <p className="text-gray-300 text-xs leading-relaxed">{char.backstory}</p>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Статистика</div>
              <div className="flex gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{char.chats.toLocaleString('ru')} чатов</span>
                <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" />{char.rating}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Теги</div>
              <div className="flex flex-wrap gap-1">
                {char.tags.map(t => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scroll-area px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Welcome */}
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">{char.avatar}</div>
              <h3 className="font-semibold text-white mb-2">Начни разговор с {char.name}</h3>
              <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">{char.description}</p>

              {/* Suggested starters */}
              <div className="flex flex-wrap gap-2 justify-center">
                {getStarters(char.id).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="glass-light px-4 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:border-purple-600/40 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} charAvatar={char.avatar} charColor={char.color} />
          ))}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${char.color} flex items-center justify-center text-sm flex-shrink-0`}>
                {char.avatar}
              </div>
              <div className="chat-bubble-ai px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <div className="typing-dot w-2 h-2 bg-purple-400 rounded-full" />
                  <div className="typing-dot w-2 h-2 bg-purple-400 rounded-full" />
                  <div className="typing-dot w-2 h-2 bg-purple-400 rounded-full" />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="glass rounded-xl p-3 border border-red-800/30 text-sm text-red-400 flex items-center gap-2">
              <span>⚠️</span>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* API key notice */}
      {!apiKeys.deepseek && !apiKeys.groq && (
        <div className="px-4 py-2">
          <div className="max-w-2xl mx-auto">
            <div className="glass rounded-xl px-4 py-2.5 text-xs text-yellow-400/80 border border-yellow-900/20 flex items-center gap-2">
              <span>💡</span>
              <span>Демо-режим. <button onClick={() => {}} className="underline text-yellow-300">Добавь API ключи</button> для полноценного AI-общения.</span>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="glass border-t border-purple-900/20 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-3">
            {/* Voice mode toggle */}
            <button
              onClick={() => setIsVoiceMode(!isVoiceMode)}
              className={`p-2.5 rounded-xl flex-shrink-0 transition-all mb-0.5 ${
                isVoiceMode
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                  : 'glass-light text-gray-400 hover:text-white'
              }`}
            >
              {isVoiceMode ? <Volume2 className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-180" />}
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Напиши ${char.name}...`}
                rows={1}
                className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none max-h-32 overflow-y-auto"
                style={{ lineHeight: '1.5' }}
              />
            </div>

            {/* Mic button */}
            <button
              onClick={toggleRecording}
              className={`p-2.5 rounded-xl flex-shrink-0 transition-all mb-0.5 ${
                isRecording
                  ? 'pulse-voice bg-red-600 text-white'
                  : 'glass-light text-gray-400 hover:text-white hover:bg-purple-900/30'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Send button */}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="btn-primary p-2.5 rounded-xl flex-shrink-0 mb-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-gray-600 mt-2 text-center">
            Enter — отправить · Shift+Enter — новая строка · 🎙️ — голосовой ввод
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  charAvatar,
  charColor,
}: {
  message: Message;
  charAvatar: string;
  charColor: string;
}) {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-xs sm:max-w-sm">
          <div className="chat-bubble-user px-4 py-3 text-sm text-white leading-relaxed">
            {message.content}
          </div>
          <div className="text-right text-xs text-gray-600 mt-1 pr-1">{time}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${charColor} flex items-center justify-center text-sm flex-shrink-0 mt-0.5`}>
        {charAvatar}
      </div>
      <div className="max-w-xs sm:max-w-md">
        <div className="chat-bubble-ai px-4 py-3 text-sm text-gray-200 leading-relaxed">
          {message.content}
        </div>
        <div className="text-xs text-gray-600 mt-1 pl-1">{time}</div>
      </div>
    </div>
  );
}

function getStarters(charId: string): string[] {
  const map: Record<string, string[]> = {
    '1': ['Как победить в бою?', 'Расскажи о Колизее', 'Какова твоя история?'],
    '2': ['Расскажи о магии', 'Что такое мудрость?', 'Поведай о звёздах'],
    '3': ['Что будет с человечеством?', 'Расскажи о технологиях 2157 года', 'Как работает ИИ?'],
    '4': ['Как справиться со стрессом?', 'Мне нужна поддержка', 'Как найти себя?'],
    '5': ['Расскажи о своих приключениях!', 'Где самые большие сокровища?', 'Что такое настоящая свобода?'],
    '6': ['В чём смысл жизни?', 'Как обрести покой?', 'Научи меня медитации'],
    '7': ['Объясни квантовую физику просто', 'Что такое тёмная материя?', 'Когда будет сингулярность?'],
    '8': ['У меня есть загадка для тебя', 'Раскрой моё дело', 'Как ты раскрываешь преступления?'],
  };
  return map[charId] || ['Привет!', 'Расскажи о себе', 'Чем можешь помочь?'];
}
