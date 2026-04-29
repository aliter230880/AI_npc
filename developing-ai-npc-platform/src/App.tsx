import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  checkRuntimeStatus,
  CharacterMemory,
  clearCharacterMemories,
  createSession,
  getCharacterConfig,
  getCharacterMemories,
  getSessionMessages,
  listCharacters,
  NpcCharacter,
  NpcMessage,
  RealtimeEvent,
  NpcSession,
  sendMessage,
  transcribeAudio,
  updateCharacterConfig,
  RuntimeStatus,
} from "./services/npcApi";
import { executeNpcAction } from "./services/gameHooks";
import { AuthUser, clearAuthToken, getMeAuth, loginAuth, registerAuth } from "./services/auth";

const baseApi =
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ??
    "http://localhost:8787/v1").trim();

export default function App() {
  const [characters, setCharacters] = useState<NpcCharacter[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [session, setSession] = useState<NpcSession | null>(null);
  const [messages, setMessages] = useState<NpcMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState("");
  const [realtimeFeed, setRealtimeFeed] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceDisabledReason, setVoiceDisabledReason] = useState("");
  const [bootError, setBootError] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [configTone, setConfigTone] = useState("");
  const [configOpening, setConfigOpening] = useState("");
  const [configSystemPrompt, setConfigSystemPrompt] = useState("");
  const [configBehaviorText, setConfigBehaviorText] = useState("");
  const [characterMemories, setCharacterMemories] = useState<CharacterMemory[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminNotice, setAdminNotice] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const audioChunksRef = useRef<string[]>([]);
  const audioCodecRef = useRef<string>("");
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const speechSupported =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

  function pushRealtime(line: string) {
    setRealtimeFeed((prev) => {
      if (prev[prev.length - 1] === line) {
        return prev;
      }

      return [...prev.slice(-5), line];
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      const me = await getMeAuth();
      if (!cancelled) {
        setAuthUser(me);
        setAuthLoading(false);
      }
    }

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function probeRuntime() {
      const status = await checkRuntimeStatus();
      if (!cancelled) {
        setRuntimeStatus(status);
      }
    }

    void probeRuntime();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const activeCharacter = useMemo(
    () => characters.find((character) => character.id === activeId) ?? null,
    [characters, activeId]
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authUser) {
      setCharacters([]);
      setActiveId("");
      setSession(null);
      setMessages([]);
      return;
    }

    let cancelled = false;

    async function boot() {
      try {
        setBootError("");
        const loaded = await listCharacters();

        if (!cancelled) {
          setCharacters(loaded);
          setActiveId((current) => current || loaded[0]?.id || "");
        }
      } catch {
        if (!cancelled) {
          setBootError("Не удалось загрузить персонажей.");
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [authUser, authLoading]);

  useEffect(() => {
    if (!activeCharacter) {
      return;
    }

    const selectedCharacter = activeCharacter;

    let cancelled = false;

    async function initSession() {
      const nextSession = await createSession(selectedCharacter.id);
      const history = await getSessionMessages(nextSession.id);

      if (cancelled) {
        return;
      }

      setSession(nextSession);

      if (history.length) {
        setMessages(history);
      } else {
        setMessages([
          {
            id: `${nextSession.id}_opening`,
            role: "npc",
            sessionId: nextSession.id,
            content: selectedCharacter.opening,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      setStreaming("");
      setRealtimeFeed([]);
    }

    void initSession();

    return () => {
      cancelled = true;
    };
  }, [activeCharacter]);

  useEffect(() => {
    if (!activeCharacter || !authUser) {
      setConfigTone("");
      setConfigOpening("");
      setConfigSystemPrompt("");
      setConfigBehaviorText("");
      setCharacterMemories([]);
      return;
    }

    const selectedCharacter = activeCharacter;

    let cancelled = false;
    setAdminLoading(true);
    setAdminNotice("");

    async function loadAdminData() {
      try {
        const [config, memoriesList] = await Promise.all([
          getCharacterConfig(selectedCharacter.id),
          getCharacterMemories(selectedCharacter.id, 12),
        ]);

        if (cancelled) {
          return;
        }

        setConfigTone(config.tone || "");
        setConfigOpening(config.opening || "");
        setConfigSystemPrompt(config.systemPrompt || "");
        setConfigBehaviorText((config.behavior || []).join("\n"));
        setCharacterMemories(memoriesList);
      } catch {
        if (!cancelled) {
          setAdminNotice("Не удалось загрузить конфиг/память персонажа");
        }
      } finally {
        if (!cancelled) {
          setAdminLoading(false);
        }
      }
    }

    void loadAdminData();

    return () => {
      cancelled = true;
    };
  }, [activeCharacter, authUser]);

  async function sendUserInput(text: string, inputType: "text" | "voice") {
    if (!authUser) {
      pushRealtime("[auth] сначала войдите в систему");
      return;
    }

    if (!activeCharacter || !session || isBusy) {
      return;
    }

    setIsBusy(true);

    const userMessage: NpcMessage = {
      id: `ui_${Date.now()}`,
      sessionId: session.id,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setStreaming("");
    audioChunksRef.current = [];
    audioCodecRef.current = "";

    function handleRealtimeEvent(event: RealtimeEvent) {
      if (event.type === "transcript") {
        const line = `[transcript:${event.source}] ${event.text}`;
        pushRealtime(line);
        return;
      }

      if (event.type === "npc_action") {
        const params = event.params ? ` ${JSON.stringify(event.params)}` : "";
        const result = executeNpcAction(event.action, event.params ?? {});
        const line = `[npc_action] ${event.action} (${Math.round(event.confidence * 100)}%)${params}`;
        const statusLine = `[game_hook:${result.status}] ${result.message}`;
        pushRealtime(line);
        pushRealtime(statusLine);
        return;
      }

      if (event.type === "audio_chunk") {
        audioCodecRef.current = event.codec;
        audioChunksRef.current.push(event.data);
      }

      const line = `[audio_chunk] seq=${event.seq} codec=${event.codec}`;
      pushRealtime(line);
    }

    function playMp3Chunks() {
      if (audioCodecRef.current !== "mp3" || !audioChunksRef.current.length) {
        return;
      }

      const bytes = audioChunksRef.current.flatMap((chunk) => {
        const binary = atob(chunk);
        return Array.from(binary, (char) => char.charCodeAt(0));
      });

      const blob = new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      void audio.play().finally(() => {
        URL.revokeObjectURL(url);
      });
    }

    try {
      const reply = await sendMessage(session.id, activeCharacter.id, text, setStreaming, {
        onRealtimeEvent: handleRealtimeEvent,
        inputType,
      });
      setMessages((prev) => [...prev, reply]);
      setStreaming("");
      playMp3Chunks();
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      return;
    }

    setDraft("");
    await sendUserInput(text, "text");
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");

    if (!authEmail.trim() || authPassword.length < 6) {
      setAuthError("Введите email и пароль не короче 6 символов");
      return;
    }

    setAuthLoading(true);
    try {
      const user =
        authMode === "login"
          ? await loginAuth(authEmail.trim(), authPassword)
          : await registerAuth(authEmail.trim(), authPassword, authName.trim() || "User");

      setAuthUser(user);
      setAuthPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Ошибка авторизации");
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    clearAuthToken();
    setAuthUser(null);
    setMessages([]);
    setSession(null);
    pushRealtime("[auth] выполнен выход");
  }

  async function handleSaveCharacterConfig() {
    if (!activeCharacter || !authUser || adminSaving) {
      return;
    }

    setAdminSaving(true);
    setAdminNotice("");

    try {
      const nextBehavior = configBehaviorText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);

      const updated = await updateCharacterConfig(activeCharacter.id, {
        tone: configTone,
        opening: configOpening,
        systemPrompt: configSystemPrompt,
        behavior: nextBehavior,
      });

      setCharacters((prev) =>
        prev.map((character) =>
          character.id === updated.id
            ? {
                ...character,
                tone: updated.tone,
                opening: updated.opening,
                behavior: updated.behavior,
                systemPrompt: updated.systemPrompt,
              }
            : character
        )
      );

      setConfigBehaviorText(updated.behavior.join("\n"));
      setAdminNotice("Конфиг персонажа сохранен");
    } catch {
      setAdminNotice("Ошибка сохранения конфига");
    } finally {
      setAdminSaving(false);
    }
  }

  async function handleClearMemories() {
    if (!activeCharacter || !authUser || adminSaving) {
      return;
    }

    setAdminSaving(true);
    setAdminNotice("");

    try {
      const result = await clearCharacterMemories(activeCharacter.id);
      setCharacterMemories([]);
      setAdminNotice(`Память очищена: удалено ${result.removed}`);
    } catch {
      setAdminNotice("Не удалось очистить память");
    } finally {
      setAdminSaving(false);
    }
  }

  async function recordAndTranscribeWithServerStt() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      pushRealtime("[voice] MediaRecorder is not supported in this browser");
      return;
    }

    setIsListening(true);
    pushRealtime("[voice] server STT recording started (4s)");

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: BlobPart[] = [];

      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onerror = () => reject(new Error("Recorder failure"));
        recorder.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" }));

        recorder.start();
        setTimeout(() => recorder.stop(), 4000);
      });

      const transcript = await transcribeAudio(blob, "ru");
      if (!transcript) {
        pushRealtime("[voice] STT did not return transcript");
        return;
      }

      pushRealtime(`[voice] transcript: ${transcript}`);
      await sendUserInput(transcript, "voice");
    } catch (error) {
      const message = error instanceof Error ? error.message : "server stt error";
      pushRealtime(`[voice] ${message}`);
    } finally {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsListening(false);
    }
  }

  async function handleVoiceInput() {
    if (isBusy || isListening || recognitionRef.current) {
      return;
    }

    if (!speechSupported || voiceDisabledReason) {
      await recordAndTranscribeWithServerStt();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      pushRealtime("[voice] microphone API not available in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      const message = error instanceof Error ? error.message : "microphone permission denied";
      pushRealtime(`[voice] ${message}`);
      setVoiceDisabledReason("Нет доступа к микрофону");
      return;
    }

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        start: () => void;
        stop: () => void;
        onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onend: (() => void) | null;
        onerror: ((event: { error: string }) => void) | null;
      } }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        start: () => void;
        stop: () => void;
        onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onend: (() => void) | null;
        onerror: ((event: { error: string }) => void) | null;
      } }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      if (transcript) {
        void sendUserInput(transcript, "voice");
      }
    };

    recognition.onerror = (event) => {
      const errorCode = event.error || "unknown";
      const prettyMessage =
        errorCode === "not-allowed"
          ? "Доступ к микрофону запрещен в браузере"
          : errorCode === "service-not-allowed"
            ? "Сервис распознавания речи недоступен"
            : errorCode === "no-speech"
              ? "Речь не распознана, попробуйте снова"
              : `speech recognition error: ${errorCode}`;

      pushRealtime(`[voice] ${prettyMessage}`);

      if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
        setVoiceDisabledReason("Голос отключен: проверьте разрешения микрофона/браузер");
        void recordAndTranscribeWithServerStt();
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }

  return (
    <div className="bg-slate-950 text-slate-100">
      <section className="relative flex min-h-[85vh] items-end overflow-hidden">
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
            Your AI friend is here and waiting for you!
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            Сейчас активирован первый runtime: отдельные NPC с характером, текстовый диалог с потоковым ответом и
            подготовленный API-контур для дальнейшего backend-подключения.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-200">
            <p>Target: {baseApi}</p>
            <p>Mode: frontend prototype with API-compatible service layer</p>
            {runtimeStatus ? (
              <p className={runtimeStatus.healthy ? "text-emerald-300" : "text-amber-300"}>{runtimeStatus.message}</p>
            ) : null}
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 sm:px-10 lg:px-12">
        <div className="border border-slate-800 bg-slate-900/60 p-6">
          {authUser ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Вы вошли как</p>
                <p className="text-lg font-semibold text-white">{authUser.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-400"
              >
                Выйти
              </button>
            </div>
          ) : (
            <form className="grid gap-4 md:grid-cols-4" onSubmit={handleAuthSubmit}>
              <div className="md:col-span-2">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                  {authMode === "login" ? "Вход" : "Регистрация"}
                </p>
                <input
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Email"
                />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-500">Пароль</p>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Не менее 6 символов"
                />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-500">Имя</p>
                <input
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Только для регистрации"
                />
              </div>
              <div className="md:col-span-4 flex flex-wrap items-center gap-3">
                <button
                  disabled={authLoading}
                  className="bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  {authLoading ? "Загрузка..." : authMode === "login" ? "Войти" : "Создать аккаунт"}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode((mode) => (mode === "login" ? "register" : "login"))}
                  className="text-sm text-cyan-300 underline underline-offset-4"
                >
                  {authMode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
                </button>
                {authError ? <p className="text-sm text-rose-300">{authError}</p> : null}
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">MVP консоль: персонажи и чат-сессии</h2>
        <p className="mt-3 max-w-2xl text-slate-300">
          Ниже уже рабочий прототип слоя взаимодействия. Он позволяет переключать NPC, создавать сессию и вести диалог
          в формате, совместимом с будущим backend API.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[320px_1fr]">
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
            {bootError ? <p className="mt-4 text-sm text-rose-300">{bootError}</p> : null}
          </div>

          <div className="border border-slate-800 bg-slate-900/60 p-6">
            <AnimatePresence mode="wait">
              {activeCharacter ? (
                <motion.div
                  key={activeCharacter.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-sm text-slate-400">Активный профиль</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{activeCharacter.name}</h3>
                  <p className="mt-1 text-slate-300">{activeCharacter.tone}</p>

                  <div className="mt-5 grid gap-2 text-sm text-slate-200 sm:grid-cols-3">
                    {activeCharacter.behavior.map((trait) => (
                      <p key={trait} className="border border-slate-700 px-3 py-2">
                        {trait}
                      </p>
                    ))}
                  </div>

                  <div className="mt-6 border border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Session</p>
                    <p className="mt-2 text-sm text-slate-300">{session?.id ?? "Создается..."}</p>
                  </div>

                  <ul className="mt-6 h-72 space-y-3 overflow-y-auto pr-2">
                    {messages.map((message) => (
                      <motion.li
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={message.role === "user" ? "text-right" : "text-left"}
                      >
                        <p
                          className={`inline-block max-w-[85%] px-4 py-3 text-sm ${
                            message.role === "user"
                              ? "bg-cyan-300 text-slate-950"
                              : "border border-slate-700 bg-slate-900 text-slate-100"
                          }`}
                        >
                          {message.content}
                        </p>
                      </motion.li>
                    ))}
                    {streaming ? (
                      <motion.li
                        className="text-left"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ repeat: Infinity, repeatType: "mirror", duration: 0.7 }}
                      >
                        <p className="inline-block max-w-[85%] border border-cyan-300/40 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
                          {streaming}
                        </p>
                      </motion.li>
                    ) : null}
                  </ul>

                  <form className="mt-5 flex gap-3" onSubmit={handleSend}>
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
                      placeholder="Отправь сообщение NPC..."
                    />
                    <button
                      disabled={isBusy}
                      className="bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? "Генерация" : "Отправить"}
                    </button>
                    <button
                      type="button"
                      onClick={handleVoiceInput}
                      disabled={isBusy || isListening}
                      className="border border-slate-600 px-4 py-3 text-xs font-semibold text-slate-200 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isListening ? "Слушаю" : "Голос"}
                    </button>
                  </form>

                  {voiceDisabledReason ? <p className="mt-2 text-xs text-rose-300">{voiceDisabledReason}</p> : null}
                  {voiceDisabledReason ? (
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceDisabledReason("");
                        pushRealtime("[voice] статус сброшен, попробуйте снова");
                      }}
                      className="mt-2 text-xs text-cyan-300 underline underline-offset-4"
                    >
                      Сбросить голосовой статус
                    </button>
                  ) : null}

                  <div className="mt-4 border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Realtime events</p>
                    <div className="mt-2 space-y-1">
                      {realtimeFeed.length ? (
                        realtimeFeed.map((item, index) => <p key={`${item}_${index}`}>{item}</p>)
                      ) : (
                        <p className="text-slate-500">Ожидание событий realtime...</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Admin NPC</h2>
        <p className="mt-3 max-w-2xl text-slate-300">
          Редактируй поведение активного персонажа и управляй его долгосрочной памятью прямо из интерфейса.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="border border-slate-800 bg-slate-900/60 p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Character Config</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-xs text-slate-400">Tone</p>
                <input
                  value={configTone}
                  onChange={(event) => setConfigTone(event.target.value)}
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Тон персонажа"
                />
              </div>
              <div>
                <p className="mb-2 text-xs text-slate-400">Opening</p>
                <textarea
                  value={configOpening}
                  onChange={(event) => setConfigOpening(event.target.value)}
                  rows={2}
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Стартовая реплика"
                />
              </div>
              <div>
                <p className="mb-2 text-xs text-slate-400">System Prompt</p>
                <textarea
                  value={configSystemPrompt}
                  onChange={(event) => setConfigSystemPrompt(event.target.value)}
                  rows={4}
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Ключевая инструкция для LLM"
                />
              </div>
              <div>
                <p className="mb-2 text-xs text-slate-400">Behavior (one line = one rule)</p>
                <textarea
                  value={configBehaviorText}
                  onChange={(event) => setConfigBehaviorText(event.target.value)}
                  rows={5}
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSaveCharacterConfig}
                disabled={!activeCharacter || !authUser || adminSaving || adminLoading}
                className="bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {adminSaving ? "Сохранение..." : "Сохранить конфиг"}
              </button>
              {adminLoading ? <p className="text-sm text-slate-400">Загрузка данных...</p> : null}
              {adminNotice ? <p className="text-sm text-cyan-200">{adminNotice}</p> : null}
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Long-term Memories</p>
              <button
                type="button"
                onClick={handleClearMemories}
                disabled={!activeCharacter || !authUser || adminSaving || adminLoading}
                className="border border-slate-600 px-3 py-1 text-xs text-slate-200 disabled:opacity-60"
              >
                Очистить память
              </button>
            </div>

            <div className="mt-4 h-72 space-y-2 overflow-y-auto pr-2 text-sm text-slate-200">
              {characterMemories.length ? (
                characterMemories.map((memory) => (
                  <div key={memory.id} className="border border-slate-700 bg-slate-950/70 p-3">
                    <p className="text-xs text-slate-400">{new Date(memory.createdAt).toLocaleString()}</p>
                    <p className="mt-2 whitespace-pre-wrap">{memory.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">Память пока пустая</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Контракт API и деплой-контекст</h2>
        <p className="mt-3 max-w-2xl text-slate-300">
          Интерфейс уже построен вокруг API-модели, поэтому следующий шаг - поднять backend на отдельном домене и
          переключить сервисный слой с local runtime на live endpoint.
        </p>

        <div className="mt-10 border border-slate-800 bg-slate-950 p-6 font-mono text-sm text-slate-200">
          <p className="text-cyan-300">Deploy target</p>
          <p className="mt-2">https://web3.aliterra.space/</p>
          <p className="mt-5 text-cyan-300">API base (planned)</p>
          <p className="mt-2">https://api.web3.aliterra.space/v1</p>
          <p className="text-cyan-300">POST /v1/sessions</p>
          <p className="mt-2">Создать сессию пользователя с выбранным NPC</p>
          <p className="mt-5 text-cyan-300">POST /v1/messages</p>
          <p className="mt-2">Отправить текст, получить ответ и действие персонажа</p>
          <p className="mt-5 text-cyan-300">WS /v1/realtime</p>
          <p className="mt-2">Стрим голоса и событий: transcript, audio_chunk, npc_action</p>
          <p className="mt-5 text-cyan-300">ENV</p>
          <p className="mt-2">VITE_API_BASE_URL=https://api.web3.aliterra.space/v1</p>
          <p className="mt-2">VITE_WS_URL=wss://api.web3.aliterra.space/v1/realtime</p>
        </div>
      </section>
    </div>
  );
}
