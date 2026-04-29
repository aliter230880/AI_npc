import { FormEvent, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { presetNpcs, type NpcPreset } from "./data/presets";
import { voiceReferences } from "./data/voiceReferences";
import { getNpcReply, type LlmProvider, type RuntimeConfig, type TransportMode } from "./services/runtime";
import type { AuthUser } from "./services/authMock";
import {
  getAuthMode,
  isBackendAuthReady,
  loginUser,
  logoutUser,
  registerUser,
  resetPreviewAuthData,
  restoreAuthUser,
} from "./services/authApi";
import {
  createBackendCharacter,
  ensureBackendSession,
  getBackendTtsVoices,
  getRuntimeMode,
  sendBackendMessage,
  synthesizeBackendTts,
  type TtsVoice,
  type RuntimeMode,
} from "./services/backendRuntime";

type AuthMode = "login" | "register";
type SttMode = "faster-whisper" | "browser";
type TtsMode = "backend-engine" | "speech-synthesis" | "reference-sample";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type RecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type RecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  start: () => void;
};

type RecognitionCtor = new () => RecognitionInstance;

const stackRows = [
  ["STT", "faster-whisper", "Бесплатно, open-source, локальный запуск"],
  ["LLM", "Ollama / OpenRouter free", "Локально или free-tier облака"],
  ["TTS", "Piper / SpeechSynthesis", "Оффлайн качество + fallback в браузере"],
  ["Realtime", "WebSocket", "Низкая задержка и двусторонний стрим"],
] as const;

const initialRuntime: RuntimeConfig = {
  provider: "preview",
  transport: "http",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "qwen2.5:7b-instruct",
  openRouterApiKey: "",
  openRouterModel: "meta-llama/llama-3.1-8b-instruct:free",
  websocketUrl: "ws://localhost:8787/v1/realtime",
};

const emptyNpcDraft: NpcPreset = {
  id: "",
  name: "",
  role: "",
  tone: "",
  traits: [],
  opening: "",
  systemPrompt: "",
  voiceHint: "custom_voice",
};

const CUSTOM_NPC_STORAGE_KEY = "ai_npc_custom_npcs_v1";
const RUNTIME_MODE_STORAGE_KEY = "ai_npc_runtime_mode";
const VOICE_REFERENCE_STORAGE_KEY = "ai_npc_voice_reference";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [customNpcs, setCustomNpcs] = useState<NpcPreset[]>([]);
  const [activeId, setActiveId] = useState(presetNpcs[0].id);
  const [runtime, setRuntime] = useState<RuntimeConfig>(initialRuntime);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(getRuntimeMode());
  const [sttMode, setSttMode] = useState<SttMode>("browser");
  const [ttsMode, setTtsMode] = useState<TtsMode>("backend-engine");
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState("");
  const [selectedReferenceVoiceId, setSelectedReferenceVoiceId] = useState(voiceReferences[0]?.id || "");
  const [ttsVoices, setTtsVoices] = useState<TtsVoice[]>([]);
  const [ttsProvider, setTtsProvider] = useState("piper");
  const [ttsVoiceId, setTtsVoiceId] = useState("ru_RU-irina-medium");
  const [characterBackendVoiceMap, setCharacterBackendVoiceMap] = useState<Record<string, string>>({});
  const [characterBrowserVoiceMap, setCharacterBrowserVoiceMap] = useState<Record<string, string>>({});
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [speechRate, setSpeechRate] = useState(0.95);
  const [speechPitch, setSpeechPitch] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sttLanguage, setSttLanguage] = useState("ru-RU");
  const [micIssue, setMicIssue] = useState("");
  const [runtimeLog, setRuntimeLog] = useState<string[]>([]);
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({});

  const [draftNpc, setDraftNpc] = useState<NpcPreset>(emptyNpcDraft);
  const [draftTraits, setDraftTraits] = useState("strategic, friendly");
  const backendReady = isBackendAuthReady();

  const allNpcs = useMemo(() => [...presetNpcs, ...customNpcs], [customNpcs]);
  const activeNpc = allNpcs.find((npc) => npc.id === activeId) || allNpcs[0];

  useEffect(() => {
    async function bootstrapAuth() {
      const restored = await restoreAuthUser();
      if (restored) {
        setUser(restored);
      }
      setIsAuthLoading(false);
    }

    void bootstrapAuth();

    const customRaw = localStorage.getItem(CUSTOM_NPC_STORAGE_KEY);
    if (customRaw) {
      try {
        const parsed = JSON.parse(customRaw) as NpcPreset[];
        setCustomNpcs(parsed);
      } catch {
        setCustomNpcs([]);
      }
    }

    const modeRaw = localStorage.getItem(RUNTIME_MODE_STORAGE_KEY);
    if (modeRaw === "backend" || modeRaw === "direct") {
      setRuntimeMode(modeRaw);
    }

    const voiceRefRaw = localStorage.getItem(VOICE_REFERENCE_STORAGE_KEY);
    if (voiceRefRaw && voiceReferences.some((item) => item.id === voiceRefRaw)) {
      setSelectedReferenceVoiceId(voiceRefRaw);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CUSTOM_NPC_STORAGE_KEY, JSON.stringify(customNpcs));
  }, [customNpcs]);

  useEffect(() => {
    function loadVoices() {
      const voices = window.speechSynthesis?.getVoices?.() || [];
      if (!voices.length) {
        return;
      }

      setBrowserVoices(voices);
      setSelectedVoiceUri((prev) => {
        if (prev && voices.some((voice) => voice.voiceURI === prev)) {
          return prev;
        }

        const preferred =
          voices.find((voice) => voice.lang.toLowerCase().startsWith("ru") && /google|microsoft|natural|enhanced/i.test(voice.name)) ||
          voices.find((voice) => voice.lang.toLowerCase().startsWith("ru")) ||
          voices.find((voice) => /google|microsoft|natural|enhanced/i.test(voice.name)) ||
          voices[0];

        return preferred?.voiceURI || "";
      });
    }

    loadVoices();
    if (typeof window.speechSynthesis !== "undefined") {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window.speechSynthesis !== "undefined") {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(RUNTIME_MODE_STORAGE_KEY, runtimeMode);
  }, [runtimeMode]);

  useEffect(() => {
    localStorage.setItem(VOICE_REFERENCE_STORAGE_KEY, selectedReferenceVoiceId);
  }, [selectedReferenceVoiceId]);

  useEffect(() => {
    if (runtimeMode === "backend" && !backendReady) {
      setRuntimeMode("direct");
      pushLog("backend mode disabled in preview: switch to auth api + api base url");
    }
  }, [runtimeMode, backendReady]);

  useEffect(() => {
    async function loadBackendVoices() {
      if (!backendReady || !user) {
        return;
      }

      try {
        const items = await getBackendTtsVoices();
        if (!items.length) {
          return;
        }

        setTtsVoices(items);
        setTtsProvider((prev) => (items.some((item) => item.provider === prev) ? prev : items[0].provider));
        setTtsVoiceId((prev) => (items.some((item) => item.id === prev) ? prev : items[0].id));
      } catch {
        pushLog("Failed to load backend TTS voices");
      }
    }

    void loadBackendVoices();
  }, [backendReady, user]);

  useEffect(() => {
    if (!activeNpc || !browserVoices.length) {
      return;
    }

    const mapped = characterBrowserVoiceMap[activeNpc.id];
    if (mapped && browserVoices.some((voice) => voice.voiceURI === mapped)) {
      setSelectedVoiceUri(mapped);
      return;
    }

    const index = Math.abs(hashString(activeNpc.id)) % browserVoices.length;
    const fallback = browserVoices[index]?.voiceURI;
    if (fallback) {
      setSelectedVoiceUri(fallback);
      setCharacterBrowserVoiceMap((prev) => ({ ...prev, [activeNpc.id]: fallback }));
    }
  }, [activeNpc, browserVoices, characterBrowserVoiceMap]);

  useEffect(() => {
    if (!activeNpc || !ttsVoices.length) {
      return;
    }

    const providerVoices = ttsVoices.filter((item) => item.provider === ttsProvider);
    if (!providerVoices.length) {
      return;
    }

    const mapped = characterBackendVoiceMap[activeNpc.id];
    if (mapped && providerVoices.some((voice) => voice.id === mapped)) {
      setTtsVoiceId(mapped);
      return;
    }

    const index = Math.abs(hashString(activeNpc.id)) % providerVoices.length;
    const fallback = providerVoices[index]?.id;
    if (fallback) {
      setTtsVoiceId(fallback);
      setCharacterBackendVoiceMap((prev) => ({ ...prev, [activeNpc.id]: fallback }));
    }
  }, [activeNpc, ttsVoices, ttsProvider, characterBackendVoiceMap]);

  function pushLog(message: string) {
    setRuntimeLog((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 10));
  }

  async function handleAuthSubmit(event: FormEvent) {
    event.preventDefault();
    setAuthError("");
    setIsAuthSubmitting(true);

    try {
      if (authMode === "register") {
        if (!authName.trim()) {
          throw new Error("Укажи имя");
        }
        const registered = await registerUser({
          name: authName,
          email: authEmail,
          password: authPassword,
        });
        setUser(registered);
        pushLog(`register success: ${registered.email} (${getAuthMode()})`);
        return;
      }

      const loggedIn = await loginUser({ email: authEmail, password: authPassword });
      setUser(loggedIn);
      pushLog(`login success: ${loggedIn.email} (${getAuthMode()})`);
    } catch (error) {
      if (error instanceof Error) {
        setAuthError(error.message);
      } else {
        setAuthError("Ошибка авторизации");
      }
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null);
    setMessages([]);
    pushLog("session closed");
  }

  async function handlePreviewDemoAccess() {
    setAuthError("");
    setIsAuthSubmitting(true);
    const demo = {
      name: "Preview User",
      email: "demo@preview.local",
      password: "demo12345",
    };

    try {
      const loggedIn = await loginUser({ email: demo.email, password: demo.password });
      setUser(loggedIn);
      pushLog("demo login success");
    } catch {
      try {
        const registered = await registerUser(demo);
        setUser(registered);
        pushLog("demo user registered and logged in");
      } catch {
        setAuthError("Не удалось войти в demo режим");
      }
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  function handleResetPreview() {
    resetPreviewAuthData();
    localStorage.removeItem(CUSTOM_NPC_STORAGE_KEY);
    localStorage.removeItem(RUNTIME_MODE_STORAGE_KEY);
    localStorage.removeItem(VOICE_REFERENCE_STORAGE_KEY);
    setCustomNpcs([]);
    setMessages([]);
    setSessionMap({});
    setRuntimeMode("direct");
    setRuntime(initialRuntime);
    setCharacterBackendVoiceMap({});
    setCharacterBrowserVoiceMap({});
    setSelectedReferenceVoiceId(voiceReferences[0]?.id || "");
    setUser(null);
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
    pushLog("preview data reset");
  }

  async function onSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || isSending) {
      return;
    }

    const userText = input.trim();
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: userText };
    const historyWithCurrent = [...messages, userMessage].map((item) => ({
      role: item.role,
      text: item.text,
    }));

    setInput("");
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    try {
      pushLog(`send via ${runtimeMode}:${runtime.transport}/${runtime.provider}`);

      let reply = "";
      if (runtimeMode === "backend" && backendReady) {
        let sessionId = sessionMap[activeNpc.id];
        if (!sessionId) {
          sessionId = await ensureBackendSession(activeNpc.id);
          setSessionMap((prev) => ({ ...prev, [activeNpc.id]: sessionId }));
          pushLog(`backend session created: ${activeNpc.name}`);
        }

        reply = await sendBackendMessage({
          sessionId,
          character: activeNpc,
          userText,
          history: historyWithCurrent,
          config: runtime,
        });
      } else {
        reply = await getNpcReply({
          character: activeNpc,
          userText,
          history: historyWithCurrent,
          config: runtime,
        });
      }

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);
      await streamText(assistantId, reply, setMessages);

      if (ttsMode === "speech-synthesis") {
        speakWithBrowser(reply, pushLog, {
          selectedVoiceUri,
          voices: browserVoices,
          rate: speechRate,
          pitch: speechPitch,
        });
      } else if (ttsMode === "backend-engine") {
        if (!backendReady) {
          pushLog("Backend TTS requires api mode");
        } else {
          try {
            const audio = await synthesizeBackendTts({
              text: reply,
              provider: ttsProvider,
              voiceId: ttsVoiceId,
              speed: ttsSpeed,
            });
            playBase64Audio(audio.audioBase64, audio.mimeType, pushLog);
          } catch {
            pushLog("Backend TTS generation failed");
          }
        }
      } else if (ttsMode === "reference-sample") {
        playReferenceVoiceSample(selectedReferenceVoiceId, pushLog);
        pushLog("Played selected voice reference sample");
      } else {
        pushLog("Unknown TTS mode");
      }
    } catch {
      pushLog("runtime error: fallback response used");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Сервис недоступен. Проверь runtime параметры и повтори попытку.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function handleCreateNpc(event: FormEvent) {
    event.preventDefault();
    if (!draftNpc.name.trim() || !draftNpc.role.trim()) {
      pushLog("npc create failed: name and role required");
      return;
    }

    let npc: NpcPreset = {
      ...draftNpc,
      id: `custom-${Date.now()}`,
      traits: draftTraits
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
      opening: draftNpc.opening || "Ready. Tell me your mission and constraints.",
      systemPrompt:
        draftNpc.systemPrompt ||
        `You are ${draftNpc.name}. Role: ${draftNpc.role}. Tone: ${draftNpc.tone}. Stay concise and in character.`,
    };

    if (runtimeMode === "backend" && backendReady) {
      try {
        const created = await createBackendCharacter({
          name: npc.name,
          role: npc.role,
          tone: npc.tone,
          opening: npc.opening,
          systemPrompt: npc.systemPrompt,
        });
        npc = { ...npc, id: created.id };
      } catch {
        pushLog("backend npc create failed, kept as local preview npc");
      }
    }

    setCustomNpcs((prev) => [npc, ...prev]);
    setActiveId(npc.id);
    setDraftNpc(emptyNpcDraft);
    setDraftTraits("strategic, friendly");
    pushLog(`npc created: ${npc.name}`);
  }

  function startVoiceInput() {
    setMicIssue("");

    if (sttMode === "faster-whisper") {
      pushLog("faster-whisper mode selected: connect backend /v1/stt endpoint");
      return;
    }

    if (!window.isSecureContext) {
      const issue = "Микрофон в браузере работает только в HTTPS или localhost";
      setMicIssue(issue);
      pushLog(issue);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const issue = "getUserMedia недоступен в этом окружении";
      setMicIssue(issue);
      pushLog(issue);
      return;
    }

    const browserWindow = window as Window & {
      webkitSpeechRecognition?: RecognitionCtor;
      SpeechRecognition?: RecognitionCtor;
    };
    const Recognition = browserWindow.webkitSpeechRecognition || browserWindow.SpeechRecognition;

    if (!Recognition) {
      const issue = "SpeechRecognition недоступен в этом браузере";
      setMicIssue(issue);
      pushLog(issue);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // We only need permission check here; recognition handles actual capture.
        stream.getTracks().forEach((track) => track.stop());

        const recognition = new Recognition();
        recognition.lang = sttLanguage;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onerror = () => {
          setIsListening(false);
          const issue = "Ошибка распознавания речи. Проверь разрешение микрофона и язык";
          setMicIssue(issue);
          pushLog(issue);
        };
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: RecognitionResultEvent) => {
          const text = event.results[0]?.[0]?.transcript?.trim();
          if (text) {
            setInput(text);
            pushLog(`voice transcript: ${text.slice(0, 48)}`);
          }
        };

        recognition.start();
      })
      .catch(() => {
        const issue = "Нет доступа к микрофону. Разреши доступ в настройках браузера";
        setMicIssue(issue);
        pushLog(issue);
      });
  }

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        <p className="text-sm">Проверка сессии...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <section className="relative flex min-h-screen items-center overflow-hidden px-6 py-20 md:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,0.2),transparent_55%),radial-gradient(circle_at_85%_30%,rgba(59,130,246,0.18),transparent_45%)]" />
          <div className="relative z-10 w-full">
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300/80">AI NPC Platform</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
              Конструктор AI-персонажей с realtime чатом и голосом
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-zinc-300">
              Начни с тестового UI в preview: зарегистрируй аккаунт, выбери NPC и проверь free-first пайплайн
              STT - LLM - TTS.
            </p>
            <p className="mt-2 text-sm text-zinc-500">Auth mode: {getAuthMode()}</p>
            <p className="mt-1 text-sm text-zinc-500">Runtime mode: {runtimeMode}</p>
            {!backendReady ? (
              <p className="mt-1 text-sm text-amber-300">Preview profile active: backend mode is disabled here.</p>
            ) : null}

            <div className="mt-10 grid gap-10 md:grid-cols-[1.2fr_1fr]">
              <div className="space-y-2 text-sm text-zinc-300">
                {stackRows.map(([layer, tool, reason]) => (
                  <div key={layer} className="flex items-start gap-3 border-b border-zinc-800/70 py-2">
                    <span className="w-20 shrink-0 text-zinc-500">{layer}</span>
                    <span className="w-52 shrink-0 text-zinc-200">{tool}</span>
                    <span className="text-zinc-400">{reason}</span>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleAuthSubmit}
                className="border border-zinc-800 bg-zinc-900/70 p-5 shadow-[0_0_0_1px_rgba(24,24,27,0.5)] transition duration-300 hover:shadow-[0_0_40px_-25px_rgba(6,182,212,0.8)]"
              >
                <div className="mb-4 flex gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className={`px-3 py-2 transition ${
                      authMode === "login" ? "bg-cyan-500/15 text-cyan-200" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Вход
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("register")}
                    className={`px-3 py-2 transition ${
                      authMode === "register"
                        ? "bg-cyan-500/15 text-cyan-200"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Регистрация
                  </button>
                </div>

                {authMode === "register" ? (
                  <input
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    placeholder="Имя"
                    className="mb-3 w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
                  />
                ) : null}

                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email"
                  className="mb-3 w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Пароль"
                  className="mb-3 w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
                />

                {authError ? <p className="mb-3 text-sm text-rose-300">{authError}</p> : null}

                <button
                  disabled={isAuthSubmitting}
                  className="w-full border border-cyan-500 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/10 disabled:opacity-40"
                >
                  {isAuthSubmitting ? "Подождите..." : authMode === "register" ? "Создать аккаунт" : "Войти"}
                </button>
                <button
                  type="button"
                  onClick={handlePreviewDemoAccess}
                  disabled={isAuthSubmitting}
                  className="mt-2 w-full border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-400 disabled:opacity-40"
                >
                  Войти как demo пользователь
                </button>
                <button
                  type="button"
                  onClick={handleResetPreview}
                  className="mt-2 w-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600"
                >
                  Сбросить preview данные
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 md:px-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">AI NPC Platform Preview</p>
            <h1 className="text-lg font-medium">Привет, {user.name}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
          >
            Выйти
          </button>
        </div>
        {!backendReady ? (
          <p className="mt-2 text-xs text-amber-300">Preview mode: чат работает на direct runtime без backend.</p>
        ) : null}
      </header>

      <section className="grid gap-10 px-6 py-8 md:grid-cols-2 md:px-12">
        <div>
          <h2 className="text-2xl font-semibold">Character Hub</h2>
          <p className="mt-2 text-zinc-400">8 готовых NPC и пользовательские персонажи.</p>
          <div className="mt-4 space-y-2">
            {allNpcs.map((npc) => {
              const isActive = npc.id === activeNpc.id;
              return (
                <button
                  key={npc.id}
                  onClick={() => setActiveId(npc.id)}
                  className={`w-full border px-3 py-3 text-left transition ${
                    isActive ? "border-cyan-400 bg-zinc-900" : "border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  <div className="text-sm font-medium">{npc.name}</div>
                  <div className="text-xs text-zinc-400">{npc.role}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 border border-zinc-800 p-4">
            <p className="text-sm text-zinc-300">{activeNpc.opening}</p>
            <p className="mt-2 text-xs text-zinc-500">Tone: {activeNpc.tone}</p>
            <p className="mt-1 text-xs text-zinc-500">Traits: {activeNpc.traits.join(", ")}</p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">Character Builder</h2>
          <form onSubmit={handleCreateNpc} className="mt-4 space-y-3">
            <input
              value={draftNpc.name}
              onChange={(event) => setDraftNpc((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Name"
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2"
            />
            <input
              value={draftNpc.role}
              onChange={(event) => setDraftNpc((prev) => ({ ...prev, role: event.target.value }))}
              placeholder="Role"
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2"
            />
            <input
              value={draftNpc.tone}
              onChange={(event) => setDraftNpc((prev) => ({ ...prev, tone: event.target.value }))}
              placeholder="Tone"
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2"
            />
            <input
              value={draftTraits}
              onChange={(event) => setDraftTraits(event.target.value)}
              placeholder="Traits: analytical, calm"
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2"
            />
            <textarea
              rows={3}
              value={draftNpc.systemPrompt}
              onChange={(event) => setDraftNpc((prev) => ({ ...prev, systemPrompt: event.target.value }))}
              placeholder="System prompt (optional)"
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2"
            />
            <button className="border border-cyan-500 px-4 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/10">
              Добавить NPC
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-10 border-t border-zinc-800 px-6 py-8 md:grid-cols-[1.1fr_1fr] md:px-12">
        <div>
          <h2 className="text-2xl font-semibold">Chat Studio</h2>
          <div className="mt-4 h-80 overflow-y-auto border border-zinc-800 p-3">
            {messages.length === 0 ? <p className="text-sm text-zinc-500">Отправь первое сообщение.</p> : null}
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`fade-in text-sm ${msg.role === "assistant" ? "text-cyan-200" : "text-zinc-200"}`}
                >
                  <span className="mr-2 text-xs uppercase text-zinc-500">{msg.role}</span>
                  {msg.text}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={onSendMessage} className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type message"
              className="flex-1 border border-zinc-800 bg-zinc-900 px-3 py-2"
            />
            <button
              type="button"
              onClick={startVoiceInput}
              className={`border px-3 py-2 text-sm transition ${
                isListening ? "border-emerald-400 text-emerald-300" : "border-zinc-700 text-zinc-300"
              }`}
            >
              {isListening ? "Listening" : "Voice"}
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="border border-cyan-500 px-3 py-2 text-sm text-cyan-300 disabled:opacity-40"
            >
              {isSending ? "Sending" : "Send"}
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">Runtime Config</h2>
          <div className="mt-4 space-y-3 border border-zinc-800 p-4">
            <select
              value={runtimeMode}
              onChange={(event) => setRuntimeMode(event.target.value as RuntimeMode)}
              className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
            >
              <option value="direct">Runtime mode: direct (browser providers)</option>
              <option value="backend" disabled={!backendReady}>
                Runtime mode: backend (/v1/sessions, /v1/messages, WS)
              </option>
            </select>
            <select
              value={runtime.provider}
              onChange={(event) => setRuntime((prev) => ({ ...prev, provider: event.target.value as LlmProvider }))}
              className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
            >
              <option value="preview">LLM: Preview fallback</option>
              <option value="ollama">LLM: Ollama</option>
              <option value="openrouter">LLM: OpenRouter free</option>
            </select>
            <select
              value={runtime.transport}
              onChange={(event) => setRuntime((prev) => ({ ...prev, transport: event.target.value as TransportMode }))}
              className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
            >
              <option value="http">Realtime: HTTP</option>
              <option value="websocket">Realtime: WebSocket</option>
            </select>

            <input
              value={runtime.ollamaBaseUrl}
              onChange={(event) => setRuntime((prev) => ({ ...prev, ollamaBaseUrl: event.target.value }))}
              placeholder="Ollama base URL"
              className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
            <input
              value={runtime.ollamaModel}
              onChange={(event) => setRuntime((prev) => ({ ...prev, ollamaModel: event.target.value }))}
              placeholder="Ollama model"
              className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
            <input
              value={runtime.openRouterModel}
              onChange={(event) => setRuntime((prev) => ({ ...prev, openRouterModel: event.target.value }))}
              placeholder="OpenRouter model"
              className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
            <input
              value={runtime.openRouterApiKey}
              onChange={(event) => setRuntime((prev) => ({ ...prev, openRouterApiKey: event.target.value }))}
              placeholder="OpenRouter API key"
              className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
            <input
              value={runtime.websocketUrl}
              onChange={(event) => setRuntime((prev) => ({ ...prev, websocketUrl: event.target.value }))}
              placeholder="WebSocket URL"
              className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={sttMode}
                onChange={(event) => setSttMode(event.target.value as SttMode)}
                className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="browser">STT: Browser fallback</option>
                <option value="faster-whisper">STT: faster-whisper</option>
              </select>
              <select
                value={ttsMode}
                onChange={(event) => setTtsMode(event.target.value as TtsMode)}
                className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="backend-engine">TTS: Backend engine (Piper/XTTS/API)</option>
                <option value="speech-synthesis">TTS: SpeechSynthesis</option>
                <option value="reference-sample">TTS: Reference sample (mp3)</option>
              </select>
            </div>

            {ttsMode === "backend-engine" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={ttsProvider}
                    onChange={(event) => {
                      const provider = event.target.value;
                      setTtsProvider(provider);
                      const firstForProvider = ttsVoices.find((item) => item.provider === provider);
                      if (firstForProvider) {
                        setTtsVoiceId(firstForProvider.id);
                        setCharacterBackendVoiceMap((prev) => ({ ...prev, [activeNpc.id]: firstForProvider.id }));
                      }
                    }}
                    className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  >
                    {Array.from(new Set(ttsVoices.map((item) => item.provider))).map((provider) => (
                      <option key={provider} value={provider}>
                        Provider: {provider}
                      </option>
                    ))}
                    {!ttsVoices.length ? <option value="piper">Provider: piper</option> : null}
                  </select>

                  <select
                    value={ttsVoiceId}
                    onChange={(event) => {
                      const next = event.target.value;
                      setTtsVoiceId(next);
                      setCharacterBackendVoiceMap((prev) => ({ ...prev, [activeNpc.id]: next }));
                    }}
                    className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  >
                    {ttsVoices
                      .filter((item) => item.provider === ttsProvider)
                      .map((voice) => (
                        <option key={`${voice.provider}-${voice.id}`} value={voice.id}>
                          {voice.label}
                        </option>
                      ))}
                    {!ttsVoices.filter((item) => item.provider === ttsProvider).length ? (
                      <option value={ttsVoiceId}>{ttsVoiceId || "default"}</option>
                    ) : null}
                  </select>
                </div>

                <label className="space-y-1 text-xs text-zinc-400">
                  <span>TTS speed: {ttsSpeed.toFixed(2)}</span>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(event) => setTtsSpeed(Number(event.target.value))}
                    className="w-full"
                  />
                </label>
              </>
            ) : null}

            <select
              value={selectedReferenceVoiceId}
              onChange={(event) => setSelectedReferenceVoiceId(event.target.value)}
              className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              {voiceReferences.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => playReferenceVoiceSample(selectedReferenceVoiceId, pushLog)}
              className="w-full border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              Прослушать reference-голос
            </button>

            {ttsMode === "reference-sample" ? (
              <p className="text-xs text-amber-300">
                В этом режиме проигрывается mp3-референс, а не синтез произвольного текста.
              </p>
            ) : null}

            <select
              value={sttLanguage}
              onChange={(event) => setSttLanguage(event.target.value)}
              className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="ru-RU">STT language: Russian (ru-RU)</option>
              <option value="en-US">STT language: English (en-US)</option>
            </select>

            {micIssue ? <p className="text-xs text-amber-300">{micIssue}</p> : null}

            {ttsMode === "speech-synthesis" ? (
              <>
                <select
                  value={selectedVoiceUri}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSelectedVoiceUri(next);
                    setCharacterBrowserVoiceMap((prev) => ({ ...prev, [activeNpc.id]: next }));
                  }}
                  className="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                >
                  {browserVoices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3 text-xs text-zinc-400">
                  <label className="space-y-1">
                    <span>Rate: {speechRate.toFixed(2)}</span>
                    <input
                      type="range"
                      min="0.75"
                      max="1.15"
                      step="0.05"
                      value={speechRate}
                      onChange={(event) => setSpeechRate(Number(event.target.value))}
                      className="w-full"
                    />
                  </label>
                  <label className="space-y-1">
                    <span>Pitch: {speechPitch.toFixed(2)}</span>
                    <input
                      type="range"
                      min="0.9"
                      max="1.2"
                      step="0.05"
                      value={speechPitch}
                      onChange={(event) => setSpeechPitch(Number(event.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    speakWithBrowser("Проверка голоса. Настройте темп и выберите самый естественный вариант.", pushLog, {
                      selectedVoiceUri,
                      voices: browserVoices,
                      rate: speechRate,
                      pitch: speechPitch,
                    })
                  }
                  className="w-full border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
                >
                  Прослушать выбранный голос
                </button>
              </>
            ) : null}
          </div>

          <div className="mt-4 border border-zinc-800 p-4">
            <p className="text-sm font-medium text-zinc-200">Runtime Log</p>
            <div className="mt-2 space-y-1 text-xs text-zinc-400">
              {runtimeLog.length === 0 ? <p>Пока пусто.</p> : null}
              {runtimeLog.map((entry) => (
                <p key={entry}>{entry}</p>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function speakWithBrowser(
  text: string,
  pushLog: (message: string) => void,
  options: {
    selectedVoiceUri: string;
    voices: SpeechSynthesisVoice[];
    rate: number;
    pitch: number;
  }
) {
  if (!("speechSynthesis" in window)) {
    pushLog("SpeechSynthesis unavailable");
    return;
  }

  if (!options.voices.length) {
    pushLog("Voice list is empty. Try again in a few seconds.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const selected = options.voices.find((voice) => voice.voiceURI === options.selectedVoiceUri);
  if (selected) {
    utterance.voice = selected;
    utterance.lang = selected.lang;
  }

  utterance.rate = options.rate;
  utterance.pitch = options.pitch;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function playReferenceVoiceSample(voiceId: string, pushLog: (message: string) => void) {
  const selected = voiceReferences.find((voice) => voice.id === voiceId);
  if (!selected) {
    pushLog("Reference voice not found");
    return;
  }

  const audio = new Audio(selected.url);
  audio.play().catch(() => {
    pushLog("Failed to play reference sample. Browser blocked autoplay.");
  });
}

function playBase64Audio(audioBase64: string, mimeType: string, pushLog: (message: string) => void) {
  try {
    const url = `data:${mimeType};base64,${audioBase64}`;
    const audio = new Audio(url);
    audio.play().catch(() => {
      pushLog("Failed to play generated TTS audio");
    });
  } catch {
    pushLog("Invalid TTS audio payload");
  }
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function streamText(
  id: string,
  text: string,
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
) {
  const words = text.split(" ");

  return new Promise<void>((resolve) => {
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      const chunk = words.slice(0, index).join(" ");
      setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, text: chunk } : msg)));

      if (index >= words.length) {
        window.clearInterval(timer);
        resolve();
      }
    }, 32);
  });
}