import { motion } from 'framer-motion';
import {
  Zap, MessageCircle, Mic, Code2, Brain, Gamepad2,
  Globe, Shield, ChevronRight, Star, Users, Sparkles,
  Volume2, Cpu
} from 'lucide-react';
import { useStore } from '../store/useStore';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: 'easeOut' as const }
  }),
};

const features = [
  {
    icon: Brain,
    title: 'Живые характеры',
    desc: 'Каждый персонаж обладает уникальной личностью, историей, речевыми паттернами и поведенческими моделями.',
    color: 'text-violet-400',
    bg: 'bg-violet-900/20',
  },
  {
    icon: MessageCircle,
    title: 'Текст + Голос',
    desc: 'Общайтесь текстом или голосом. STT → LLM → TTS в реальном времени. Latency < 1 сек.',
    color: 'text-blue-400',
    bg: 'bg-blue-900/20',
  },
  {
    icon: Code2,
    title: 'API для разработчиков',
    desc: 'REST API + WebSocket SDK. Встраивайте персонажей в Unity, Unreal Engine, веб-сайты, приложения.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-900/20',
  },
  {
    icon: Gamepad2,
    title: 'Игровые NPC',
    desc: 'Персонажи с памятью, эмоциями и реакциями на события игрового мира. Готовые плагины.',
    color: 'text-amber-400',
    bg: 'bg-amber-900/20',
  },
  {
    icon: Globe,
    title: 'Мультиязычность',
    desc: 'Поддержка русского, английского и 30+ языков. Персонаж автоматически адаптируется.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-900/20',
  },
  {
    icon: Shield,
    title: 'Безопасность',
    desc: 'Guardrails и контентные фильтры. Персонаж остаётся в своей роли и не выходит за рамки.',
    color: 'text-rose-400',
    bg: 'bg-rose-900/20',
  },
];

const stats = [
  { value: '8+', label: 'AI Персонажей', icon: Sparkles },
  { value: '< 1с', label: 'Время ответа', icon: Zap },
  { value: '30+', label: 'Языков', icon: Globe },
  { value: '100%', label: 'Бесплатный старт', icon: Star },
];

const usecases = [
  {
    emoji: '🎮',
    title: 'Игровые NPC',
    desc: 'Разумные персонажи для RPG, квестов, обучающих симуляторов. Каждый NPC — личность.',
  },
  {
    emoji: '📚',
    title: 'Образование',
    desc: 'Исторические личности, учёные, наставники. Делают обучение живым и запоминающимся.',
  },
  {
    emoji: '🧠',
    title: 'Психология',
    desc: 'AI-коучи, терапевты, наставники для работы над собой в безопасной среде.',
  },
  {
    emoji: '🏢',
    title: 'Бизнес',
    desc: 'AI-представители бренда, консультанты, поддержка 24/7 с характером компании.',
  },
];

export default function LandingPage() {
  const { setPage } = useStore();

  return (
    <div className="gradient-bg grid-pattern min-h-screen pt-16">
      {/* Hero */}
      <section className="relative pt-24 pb-20 px-4 overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-light mb-8 text-sm"
          >
            <span className="online-dot w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-gray-300">Новая платформа AI-персонажей</span>
            <span className="tag">v1.0</span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="text-5xl sm:text-6xl md:text-7xl font-bold leading-tight mb-6"
          >
            <span className="gradient-text-white">Создавай</span>
            <br />
            <span className="gradient-text">AI Персонажей</span>
            <br />
            <span className="text-gray-400 text-4xl sm:text-5xl md:text-6xl">с живым характером</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Платформа для создания AI-персонажей с уникальными личностями, голосом и памятью.
            Текстовое и голосовое общение, интеграция в игры через API.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button
              onClick={() => setPage('characters')}
              className="btn-primary px-8 py-4 text-base flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Начать бесплатно
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage('api-docs')}
              className="btn-ghost px-8 py-4 text-base flex items-center justify-center gap-2"
            >
              <Code2 className="w-5 h-5" />
              API Документация
            </button>
          </motion.div>

          {/* Tech stack badges */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
            className="mt-12 flex flex-wrap justify-center gap-3"
          >
            {['DeepSeek V3', 'Groq / Llama 3.3', 'Edge TTS', 'Web Speech API', 'REST API', 'WebSocket'].map((tech) => (
              <span key={tech} className="tag">{tech}</span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 border-y border-purple-900/20">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
              className="text-center"
            >
              <div className="text-3xl font-bold gradient-text mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Demo chat preview */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Как это <span className="gradient-text">выглядит</span>
            </h2>
            <p className="text-gray-400">Живое общение с AI-персонажем в реальном времени</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="glass rounded-2xl overflow-hidden shadow-2xl shadow-purple-900/20"
          >
            {/* Chat header */}
            <div className="px-5 py-4 border-b border-purple-900/20 flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-800 to-teal-900 flex items-center justify-center text-lg">
                  🧝‍♀️
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#111118] online-dot" />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">Лира</div>
                <div className="text-xs text-gray-500">Эльфийский маг · Онлайн</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="wave-bar w-0.5 h-4 bg-purple-500 rounded-full" />
                  ))}
                </div>
                <span className="text-xs text-gray-500">Говорит...</span>
              </div>
            </div>

            {/* Messages */}
            <div className="p-5 space-y-4 bg-gradient-to-b from-[#111118] to-[#0d0d16]">
              <div className="flex justify-end">
                <div className="chat-bubble-user px-4 py-3 max-w-xs text-sm text-white">
                  Расскажи мне о магии звёзд
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-800 to-teal-900 flex items-center justify-center text-sm flex-shrink-0">
                  🧝‍♀️
                </div>
                <div className="chat-bubble-ai px-4 py-3 max-w-sm text-sm text-gray-200 leading-relaxed">
                  Звёзды... они не просто огни в небе, странник. Каждая — это душа ушедшего мага, 
                  оставившего след в ткани мироздания. Смотри на них — и услышишь шёпот вечности.
                </div>
              </div>
              <div className="flex justify-end">
                <div className="chat-bubble-user px-4 py-3 max-w-xs text-sm text-white">
                  А ты умеешь ими управлять?
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-800 to-teal-900 flex items-center justify-center text-sm flex-shrink-0">
                  🧝‍♀️
                </div>
                <div className="chat-bubble-ai px-4 py-3 max-w-sm text-sm leading-relaxed">
                  <div className="flex gap-1.5">
                    <div className="typing-dot w-2 h-2 bg-purple-400 rounded-full mt-1" />
                    <div className="typing-dot w-2 h-2 bg-purple-400 rounded-full mt-1" />
                    <div className="typing-dot w-2 h-2 bg-purple-400 rounded-full mt-1" />
                  </div>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="px-5 py-4 border-t border-purple-900/20 flex items-center gap-3">
              <div className="flex-1 input-dark rounded-xl px-4 py-3 text-sm text-gray-400">
                Напиши сообщение...
              </div>
              <button className="w-10 h-10 rounded-xl bg-purple-900/30 border border-purple-700/30 flex items-center justify-center text-purple-400 hover:bg-purple-800/30 transition-colors">
                <Mic className="w-4 h-4" />
              </button>
              <button className="w-10 h-10 rounded-xl btn-primary flex items-center justify-center">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Всё что нужно для <span className="gradient-text">живых персонажей</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Платформа объединяет лучшие AI-технологии в единый простой интерфейс
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i * 0.5}
                className="glass rounded-xl p-6 character-card"
              >
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 border-t border-purple-900/20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Как это <span className="gradient-text">работает</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: Brain,
                title: 'Создай персонажа',
                desc: 'Задай имя, характер, историю, голос и поведенческие модели через простой конструктор.',
              },
              {
                step: '02',
                icon: MessageCircle,
                title: 'Общайся',
                desc: 'Разговаривай текстом или голосом. AI запоминает контекст разговора и остаётся в роли.',
              },
              {
                step: '03',
                icon: Code2,
                title: 'Встраивай через API',
                desc: 'Подключай персонажей к своим играм, приложениям или сайтам через простой REST API.',
              },
            ].map((step, i) => (
              <motion.div
                key={step.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="relative text-center"
              >
                <div className="text-6xl font-black text-purple-900/30 mb-4">{step.step}</div>
                <div className="w-12 h-12 rounded-2xl bg-purple-900/30 border border-purple-700/30 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20 px-4 border-t border-purple-900/20">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Где <span className="gradient-text">применять</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {usecases.map((u, i) => (
              <motion.div
                key={u.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i * 0.5}
                className="glass rounded-xl p-6 flex gap-4 character-card"
              >
                <div className="text-3xl">{u.emoji}</div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{u.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{u.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-16 px-4 border-t border-purple-900/20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-bold mb-2 text-gray-300">Технологический стек</h2>
            <p className="text-gray-500 text-sm">Бесплатные и открытые технологии</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Cpu, name: 'DeepSeek V3', desc: 'Основной LLM', color: 'text-blue-400' },
              { icon: Zap, name: 'Groq / Llama', desc: 'Скоростной LLM', color: 'text-yellow-400' },
              { icon: Volume2, name: 'Edge TTS', desc: 'Синтез речи', color: 'text-green-400' },
              { icon: Mic, name: 'Web Speech', desc: 'Распознавание', color: 'text-purple-400' },
            ].map((tech, i) => (
              <motion.div
                key={tech.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i * 0.3}
                className="glass rounded-xl p-4 text-center"
              >
                <tech.icon className={`w-8 h-8 mx-auto mb-2 ${tech.color}`} />
                <div className="font-semibold text-sm text-white">{tech.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{tech.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="glass rounded-2xl p-10 glow-sm">
            <div className="text-4xl mb-4">🚀</div>
            <h2 className="text-3xl font-bold mb-4">
              Готов начать?
            </h2>
            <p className="text-gray-400 mb-8">
              Выбери персонажа и начни общаться прямо сейчас — бесплатно, без регистрации
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setPage('characters')}
                className="btn-primary px-8 py-4 text-base flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5" />
                Выбрать персонажа
              </button>
              <button
                onClick={() => setPage('create')}
                className="btn-ghost px-8 py-4 text-base flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Создать своего
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-purple-900/20 py-8 px-4 text-center text-gray-600 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Cpu className="w-4 h-4 text-purple-700" />
          <span className="gradient-text font-semibold">NeuralCast</span>
        </div>
        <p>Платформа AI-персонажей нового поколения · 2025</p>
      </footer>
    </div>
  );
}
