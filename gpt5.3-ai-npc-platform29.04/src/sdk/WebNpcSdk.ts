export type SdkCharacter = {
  id: string;
  name: string;
  role: string;
  tone: string;
  behavior: string[];
  opening: string;
};

export type SdkSession = {
  id: string;
  characterId: string;
  createdAt: string;
};

export type SdkMessage = {
  id: string;
  sessionId: string;
  role: "user" | "npc";
  content: string;
  createdAt: string;
};

export type SdkRealtimeEvent =
  | { type: "ready"; message: string }
  | { type: "chunk"; text: string }
  | { type: "final"; message: SdkMessage }
  | { type: "error"; message: string }
  | { type: "transcript"; text: string; isFinal: boolean; source: "user" | "npc" }
  | { type: "audio_chunk"; seq: number; codec: string; data: string }
  | { type: "npc_action"; action: string; confidence: number; params?: Record<string, string | number> };

type Handler = (event: SdkRealtimeEvent) => void;

export type WebNpcSdkOptions = {
  apiBaseUrl: string;
  wsUrl?: string;
  apiKey?: string;
};

export class WebNpcSdk {
  private readonly apiBaseUrl: string;
  private readonly wsUrl: string;
  private readonly apiKey: string;
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();

  constructor(options: WebNpcSdkOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
    this.wsUrl = options.wsUrl ?? `${this.apiBaseUrl.replace(/^http/i, "ws")}/realtime`;
    this.apiKey = options.apiKey ?? "";
  }

  async listCharacters(): Promise<SdkCharacter[]> {
    return this.request<SdkCharacter[]>("/characters");
  }

  async createSession(characterId: string): Promise<SdkSession> {
    return this.request<SdkSession>("/sessions", {
      method: "POST",
      body: JSON.stringify({ characterId }),
    });
  }

  async getSessionMessages(sessionId: string): Promise<SdkMessage[]> {
    return this.request<SdkMessage[]>(`/sessions/${sessionId}/messages`);
  }

  onEvent(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async connectRealtime() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const url = new URL(this.wsUrl);
      if (this.apiKey) {
        url.searchParams.set("api_key", this.apiKey);
      }

      const socket = new WebSocket(url.toString());

      socket.onopen = () => {
        this.ws = socket;
        resolve();
      };

      socket.onerror = () => {
        reject(new Error("Failed to connect realtime websocket"));
      };

      socket.onclose = () => {
        this.ws = null;
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as SdkRealtimeEvent;
          this.handlers.forEach((handler) => handler(payload));
        } catch {
          this.handlers.forEach((handler) => handler({ type: "error", message: "Invalid realtime payload" }));
        }
      };
    });
  }

  sendText(sessionId: string, text: string) {
    this.sendRealtimePayload({ type: "user_message", sessionId, text });
  }

  sendVoice(sessionId: string, transcript: string) {
    this.sendRealtimePayload({ type: "user_voice", sessionId, transcript });
  }

  disconnectRealtime() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private sendRealtimePayload(payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Realtime websocket is not connected");
    }

    this.ws.send(JSON.stringify(payload));
  }
}
