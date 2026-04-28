import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Plus, X, ChevronRight, Brain, Mic, Globe, Shield } from 'lucide-react';
import { useStore, Character } from '../store/useStore';

const avatarOptions = ['🧙‍♂️','🧝‍♀️','🤖','👩‍⚕️','🏴‍☠️','🥷','🧬','🎩','👨‍🚀','🧜‍♀️','🦁','🐉','👸','🤠','👨‍🔬','🧟','🦊','🐺','🦅','🎭'];
const voiceOptions = [
  { id: 'alloy', label: 'Alloy — нейтральный' },
  { id: 'echo', label: 'Echo — мужской' },
  { id: 'nova', label: 'Nova — женский' },
  { id: 'onyx', label: 'Onyx — глубокий' },
  { id: 'shimmer', label: 'Shimmer — мягкий' },
];
const modelOptions = [
  { id: 'deepseek', label: 'DeepSeek V3', desc: 'Глубокое понимание, лучше для сложных ролей' },
  { id: 'groq', label: 'Groq / Llama 3.3', desc: 'Молниеносная скорость, отлично для диалогов' },
];
const categoryOptions = ['Исторические','Фэнтези','Sci-Fi','Психология','Приключения','Философия','Наука','Детектив','Бизнес','Другое'];
const colorOptions = [
  { id: 'from-violet-900 to-purple-900', label: 'Фиолетовый' },
  { id: 'from-blue-900 to-cyan-900', label: 'Синий' },
  { id: 'from-emerald-900 to-teal-900', label: 'Зелёный' },
  { id: 'from-red-900 to-orange-900', label: 'Красный' },
  { id: 'from-amber-900 to-yellow-900', label: 'Золотой' },
  { id: 'from-pink-900 to-rose-900', label: 'Розовый' },
  { id: 'from-slate-800 to-zinc-900', label: 'Серый' },
  { id: 'from-stone-800 to-amber-950', label: 'Коричневый' },
];

export default function CreatePage() {
  const { characters, setPage, setSelectedCharacter } = useStore();
  const [step, setStep] = useState(1);
  const [tagInput, setTagInput] = useState('');
  const [personalityInput, setPersonalityInput] = useState('');
  const [created, setCreated] = useState(false);

  const [form, setForm] = useState({
    name: '',
    avatar: '🤖',
    role: '',
    description: '',
    backstory: '',
    personality: [] as string[],
    voice: 'alloy',
    language: 'ru',
    category: 'Другое',
    tags: [] as string[],
    color: 'from-violet-900 to-purple-900',
    model: 'deepseek' as 'deepseek' | 'groq',
    systemPrompt: '',
  });

  const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      update('tags', [...form.tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const addPersonality = () => {
    if (personalityInput.trim() && !form.personality.includes(personalityInput.trim())) {
      update('personality', [...form.personality, personalityInput.trim()]);
      setPersonalityInput('');
    }
  };

  const handleCreate = () => {
    const newChar: Character = {
      id: Date.now().toString(),
      ...form,
      rating: 5.0,
      chats: 0,
      isOnline: true,
      accentColor: '#7c3aed',
      systemPrompt: form.systemPrompt ||
        `Ты — ${form.name}, ${form.role}. ${form.description} ${form.backstory} Черты характера: ${form.personality.join(', ')}. Отвечай на русском языке.`,
    };

    // Add to store (in real app — API call)
    (useStore.getState() as any).characters = [...characters, newChar];
    setCreated(true);

    setTimeout(() => {
      setSelectedCharacter(newChar);
      setPage('chat');
    }, 1500);
  };

  const canNext1 = form.name.trim() && form.role.trim() && form.description.trim();
  // canNext2 reserved for future validation
  const canCreate = canNext1;

  if (created) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center gradient-bg">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="text-6xl mb-4">{form.avatar}</div>
          <h2 className="text-2xl font-bold text-white mb-2">Персонаж создан!</h2>
          <p className="text-gray-400">Открываю чат с {form.name}...</p>
          <div className="mt-4 flex justify-center">
            <div className="flex gap-1.5">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="wave-bar w-1 h-6 bg-purple-500 rounded-full" />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 gradient-bg">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold mb-3">
            Создать <span className="gradient-text">персонажа</span>
          </h1>
          <p className="text-gray-400">Оживи своего AI-персонажа за 3 шага</p>
        </motion.div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`w-12 h-0.5 transition-all ${step > s ? 'bg-purple-600' : 'bg-gray-800'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-6">
          {/* STEP 1 — Basic info */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-purple-400" />
                <h2 className="font-semibold text-white">Основное</h2>
              </div>

              {/* Avatar picker */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Аватар</label>
                <div className="flex flex-wrap gap-2">
                  {avatarOptions.map(a => (
                    <button
                      key={a}
                      onClick={() => update('avatar', a)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                        form.avatar === a
                          ? 'bg-purple-600 scale-110 shadow-lg shadow-purple-900/40'
                          : 'glass-light hover:scale-105'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Имя персонажа *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="Например: Магистр Орден"
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm"
                />
              </div>

              {/* Role */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Роль / профессия *</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={e => update('role', e.target.value)}
                  placeholder="Например: Древний маг, Детектив, Психолог..."
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Краткое описание *</label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  placeholder="Кто этот персонаж? Чем занимается? Что умеет?"
                  rows={3}
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Категория</label>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map(c => (
                    <button
                      key={c}
                      onClick={() => update('category', c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.category === c ? 'bg-purple-600 text-white' : 'glass-light text-gray-400 hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Цвет карточки</label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map(c => (
                    <button
                      key={c.id}
                      onClick={() => update('color', c.id)}
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${c.id} transition-all ${
                        form.color === c.id ? 'ring-2 ring-purple-400 scale-110' : 'hover:scale-105'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!canNext1}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                Далее <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 2 — Personality */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="font-semibold text-white">Характер и история</h2>
              </div>

              {/* Personality traits */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Черты характера</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={personalityInput}
                    onChange={e => setPersonalityInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addPersonality()}
                    placeholder="Например: Мудрый, Весёлый..."
                    className="input-dark flex-1 px-4 py-2.5 rounded-xl text-sm"
                  />
                  <button onClick={addPersonality} className="btn-ghost px-4 py-2.5 rounded-xl">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.personality.map(p => (
                    <span key={p} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-900/30 border border-purple-700/30 text-xs text-purple-300">
                      {p}
                      <button onClick={() => update('personality', form.personality.filter(x => x !== p))} className="text-purple-500 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Backstory */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">История персонажа</label>
                <textarea
                  value={form.backstory}
                  onChange={e => update('backstory', e.target.value)}
                  placeholder="Откуда он? Что пережил? Что его мотивирует?"
                  rows={4}
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Теги</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTag()}
                    placeholder="Магия, Наука, Философия..."
                    className="input-dark flex-1 px-4 py-2.5 rounded-xl text-sm"
                  />
                  <button onClick={addTag} className="btn-ghost px-4 py-2.5 rounded-xl">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.tags.map(t => (
                    <span key={t} className="flex items-center gap-1.5 tag">
                      {t}
                      <button onClick={() => update('tags', form.tags.filter(x => x !== t))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-ghost flex-1 py-3">← Назад</button>
                <button onClick={() => setStep(3)} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                  Далее <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 — Technical */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-purple-400" />
                <h2 className="font-semibold text-white">Голос и модель</h2>
              </div>

              {/* AI Model */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">AI Модель</label>
                <div className="space-y-2">
                  {modelOptions.map(m => (
                    <button
                      key={m.id}
                      onClick={() => update('model', m.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                        form.model === m.id
                          ? 'border-purple-500 bg-purple-900/20 text-white'
                          : 'border-gray-700/30 glass-light text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium text-sm">{m.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  <Mic className="w-3.5 h-3.5 inline mr-1" />
                  Голос (Web TTS)
                </label>
                <div className="space-y-2">
                  {voiceOptions.map(v => (
                    <button
                      key={v.id}
                      onClick={() => update('voice', v.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border transition-all text-sm ${
                        form.voice === v.id
                          ? 'border-purple-500 bg-purple-900/20 text-white'
                          : 'border-gray-700/30 glass-light text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom system prompt */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  System Prompt (необязательно)
                </label>
                <textarea
                  value={form.systemPrompt}
                  onChange={e => update('systemPrompt', e.target.value)}
                  placeholder="Кастомный системный промпт. Если пусто — сгенерируется автоматически."
                  rows={4}
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none font-mono text-xs"
                />
                <p className="text-xs text-gray-600 mt-1">
                  <Globe className="w-3 h-3 inline mr-1" />
                  Авто-промпт будет создан на основе имени, роли и характера
                </p>
              </div>

              {/* Preview */}
              <div className="glass-light rounded-xl p-4 flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${form.color} flex items-center justify-center text-3xl flex-shrink-0`}>
                  {form.avatar}
                </div>
                <div>
                  <div className="font-bold text-white">{form.name || 'Имя'}</div>
                  <div className="text-xs text-purple-400">{form.role || 'Роль'}</div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-1">{form.description || 'Описание...'}</div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-ghost flex-1 py-3">← Назад</button>
                <button
                  onClick={handleCreate}
                  disabled={!canCreate}
                  className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Sparkles className="w-4 h-4" />
                  Создать персонажа
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
