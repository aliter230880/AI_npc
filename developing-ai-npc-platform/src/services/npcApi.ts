import { getStoredAuthToken } from "./auth";

export type NpcCharacter = {
  id: string;
  name: string;
  role: string;
  tone: string;
  behavior: string[];
  opening: string;
  systemPrompt?: string;
};

export type CharacterConfig = {
  id: string;
  tone: string;
  behavior: string[];
  opening: string;
  systemPrompt: string;
};

export type CharacterMemory = {
  id: string;
  characterId: string;
  sessionId: string | null;
  content: string;
  createdAt: string;
};

export type NpcSession = {
  id: string;
  characterId: string;
  createdAt: string;
};

export type NpcMessage = {
  id: string;
  sessionId: string;
  role: "user" | "npc";
  content: string;
  createdAt: string;
};

export type RealtimeEvent =
  | { type: "transcript"; text: string; isFinal: boolean; source: "user" | "npc" }
  | { type: "audio_chunk"; seq: number; codec: string; data: string }
  | { type: "npc_action"; action: string; confidence: number; params?: Record<string, string | number> };

type SendOptions = {
  onRealtimeEvent?: (event: RealtimeEvent) => void;
  inputType?: "text" | "voice";
};

export type RuntimeStatus = {
  mode: "live_api" | "preview_fallback";
  apiBase: string;
  wsUrl: string;
  healthy: boolean;
  message: string;
};

const STORAGE_KEY = "ai_npc_store_v1";
const apiBase =
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ??
    "http://localhost:8787/v1").trim();
const apiKey = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_KEY ?? "").trim();
const wsBase = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WS_URL ?? "").trim();

type Store = {
  sessions: NpcSession[];
  messages: NpcMessage[];
};

const seededCharacters: NpcCharacter[] = [
  {
    id: "mara-archivist",
    name: "Mara Archivist",
    role: "Lore Guide",
    tone: "Calm, precise, narrative-first",
    behavior: ["Remembers plot details", "Protects canon", "Suggests next quests"],
    opening: "I can continue from your previous discoveries and keep narrative consistency.",
  },
  {
    id: "captain-rook",
    name: "Captain Rook",
    role: "Squad Commander",
    tone: "Direct, tactical, mission-driven",
    behavior: ["Gives concise commands", "Evaluates risk", "Focuses on objectives"],
    opening: "Give me your mission context and I will produce a tactical plan.",
  },
  {
    id: "vexa-vale",
    name: "Vexa Vale",
    role: "Dynamic Merchant",
    tone: "Friendly, witty, value-focused",
    behavior: ["Adjusts offers by reputation", "Remembers preferences", "Supports multi-language style"],
    opening: "Tell me what you need and I will tailor an offer to your profile.",
  },
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldUseRemoteApi() {
  return Boolean(apiBase && apiBase.startsWith("http"));
}

function getResolvedApiBase() {
  return apiBase || "http://localhost:8787/v1";
}

function resolveWsUrl() {
  if (wsBase) {
    return wsBase;
  }

  if (!shouldUseRemoteApi()) {
    return "";
  }

  return `${apiBase.replace(/^http/i, "ws")}/realtime`;
}

export async function checkRuntimeStatus(): Promise<RuntimeStatus> {
  const resolvedApiBase = getResolvedApiBase();
  const resolvedWs = resolveWsUrl() || "ws://localhost:8787/v1/realtime";

  if (!shouldUseRemoteApi()) {
    return {
      mode: "preview_fallback",
      apiBase: resolvedApiBase,
      wsUrl: resolvedWs,
      healthy: false,
      message: "Preview mode: API base URL is not configured",
    };
  }

  try {
    const health = await fetch(resolvedApiBase.replace(/\/v1\/?$/, "") + "/health");
    if (!health.ok) {
      throw new Error("Health endpoint not ready");
    }

    return {
      mode: "live_api",
      apiBase: resolvedApiBase,
      wsUrl: resolvedWs,
      healthy: true,
      message: "Live mode: connected to backend API",
    };
  } catch {
    return {
      mode: "preview_fallback",
      apiBase: resolvedApiBase,
      wsUrl: resolvedWs,
      healthy: false,
      message: "Preview fallback: backend is unreachable, local runtime is active",
    };
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return (await response.json()) as T;
}

function getStore(): Store {
  const fallback: Store = { sessions: [], messages: [] };
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Store;
    return {
      sessions: parsed.sessions ?? [],
      messages: parsed.messages ?? [],
    };
  } catch {
    return fallback;
  }
}

function saveStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildNpcReply(character: NpcCharacter, userText: string, history: NpcMessage[] = []): string {
  const raw = userText.trim();
  const text = raw.toLowerCase();
  const hasCyrillic = /[а-яё]/i.test(raw);

  if (/(как тебя зовут|кто ты|your name|who are you)/i.test(text)) {
    if (character.id === "captain-rook") {
      return hasCyrillic
        ? "Я капитан Рук. Командую отрядом и помогаю планировать миссии."
        : "I am Captain Rook. I command the squad and help plan missions.";
    }

    if (character.id === "vexa-vale") {
      return hasCyrillic
        ? "Я Векса Вейл, ваш торговец. Подберу выгодную сделку под ваш стиль игры."
        : "I am Vexa Vale, your merchant. I can tailor a deal for your playstyle.";
    }

    return hasCyrillic
      ? "Меня зовут Mara Archivist. Я хранитель лора и контекста вашего приключения."
      : "My name is Mara Archivist. I keep lore and narrative continuity for your adventure.";
  }

  if (/(что я сказал|повтори|what did i say|repeat)/i.test(text)) {
    const lastUser = history
      .filter((message) => message.role === "user")
      .slice(-1)[0]?.content;

    if (lastUser) {
      return hasCyrillic ? `Ранее вы сказали: "${lastUser}".` : `Previously you said: "${lastUser}".`;
    }
  }

  if (character.id === "captain-rook") {
    if (text.includes("attack") || text.includes("бой") || text.includes("enemy")) {
      return "Priority one: secure cover, mark hostile angles, then execute a coordinated flank in 20 seconds.";
    }

    return "Mission accepted. I recommend objective breakdown: recon, risk scan, execution, and extraction.";
  }

  if (character.id === "vexa-vale") {
    if (text.includes("price") || text.includes("цена") || text.includes("скид")) {
      return "For a trusted player I can lower the final price by 15 percent and add a rare utility item.";
    }

    return "Interesting request. I can craft a personalized bundle based on your preferred playstyle.";
  }

  if (text.includes("quest") || text.includes("квест") || text.includes("lore") || text.includes("сюжет")) {
    return hasCyrillic
      ? "Контекст обновлен. Я связала вашу текущую зацепку с инцидентом в старом хранилище и подготовила следующую ветку."
      : "Narrative continuity updated. I linked your current clue to the old vault incident and prepared the next branch.";
  }

  return hasCyrillic
    ? "Контекст синхронизирован. Я продолжаю диалог в роли персонажа и учитываю ваши предыдущие реплики."
    : "Context synchronized. I can continue this dialogue with stable memory and role-consistent behavior.";
}

async function listCharactersLocal(): Promise<NpcCharacter[]> {
  await delay(120);
  return seededCharacters;
}

async function createSessionLocal(characterId: string): Promise<NpcSession> {
  await delay(120);

  const session: NpcSession = {
    id: createId("ses"),
    characterId,
    createdAt: new Date().toISOString(),
  };

  const store = getStore();
  store.sessions.unshift(session);
  saveStore(store);

  return session;
}

async function getSessionMessagesLocal(sessionId: string): Promise<NpcMessage[]> {
  await delay(80);
  return getStore().messages.filter((message) => message.sessionId === sessionId);
}

async function sendMessageLocal(sessionId: string, characterId: string, text: string): Promise<NpcMessage> {
  const character = seededCharacters.find((item) => item.id === characterId);

  if (!character) {
    throw new Error("Character not found");
  }

  const store = getStore();

  const userMessage: NpcMessage = {
    id: createId("msg"),
    sessionId,
    role: "user",
    content: text,
    createdAt: new Date().toISOString(),
  };

  store.messages.push(userMessage);
  saveStore(store);

  await delay(150);

  const npcMessage: NpcMessage = {
    id: createId("msg"),
    sessionId,
    role: "npc",
    content: buildNpcReply(character, text, store.messages.filter((message) => message.sessionId === sessionId)),
    createdAt: new Date().toISOString(),
  };

  const latestStore = getStore();
  latestStore.messages.push(npcMessage);
  saveStore(latestStore);

  return npcMessage;
}

function streamText(text: string, onStream: (partial: string) => void) {
  const words = text.split(" ");
  let buffer = "";

  return words.reduce<Promise<void>>(async (prev, word) => {
    await prev;
    buffer = `${buffer}${buffer ? " " : ""}${word}`;
    onStream(buffer);
    await delay(45);
  }, Promise.resolve());
}

async function sendMessageRealtime(
  sessionId: string,
  text: string,
  onStream: (partial: string) => void,
  options?: SendOptions
): Promise<NpcMessage> {
  const endpoint = resolveWsUrl();

  if (!endpoint) {
    throw new Error("Realtime endpoint is not configured");
  }

  return new Promise<NpcMessage>((resolve, reject) => {
    const url = new URL(endpoint);
    const token = getStoredAuthToken();
    if (apiKey) {
      url.searchParams.set("api_key", apiKey);
    }
    if (token) {
      url.searchParams.set("token", token);
    }

    const ws = new WebSocket(url.toString());
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error("Realtime timeout"));
      }
    }, 15000);

    function finish(message: NpcMessage) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      ws.close();
      resolve(message);
    }

    function fail(error: Error) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      ws.close();
      reject(error);
    }

    ws.onopen = () => {
      const type = options?.inputType === "voice" ? "user_voice" : "user_message";
      ws.send(
        JSON.stringify({
          type,
          sessionId,
          ...(type === "user_voice" ? { transcript: text } : { text }),
        })
      );
    };

    ws.onerror = () => {
      fail(new Error("Realtime connection error"));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as
          | { type: "ready" }
          | { type: "chunk"; text: string }
          | { type: "final"; message: NpcMessage }
          | { type: "error"; message: string }
          | RealtimeEvent;

        if (payload.type === "chunk") {
          onStream(payload.text);
          return;
        }

        if (payload.type === "transcript" || payload.type === "audio_chunk" || payload.type === "npc_action") {
          options?.onRealtimeEvent?.(payload);
          return;
        }

        if (payload.type === "final") {
          finish(payload.message);
          return;
        }

        if (payload.type === "error") {
          fail(new Error(payload.message));
        }
      } catch {
        fail(new Error("Invalid realtime payload"));
      }
    };
  });
}

export async function listCharacters(): Promise<NpcCharacter[]> {
  if (shouldUseRemoteApi()) {
    try {
      return await request<NpcCharacter[]>("/characters");
    } catch {
      return listCharactersLocal();
    }
  }

  return listCharactersLocal();
}

export async function createSession(characterId: string): Promise<NpcSession> {
  if (shouldUseRemoteApi()) {
    try {
      return await request<NpcSession>("/sessions", {
        method: "POST",
        body: JSON.stringify({ characterId }),
      });
    } catch {
      return createSessionLocal(characterId);
    }
  }

  return createSessionLocal(characterId);
}

export async function getSessionMessages(sessionId: string): Promise<NpcMessage[]> {
  if (shouldUseRemoteApi()) {
    try {
      return await request<NpcMessage[]>(`/sessions/${sessionId}/messages`);
    } catch {
      return getSessionMessagesLocal(sessionId);
    }
  }

  return getSessionMessagesLocal(sessionId);
}

export async function sendMessage(
  sessionId: string,
  characterId: string,
  text: string,
  onStream: (partial: string) => void,
  options?: SendOptions
): Promise<NpcMessage> {
  let responseMessage: NpcMessage;

  if (shouldUseRemoteApi()) {
    try {
      responseMessage = await sendMessageRealtime(sessionId, text, onStream, options);
      return responseMessage;
    } catch {
      try {
        responseMessage = await request<NpcMessage>("/messages", {
          method: "POST",
          body: JSON.stringify({ sessionId, characterId, text }),
        });
        await streamText(responseMessage.content, onStream);
        return responseMessage;
      } catch {
        responseMessage = await sendMessageLocal(sessionId, characterId, text);
        await streamText(responseMessage.content, onStream);
        return responseMessage;
      }
    }
  }

  responseMessage = await sendMessageLocal(sessionId, characterId, text);
  await streamText(responseMessage.content, onStream);
  return responseMessage;
}

export async function getCharacterConfig(characterId: string): Promise<CharacterConfig> {
  if (shouldUseRemoteApi()) {
    try {
      return await request<CharacterConfig>(`/characters/${characterId}/config`);
    } catch {
      // fall through to local fallback
    }
  }

  const local = seededCharacters.find((character) => character.id === characterId);
  if (!local) {
    throw new Error("Character not found");
  }

  return {
    id: local.id,
    tone: local.tone,
    behavior: local.behavior,
    opening: local.opening,
    systemPrompt: local.systemPrompt ?? "",
  };
}

export async function updateCharacterConfig(
  characterId: string,
  patch: Partial<Pick<CharacterConfig, "tone" | "behavior" | "opening" | "systemPrompt">>
): Promise<CharacterConfig> {
  if (shouldUseRemoteApi()) {
    try {
      return await request<CharacterConfig>(`/characters/${characterId}/config`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    } catch {
      // fall through to local fallback
    }
  }

  const local = seededCharacters.find((character) => character.id === characterId);
  if (!local) {
    throw new Error("Character not found");
  }

  if (typeof patch.tone === "string" && patch.tone.trim()) {
    local.tone = patch.tone.trim();
  }
  if (typeof patch.opening === "string" && patch.opening.trim()) {
    local.opening = patch.opening.trim();
  }
  if (typeof patch.systemPrompt === "string") {
    local.systemPrompt = patch.systemPrompt.trim();
  }
  if (Array.isArray(patch.behavior)) {
    local.behavior = patch.behavior.map((item) => String(item)).filter(Boolean);
  }

  return {
    id: local.id,
    tone: local.tone,
    behavior: local.behavior,
    opening: local.opening,
    systemPrompt: local.systemPrompt ?? "",
  };
}

export async function getCharacterMemories(characterId: string, limit = 10): Promise<CharacterMemory[]> {
  if (shouldUseRemoteApi()) {
    try {
      return await request<CharacterMemory[]>(`/characters/${characterId}/memories?limit=${limit}`);
    } catch {
      // fall through to local fallback
    }
  }

  return [];
}

export async function clearCharacterMemories(characterId: string): Promise<{ removed: number }> {
  if (shouldUseRemoteApi()) {
    try {
      return await request<{ removed: number }>(`/characters/${characterId}/memories`, {
        method: "DELETE",
      });
    } catch {
      // fall through to local fallback
    }
  }

  return { removed: 0 };
}

export async function transcribeAudio(audioBlob: Blob, language = "ru"): Promise<string> {
  if (!shouldUseRemoteApi()) {
    throw new Error("STT is unavailable in preview fallback mode");
  }

  const token = getStoredAuthToken();
  const form = new FormData();
  form.append("file", audioBlob, "voice.webm");
  form.append("language", language);

  const response = await fetch(`${apiBase}/stt`, {
    method: "POST",
    headers: {
      ...(apiKey ? { "x-api-key": apiKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `STT request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { transcript?: string };
  return String(payload.transcript || "").trim();
}
