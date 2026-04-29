import type { NpcPreset } from "../data/presets";
import { getAccessToken, getApiBaseUrl } from "./authApi";
import type { RuntimeConfig } from "./runtime";

export type RuntimeMode = "direct" | "backend";

export type TtsVoice = {
  provider: string;
  id: string;
  label: string;
};

type HistoryItem = {
  role: "user" | "assistant";
  text: string;
};

const RUNTIME_MODE: RuntimeMode = import.meta.env.VITE_RUNTIME_MODE === "backend" ? "backend" : "direct";

export function getRuntimeMode() {
  return RUNTIME_MODE;
}

export async function ensureBackendSession(characterId: string): Promise<string> {
  const token = requireAccessToken();
  const baseUrl = requireApiBaseUrl();

  const response = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ characterId }),
  });

  if (!response.ok) {
    throw new Error("Не удалось создать backend session");
  }

  const data = (await response.json()) as { session?: { id?: string } };
  const sessionId = data.session?.id;
  if (!sessionId) {
    throw new Error("Backend sessionId missing");
  }
  return sessionId;
}

export async function sendBackendMessage(params: {
  sessionId: string;
  character: NpcPreset;
  userText: string;
  history: HistoryItem[];
  config: RuntimeConfig;
}): Promise<string> {
  const { sessionId, character, userText, history, config } = params;
  if (config.transport === "websocket") {
    return sendViaBackendWebSocket({ character, userText, history, config });
  }

  return sendViaBackendHttp({ sessionId, userText, config });
}

export async function createBackendCharacter(input: {
  name: string;
  role: string;
  tone: string;
  opening: string;
  systemPrompt: string;
}): Promise<{ id: string }> {
  const token = requireAccessToken();
  const baseUrl = requireApiBaseUrl();

  const response = await fetch(`${baseUrl}/v1/characters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Failed to create backend character");
  }

  const data = (await response.json()) as { item?: { id?: string } };
  const id = data.item?.id;
  if (!id) {
    throw new Error("Backend character id missing");
  }

  return { id };
}

export async function getBackendTtsVoices(): Promise<TtsVoice[]> {
  const token = requireAccessToken();
  const baseUrl = requireApiBaseUrl();

  const response = await fetch(`${baseUrl}/v1/tts/voices`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load TTS voices");
  }

  const data = (await response.json()) as { items?: TtsVoice[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function synthesizeBackendTts(input: {
  text: string;
  provider: string;
  voiceId: string;
  speed: number;
}): Promise<{ audioBase64: string; mimeType: string }> {
  const token = requireAccessToken();
  const baseUrl = requireApiBaseUrl();

  const response = await fetch(`${baseUrl}/v1/tts/synthesize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Backend TTS synthesis failed");
  }

  const data = (await response.json()) as {
    audioBase64?: string;
    mimeType?: string;
  };

  if (!data.audioBase64) {
    throw new Error("Empty TTS audio payload");
  }

  return {
    audioBase64: data.audioBase64,
    mimeType: data.mimeType || "audio/mpeg",
  };
}

async function sendViaBackendHttp(params: {
  sessionId: string;
  userText: string;
  config: RuntimeConfig;
}) {
  const { sessionId, userText, config } = params;
  const token = requireAccessToken();
  const baseUrl = requireApiBaseUrl();

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      sessionId,
      text: userText,
      provider: config.provider,
      model: config.provider === "ollama" ? config.ollamaModel : config.openRouterModel,
    }),
  });

  if (!response.ok) {
    throw new Error("Backend /v1/messages failed");
  }

  const data = (await response.json()) as { item?: { text?: string } };
  const text = data.item?.text?.trim();
  if (!text) {
    throw new Error("Empty backend message response");
  }

  return text;
}

function sendViaBackendWebSocket(params: {
  character: NpcPreset;
  userText: string;
  history: HistoryItem[];
  config: RuntimeConfig;
}) {
  const { character, userText, history, config } = params;
  const baseUrl = requireApiBaseUrl();
  const wsUrl = config.websocketUrl.trim() || toWsUrl(baseUrl);

  return new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    let aggregate = "";
    let closed = false;

    const timer = window.setTimeout(() => {
      if (!closed) {
        closed = true;
        socket.close();
        reject(new Error("Backend WS timeout"));
      }
    }, 15000);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "user_text",
          characterId: character.id,
          text: userText,
          provider: config.provider,
          model: config.provider === "ollama" ? config.ollamaModel : config.openRouterModel,
          history,
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as {
          type?: string;
          delta?: string;
          text?: string;
        };

        if (data.type === "assistant_chunk") {
          aggregate += data.delta || "";
          return;
        }

        if (data.type === "assistant_final") {
          closed = true;
          window.clearTimeout(timer);
          socket.close();
          resolve((data.text || aggregate).trim());
        }
      } catch {
        // Ignore malformed chunks.
      }
    };

    socket.onerror = () => {
      if (!closed) {
        closed = true;
        window.clearTimeout(timer);
        reject(new Error("Backend WS error"));
      }
    };

    socket.onclose = () => {
      if (!closed) {
        closed = true;
        window.clearTimeout(timer);
        if (aggregate.trim()) {
          resolve(aggregate.trim());
        } else {
          reject(new Error("Backend WS closed"));
        }
      }
    };
  });
}

function requireApiBaseUrl() {
  const baseUrl = getApiBaseUrl().trim();
  if (!baseUrl) {
    throw new Error("VITE_API_BASE_URL required for backend runtime mode");
  }
  return baseUrl;
}

function requireAccessToken() {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Access token missing");
  }
  return token;
}

function toWsUrl(apiBaseUrl: string) {
  if (apiBaseUrl.startsWith("https://")) {
    return `${apiBaseUrl.replace("https://", "wss://")}/v1/realtime`;
  }
  if (apiBaseUrl.startsWith("http://")) {
    return `${apiBaseUrl.replace("http://", "ws://")}/v1/realtime`;
  }
  return `${apiBaseUrl}/v1/realtime`;
}