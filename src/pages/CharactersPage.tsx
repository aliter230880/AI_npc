import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Star, MessageCircle, Zap, Users } from 'lucide-react';
import { useStore, Character } from '../store/useStore';

const categories = ['Все', 'Исторические', 'Фэнтези', 'Sci-Fi', 'Психология', 'Приключения', 'Философия', 'Наука', 'Детектив'];

export default function CharactersPage() {
  const { characters, setSelectedCharacter, setPage } = useStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Все');

  const filtered = characters.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.role.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'Все' || c.category === category;
    return matchSearch && matchCat;
  });

  const handleOpenChat = (char: Character) => {
    setSelectedCharacter(char);
    setPage('chat');
  };

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 gradient-bg">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold mb-3">
            Выбери <span className="gradient-text">персонажа</span>
          </h1>
          <p className="text-gray-400">
            {characters.length} уникальных AI-персонажей с живым характером
          </p>
        </motion.div>

        {/* Search + Filter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-8 space-y-4"
        >
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск персонажей..."
              className="input-dark w-full pl-11 pr-4 py-3 rounded-xl text-sm"
            />
          </div>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap justify-center">
            <Filter className="w-4 h-4 text-gray-500 self-center" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  category === cat
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                    : 'glass-light text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Stats bar */}
        <div className="flex items-center justify-between mb-6 text-sm text-gray-500">
          <span>{filtered.length} персонажей</span>
          <span className="flex items-center gap-1.5">
            <span className="online-dot w-2 h-2 bg-green-400 rounded-full" />
            {characters.filter(c => c.isOnline).length} онлайн
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((char, i) => (
            <CharacterCard
              key={char.id}
              character={char}
              index={i}
              onChat={() => handleOpenChat(char)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <div className="text-5xl mb-4">🔍</div>
            <p>Персонажи не найдены. Попробуй другой запрос.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CharacterCard({
  character: c,
  index,
  onChat,
}: {
  character: Character;
  index: number;
  onChat: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="glass rounded-2xl overflow-hidden character-card cursor-pointer group"
      onClick={onChat}
    >
      {/* Top gradient area */}
      <div className={`relative bg-gradient-to-br ${c.color} h-28 flex items-center justify-center`}>
        <div className="text-5xl">{c.avatar}</div>
        {/* Online badge */}
        <div className="absolute top-3 right-3">
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            c.isOnline
              ? 'bg-green-900/50 text-green-400 border border-green-700/30'
              : 'bg-gray-800/50 text-gray-500 border border-gray-700/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.isOnline ? 'bg-green-400 online-dot' : 'bg-gray-500'}`} />
            {c.isOnline ? 'онлайн' : 'офлайн'}
          </span>
        </div>
        {/* Model badge */}
        <div className="absolute top-3 left-3">
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-black/40 text-gray-300 border border-white/10">
            <Zap className="w-2.5 h-2.5" />
            {c.model === 'groq' ? 'Groq' : 'DeepSeek'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-white text-lg">{c.name}</h3>
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <Star className="w-3 h-3 fill-yellow-400" />
            {c.rating}
          </div>
        </div>
        <div className="text-xs text-purple-400 font-medium mb-2">{c.role}</div>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-3">
          {c.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {c.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>

        {/* Stats + Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Users className="w-3 h-3" />
            {c.chats.toLocaleString('ru')}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onChat(); }}
            className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Общаться
          </button>
        </div>
      </div>
    </motion.div>
  );
}
