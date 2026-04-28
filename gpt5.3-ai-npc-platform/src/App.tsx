import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Character = {
  id: string;
  name: string;
  role: string;
  tone: string;
  traits: string[];
  sample: string;
};

const characters: Character[] = [
  {
    id: "archivist",
    name: "Mara Archivist",
    role: "Lore Guide",
    tone: "Calm, precise, narrative-first",
    traits: ["Long-term memory", "Context-aware hints", "Quest-safe guardrails"],
    sample: "I remember what you discovered in the catacombs. We can continue from that clue.",
  },
  {
    id: "captain",
    name: "Captain Rook",
    role: "Squad Commander",
    tone: "Direct, tactical, mission-driven",
    traits: ["Action planner", "Voice command mode", "Combat behavior profile"],
    sample: "Hold left flank. I will mark enemy movement and update your route every 10 seconds.",
  },
  {
    id: "merchant",
    name: "Vexa Vale",
    role: "Dynamic Merchant",
    tone: "Friendly, witty, persuasive",
    traits: ["Pricing logic", "Player reputation memory", "Multilingual voice"],
    sample: "You helped my caravan last night, so this artifact is now 20 percent cheaper for you.",
  },
];

const sprintItems = [
  "Конструктор персонажей: характер, цели, ограничения, стиль речи",
  "Текст + голос в реальном времени с низкой задержкой",
  "Память NPC: краткосрочная, эпизодическая, долговременная",
  "RAG по документам проекта и лору игрового мира",
  "Публичный API и WebSocket для игровых интеграций",
];

const roadmap = [
  {
    week: "Недели 1-2",
    title: "Core платформы",
    description: "CRUD персонажей, сессии, текстовый диалог, базовые guardrails и логирование.",
  },
  {
    week: "Недели 3-4",
    title: "Realtime voice",
    description: "STT/TTS стриминг, управление голосами, память и knowledge base персонажей.",
  },
  {
    week: "Неделя 5",
    title: "API + SDK",
    description: "REST/WebSocket API, игровые события и стартовый SDK для Web/Unity.",
  },
  {
    week: "Неделя 6",
    title: "Production readiness",
    description: "Наблюдаемость, rate limit, биллинг, нагрузочные тесты, staging и релиз.",
  },
];

export default function App() {
  const [activeId, setActiveId] = useState(characters[0].id);

  const activeCharacter = useMemo(
    () => characters.find((character) => character.id === activeId) ?? characters[0],
    [activeId]
  );

  return (
    <div className="bg-slate-950 text-slate-100">
      <section className="relative flex min-h-screen items-end overflow-hidden">
        <motion.img
          src="https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&w=1920&q=80"
          alt="Futuristic NPC command center"
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.8, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/20" />

        <motion.div
          className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 sm:px-10 lg:px-12 lg:pb-20"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-sm tracking-[0.22em] text-cyan-300">NPC FORGE</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Платформа для множества AI-персонажей с голосом, памятью и API для игр
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            Запускаем первую рабочую версию: отдельные личности NPC, текстовый и голосовой диалог, а также
            встраивание в игровые миры через realtime API.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button className="bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
              Старт Sprint 0
            </button>
            <button className="border border-slate-200/40 px-6 py-3 text-sm font-semibold text-white transition hover:border-slate-100">
              Архитектура и API
            </button>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Что уже можем делать первым релизом</h2>
        <p className="mt-3 max-w-2xl text-slate-300">
          Этот этап закрывает основу продукта, чтобы быстро выйти на тест с реальными пользователями и командами
          разработки игр.
        </p>

        <motion.ul
          className="mt-10 grid gap-6 text-slate-200 sm:grid-cols-2"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.12 },
            },
          }}
        >
          {sprintItems.map((item) => (
            <motion.li
              key={item}
              className="border-b border-slate-700 pb-4"
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
            >
              {item}
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Прототип каталога AI-персонажей</h2>
        <p className="mt-3 max-w-2xl text-slate-300">
          Каждый персонаж хранит свой профиль поведения, память и стиль общения. Ниже интерактивный макет как это
          будет выглядеть в админке.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Персонажи проекта</p>
            <div className="mt-4 space-y-3">
              {characters.map((character) => {
                const isActive = character.id === activeId;

                return (
                  <button
                    key={character.id}
                    onClick={() => setActiveId(character.id)}
                    className={`w-full border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-cyan-300 bg-cyan-300/10 text-cyan-100"
                        : "border-slate-700 text-slate-200 hover:border-slate-500"
                    }`}
                  >
                    <p className="font-medium">{character.name}</p>
                    <p className="text-sm text-slate-400">{character.role}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/60 p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCharacter.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.24 }}
              >
                <p className="text-sm text-slate-400">Профиль персонажа</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">{activeCharacter.name}</h3>
                <p className="mt-1 text-slate-300">{activeCharacter.tone}</p>

                <div className="mt-6 space-y-3 text-sm text-slate-200">
                  {activeCharacter.traits.map((trait) => (
                    <p key={trait} className="border-l-2 border-cyan-300/70 pl-3">
                      {trait}
                    </p>
                  ))}
                </div>

                <div className="mt-7 border border-slate-700 bg-slate-950/60 p-4 text-slate-200">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Пример ответа</p>
                  <p className="mt-3">{activeCharacter.sample}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">API для интеграции в игровые персонажи</h2>
        <p className="mt-3 max-w-2xl text-slate-300">
          Начинаем с стандартного REST и realtime WebSocket. Этого достаточно для Web, Unity, Unreal и кастомных
          движков.
        </p>

        <div className="mt-10 border border-slate-800 bg-slate-950 p-6 font-mono text-sm text-slate-200">
          <p className="text-cyan-300">POST /v1/sessions</p>
          <p className="mt-2">Создать сессию пользователя с выбранным NPC</p>
          <p className="mt-5 text-cyan-300">POST /v1/messages</p>
          <p className="mt-2">Отправить текст, получить ответ и действие персонажа</p>
          <p className="mt-5 text-cyan-300">WS /v1/realtime</p>
          <p className="mt-2">Стрим голоса и событий: transcript, audio_chunk, npc_action</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">План реализации</h2>
        <div className="mt-10 space-y-6">
          {roadmap.map((phase) => (
            <motion.div
              key={phase.week}
              className="border-l border-slate-700 pl-6"
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.35 }}
            >
              <p className="text-sm text-cyan-300">{phase.week}</p>
              <h3 className="mt-1 text-xl font-semibold text-white">{phase.title}</h3>
              <p className="mt-2 max-w-3xl text-slate-300">{phase.description}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
