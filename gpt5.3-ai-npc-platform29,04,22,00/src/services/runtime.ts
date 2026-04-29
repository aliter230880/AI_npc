import type { NpcPreset } from "../data/presets";

export type LlmProvider = "preview" | "ollama" | "openrouter";
export type TransportMode = "http" | "websocket";

export type RuntimeConfig = {
  provider: LlmProvider;
  transport: TransportMode;
  ollamaBaseUrl: string;
  ollamaModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
  websocketUrl: string;
};

type Message = {
  role: "user" | "assistant";
  text: string;
};

const WS_TIMEOUT_MS = 15000;

export async function getNpcReply(params: {
  character: NpcPreset;
  userText: string;
  history: Message[];
  config: RuntimeConfig;
}): Promise<string> {
  const { character, userText, history, config } = params;

  if (config.transport === "websocket" && config.websocketUrl.trim()) {
    try {
      return await getReplyViaWebSocket({ character, userText, history, config });
    } catch {
      // Fallback to HTTP providers when WS transport is unavailable.
    }
  }

  if (config.provider === "ollama") {
    try {
      return await getReplyFromOllama({ character, userText, history, config });
    } catch {
      return previewReply(character, userText);
    }
  }

  if (config.provider === "openrouter") {
    try {
      return await getReplyFromOpenRouter({ character, userText, history, config });
    } catch {
      return previewReply(character, userText);
    }
  }

  return previewReply(character, userText);
}

async function getReplyFromOllama(params: {
  character: NpcPreset;
  userText: string;
  history: Message[];
  config: RuntimeConfig;
}) {
  const { character, userText, history, config } = params;
  const messages = buildMessages(character, userText, history);

  const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      stream: false,
      messages: messages.map((item) => ({ role: item.role, content: item.content })),
    }),
  });

  if (!response.ok) {
    throw new Error("Ollama request failed");
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const text = data.message?.content?.trim();
  if (!text) {
    throw new Error("Empty Ollama response");
  }

  return text;
}

async function getReplyFromOpenRouter(params: {
  character: NpcPreset;
  userText: string;
  history: Message[];
  config: RuntimeConfig;
}) {
  const { character, userText, history, config } = params;
  if (!config.openRouterApiKey.trim()) {
    throw new Error("Missing OpenRouter key");
  }

  const messages = buildMessages(character, userText, history);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "AI NPC Platform",
    },
    body: JSON.stringify({
      model: config.openRouterModel,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error("OpenRouter request failed");
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty OpenRouter response");
  }

  return text;
}

function getReplyViaWebSocket(params: {
  character: NpcPreset;
  userText: string;
  history: Message[];
  config: RuntimeConfig;
}) {
  const { character, userText, history, config } = params;

  return new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(config.websocketUrl);
    let closed = false;
    let aggregate = "";

    const timeout = window.setTimeout(() => {
      if (!closed) {
        socket.close();
        reject(new Error("WebSocket timeout"));
      }
    }, WS_TIMEOUT_MS);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "user_text",
          text: userText,
          characterId: character.id,
          provider: config.provider,
          model: config.provider === "ollama" ? config.ollamaModel : config.openRouterModel,
          systemPrompt: character.systemPrompt,
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

        if (data.type === "assistant_chunk" && data.delta) {
          aggregate += data.delta;
          return;
        }

        if (data.type === "assistant_final") {
          closed = true;
          window.clearTimeout(timeout);
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
        window.clearTimeout(timeout);
        reject(new Error("WebSocket error"));
      }
    };

    socket.onclose = () => {
      if (!closed) {
        closed = true;
        window.clearTimeout(timeout);
        if (aggregate.trim()) {
          resolve(aggregate.trim());
        } else {
          reject(new Error("WebSocket closed"));
        }
      }
    };
  });
}

function buildMessages(character: NpcPreset, userText: string, history: Message[]) {
  const context = history.slice(-6).map((msg) => ({ role: msg.role, content: msg.text }));
  return [
    { role: "system", content: character.systemPrompt },
    ...context,
    { role: "user", content: userText },
  ];
}

function previewReply(character: NpcPreset, userText: string) {
  return `${character.name}: ${character.opening} Main direction for your request: ${userText}. I will keep the style ${character.tone.toLowerCase()} and act as ${character.role.toLowerCase()}.`;
}