import { motion } from 'framer-motion';
import {
  BarChart3, MessageCircle, Zap, Key, TrendingUp,
  Users, Clock, Star, Activity, Code2, ChevronRight
} from 'lucide-react';
import { useStore } from '../store/useStore';

export default function DashboardPage() {
  const { characters, chatSessions, setPage, apiKeys } = useStore();

  const totalMessages = Object.values(chatSessions).reduce(
    (sum, s) => sum + s.messages.length, 0
  );
  const activeChars = Object.keys(chatSessions).filter(
    id => (chatSessions[id]?.messages?.length || 0) > 0
  ).length;

  const hasKeys = apiKeys.deepseek || apiKeys.groq;

  const stats = [
    { icon: MessageCircle, label: 'Всего сообщений', value: totalMessages, color: 'text-blue-400', bg: 'bg-blue-900/20' },
    { icon: Users, label: 'Активных персонажей', value: activeChars, color: 'text-purple-400', bg: 'bg-purple-900/20' },
    { icon: Zap, label: 'API Ключей', value: hasKeys ? (apiKeys.deepseek && apiKeys.groq ? 2 : 1) : 0, color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
    { icon: Star, label: 'Персонажей всего', value: characters.length, color: 'text-green-400', bg: 'bg-green-900/20' },
  ];

  const recentChars = characters.filter(c => chatSessions[c.id]?.messages?.length > 0);

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 gradient-bg">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">Дашборд</span>
          </h1>
          <p className="text-gray-400">Обзор вашей активности и персонажей</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass rounded-2xl p-5"
            >
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* API Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-400" />
                Статус API
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 glass-light rounded-xl">
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <div>
                      <div className="text-sm font-medium text-white">DeepSeek V3</div>
                      <div className="text-xs text-gray-500">deepseek-chat</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${
                    apiKeys.deepseek
                      ? 'bg-green-900/40 text-green-400 border border-green-700/30'
                      : 'bg-gray-800 text-gray-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${apiKeys.deepseek ? 'bg-green-400' : 'bg-gray-600'}`} />
                    {apiKeys.deepseek ? 'Подключён' : 'Не настроен'}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 glass-light rounded-xl">
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-yellow-400" />
                    <div>
                      <div className="text-sm font-medium text-white">Groq / Llama 3.3</div>
                      <div className="text-xs text-gray-500">llama-3.3-70b-versatile</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${
                    apiKeys.groq
                      ? 'bg-green-900/40 text-green-400 border border-green-700/30'
                      : 'bg-gray-800 text-gray-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${apiKeys.groq ? 'bg-green-400' : 'bg-gray-600'}`} />
                    {apiKeys.groq ? 'Подключён' : 'Не настроен'}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 glass-light rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="text-sm">🔊</div>
                    <div>
                      <div className="text-sm font-medium text-white">Web Speech API</div>
                      <div className="text-xs text-gray-500">TTS + STT бесплатно</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-green-900/40 text-green-400 border border-green-700/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Активен
                  </div>
                </div>
              </div>

              {!hasKeys && (
                <div className="mt-4 p-3 rounded-xl bg-yellow-900/20 border border-yellow-800/30 text-xs text-yellow-400 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Добавь API ключи для полноценного AI-общения. Сейчас работает демо-режим.</span>
                </div>
              )}
            </motion.div>

            {/* Recent chats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Недавние диалоги
              </h2>

              {recentChars.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-gray-500 text-sm">Диалогов пока нет</p>
                  <button
                    onClick={() => setPage('characters')}
                    className="mt-4 btn-primary px-5 py-2 text-sm"
                  >
                    Начать общение
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentChars.map(char => {
                    const session = chatSessions[char.id];
                    const lastMsg = session?.messages?.[session.messages.length - 1];
                    return (
                      <button
                        key={char.id}
                        onClick={() => { useStore.getState().setSelectedCharacter(char); setPage('chat'); }}
                        className="w-full flex items-center gap-3 p-3 glass-light rounded-xl hover:bg-white/5 transition-all text-left"
                      >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${char.color} flex items-center justify-center text-xl flex-shrink-0`}>
                          {char.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-medium text-sm text-white">{char.name}</span>
                            <span className="text-xs text-gray-600">
                              {session?.messages?.length || 0} сообщ.
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {lastMsg?.content || 'Нет сообщений'}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Quick actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="font-semibold text-white mb-4">Быстрые действия</h2>
              <div className="space-y-2">
                {[
                  { icon: Users, label: 'Все персонажи', page: 'characters' as const, color: 'text-purple-400' },
                  { icon: MessageCircle, label: 'Создать персонажа', page: 'create' as const, color: 'text-blue-400' },
                  { icon: Code2, label: 'API Документация', page: 'api-docs' as const, color: 'text-green-400' },
                ].map(action => (
                  <button
                    key={action.label}
                    onClick={() => setPage(action.page)}
                    className="w-full flex items-center gap-3 p-3 glass-light rounded-xl hover:bg-white/5 transition-all text-left"
                  >
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                    <span className="text-sm text-gray-300">{action.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
                  </button>
                ))}
              </div>
            </motion.div>

            {/* All characters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Персонажи
              </h2>
              <div className="space-y-2">
                {characters.slice(0, 5).map(char => (
                  <div key={char.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${char.color} flex items-center justify-center text-sm flex-shrink-0`}>
                      {char.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <span className="text-sm text-white truncate">{char.name}</span>
                        <span className="text-xs text-gray-500">{chatSessions[char.id]?.messages?.length || 0}</span>
                      </div>
                      <div className="mt-1 h-1 bg-gray-800 rounded-full">
                        <div
                          className="h-full bg-purple-600 rounded-full"
                          style={{
                            width: `${Math.min(100, ((chatSessions[char.id]?.messages?.length || 0) / Math.max(1, totalMessages)) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {characters.length > 5 && (
                <button
                  onClick={() => setPage('characters')}
                  className="mt-4 w-full text-center text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Ещё {characters.length - 5} персонажей →
                </button>
              )}
            </motion.div>

            {/* System info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-2xl p-5"
            >
              <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                Система
              </h2>
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Версия платформы</span>
                  <span className="text-gray-400">v1.0.0-beta</span>
                </div>
                <div className="flex justify-between">
                  <span>Режим</span>
                  <span className={hasKeys ? 'text-green-400' : 'text-yellow-400'}>
                    {hasKeys ? 'AI Mode' : 'Demo Mode'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>TTS</span>
                  <span className="text-green-400">Web Speech API</span>
                </div>
                <div className="flex justify-between">
                  <span>STT</span>
                  <span className="text-green-400">Web Speech API</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
