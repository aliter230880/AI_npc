import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const app = Fastify({ logger: true });

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ACCESS_TTL = process.env.ACCESS_TTL || "15m";
const REFRESH_TTL = process.env.REFRESH_TTL || "7d";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const FASTER_WHISPER_URL = process.env.FASTER_WHISPER_URL || "";
const PIPER_URL = process.env.PIPER_URL || "";
const XTTS_URL = process.env.XTTS_URL || "";
const TTS_PROVIDER_DEFAULT = process.env.TTS_PROVIDER_DEFAULT || "piper";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "alloy";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "";

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(websocket);

const users = [];
const sessions = [];
const messages = [];
const refreshTokens = new Map();

const defaultCharacters = [
  {
    id: "captain-rhea",
    name: "Captain Rhea",
    role: "Space mission commander",
    tone: "Calm, tactical",
    opening: "Status check. Tell me what part of the mission you need help with.",
    systemPrompt:
      "You are Captain Rhea, mission commander. Speak clearly, prioritize safety, and explain decisions with short tactical reasoning.",
  },
  {
    id: "archivist-lyra",
    name: "Archivist Lyra",
    role: "Lore keeper",
    tone: "Poetic, knowledgeable",
    opening: "Welcome. Name any world event, and I will connect it to hidden context.",
    systemPrompt:
      "You are Lyra, a lore archivist. Give rich but concise context, mention chronology, and avoid modern slang.",
  },
  {
    id: "quartermaster-bex",
    name: "Quartermaster Bex",
    role: "Trader and logistics NPC",
    tone: "Friendly, practical",
    opening: "Need gear, routes, or prices? I optimize all three.",
    systemPrompt:
      "You are Bex, a quartermaster. Speak in short practical steps, compare options, and include trade-offs.",
  },
  {
    id: "medic-sana",
    name: "Medic Sana",
    role: "Field medic trainer",
    tone: "Empathetic, structured",
    opening: "Take a breath. Describe symptoms and I will guide the next safe action.",
    systemPrompt:
      "You are Sana, a simulation medic. Be calm and empathetic, provide procedural steps, and always mention safety constraints.",
  },
  {
    id: "engineer-voss",
    name: "Engineer Voss",
    role: "Systems engineer",
    tone: "Analytical, dry humor",
    opening: "Show me the fault pattern. We debug by evidence, not by luck.",
    systemPrompt:
      "You are Voss, an engineer. Diagnose by hypothesis and tests, keep answers actionable and technical.",
  },
  {
    id: "diplomat-iona",
    name: "Diplomat Iona",
    role: "Negotiation specialist",
    tone: "Measured, diplomatic",
    opening: "Every conflict has leverage points. Tell me your objective.",
    systemPrompt:
      "You are Iona, a diplomat. Balance interests, suggest negotiation paths, and avoid escalation language.",
  },
  {
    id: "coach-niko",
    name: "Coach Niko",
    role: "Performance coach",
    tone: "Energetic, focused",
    opening: "Good. What skill are we improving today, and what is the deadline?",
    systemPrompt:
      "You are Niko, a performance coach. Ask focused questions, set short milestones, and keep momentum high.",
  },
  {
    id: "guide-mira",
    name: "Guide Mira",
    role: "Onboarding assistant",
    tone: "Warm, clear",
    opening: "I will get you productive in minutes. Tell me your current level.",
    systemPrompt:
      "You are Mira, an onboarding guide. Explain simply, check understanding, and adapt depth to user expertise.",
  },
];

const customCharacters = [];

app.get("/health", async () => ({ ok: true }));

app.post("/v1/auth/register", async (request, reply) => {
  const body = request.body || {};
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();

  if (!name || !email || !password) {
    return reply.code(400).send({ message: "name, email, password required" });
  }
  if (users.some((item) => item.email === email)) {
    return reply.code(409).send({ message: "user already exists" });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: hash,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
  };
  users.push(user);

  const tokens = issueTokens(user);
  refreshTokens.set(tokens.refreshToken, user.id);

  return {
    user: safeUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
});

app.post("/v1/auth/login", async (request, reply) => {
  const body = request.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const user = users.find((item) => item.email === email);
  if (!user) {
    return reply.code(401).send({ message: "invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return reply.code(401).send({ message: "invalid credentials" });
  }

  const tokens = issueTokens(user);
  refreshTokens.set(tokens.refreshToken, user.id);

  return {
    user: safeUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
});

app.get("/v1/auth/me", async (request, reply) => {
  const user = getUserFromAccessToken(request);
  if (!user) {
    return reply.code(401).send({ message: "unauthorized" });
  }
  return { user: safeUser(user) };
});

app.post("/v1/auth/refresh", async (request, reply) => {
  const body = request.body || {};
  const refreshToken = String(body.refreshToken || "");

  if (!refreshToken || !refreshTokens.has(refreshToken)) {
    return reply.code(401).send({ message: "invalid refresh token" });
  }

  const payload = verifyToken(refreshToken);
  if (!payload || payload.type !== "refresh") {
    refreshTokens.delete(refreshToken);
    return reply.code(401).send({ message: "invalid refresh token" });
  }

  const user = users.find((item) => item.id === payload.sub);
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    refreshTokens.delete(refreshToken);
    return reply.code(401).send({ message: "refresh token expired" });
  }

  refreshTokens.delete(refreshToken);
  const tokens = issueTokens(user);
  refreshTokens.set(tokens.refreshToken, user.id);

  return {
    user: safeUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
});

app.post("/v1/auth/logout", async (request, reply) => {
  const user = getUserFromAccessToken(request);
  if (!user) {
    return reply.code(401).send({ message: "unauthorized" });
  }

  const authHeader = request.headers.authorization || "";
  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (accessToken) {
    refreshTokens.forEach((value, token) => {
      if (value === user.id) {
        refreshTokens.delete(token);
      }
    });
  }

  return { ok: true };
});

app.get("/v1/characters", async () => ({ items: [...defaultCharacters, ...customCharacters] }));

app.post("/v1/characters", async (request, reply) => {
  const user = getUserFromAccessToken(request);
  if (!user) {
    return reply.code(401).send({ message: "unauthorized" });
  }

  const body = request.body || {};
  const name = String(body.name || "").trim();
  const role = String(body.role || "").trim();
  const tone = String(body.tone || "").trim() || "Balanced";
  const opening = String(body.opening || "").trim() || "Tell me your goal.";
  const systemPrompt =
    String(body.systemPrompt || "").trim() ||
    `You are ${name || "an NPC"}. Role: ${role || "assistant"}. Keep concise and in character.`;

  if (!name || !role) {
    return reply.code(400).send({ message: "name and role required" });
  }

  const character = {
    id: `custom-${Date.now()}`,
    name,
    role,
    tone,
    opening,
    systemPrompt,
    ownerId: user.id,
  };

  customCharacters.push(character);
  return { item: character };
});

app.post("/v1/sessions", async (request, reply) => {
  const user = getUserFromAccessToken(request);
  if (!user) {
    return reply.code(401).send({ message: "unauthorized" });
  }

  const body = request.body || {};
  const characterId = String(body.characterId || "");
  if (!characterId) {
    return reply.code(400).send({ message: "characterId required" });
  }

  const session = {
    id: crypto.randomUUID(),
    userId: user.id,
    characterId,
    createdAt: new Date().toISOString(),
  };
  sessions.push(session);
  return { session };
});

app.get("/v1/sessions/:sessionId/messages", async (request, reply) => {
  const user = getUserFromAccessToken(request);
  if (!user) {
    return reply.code(401).send({ message: "unauthorized" });
  }

  const { sessionId } = request.params;
  const session = sessions.find((item) => item.id === sessionId && item.userId === user.id);
  if (!session) {
    return reply.code(404).send({ message: "session not found" });
  }

  const items = messages.filter((item) => item.sessionId === sessionId);
  return { items };
});

app.post("/v1/messages", async (request, reply) => {
  const user = getUserFromAccessToken(request);
  if (!user) {
    return reply.code(401).send({ message: "unauthorized" });
  }

  const body = request.body || {};
  const sessionId = String(body.sessionId || "");
  const text = String(body.text || "").trim();
  const provider = String(body.provider || "preview");
  const model = String(body.model || "");

  if (!sessionId || !text) {
    return reply.code(400).send({ message: "sessionId and text required" });
  }

  const session = sessions.find((item) => item.id === sessionId && item.userId === user.id);
  if (!session) {
    return reply.code(404).send({ message: "session not found" });
  }

  const character = findCharacter(session.characterId);
  const history = messages.filter((item) => item.sessionId === sessionId).slice(-10);

  const userMessage = {
    id: crypto.randomUUID(),
    sessionId,
    role: "user",
    text,
    createdAt: new Date().toISOString(),
  };
  messages.push(userMessage);

  const responseText = await generateReply({
    character,
    userText: text,
    provider,
    model,
    history,
  });

  const assistantMessage = {
    id: crypto.randomUUID(),
    sessionId,
    role: "assistant",
    text: responseText,
    createdAt: new Date().toISOString(),
  };
  messages.push(assistantMessage);

  return { item: assistantMessage };
});

app.post("/v1/stt", async (request, reply) => {
  const user = getUserFromAccessToken(request);
  if (!user) {
    return reply.code(401).send({ message: "unauthorized" });
  }

  if (!FASTER_WHISPER_URL) {
    return reply.code(501).send({
      message: "faster-whisper adapter not configured",
      hint: "Set FASTER_WHISPER_URL to your local whisper microservice endpoint",
    });
  }

  const body = request.body || {};
  const response = await fetch(`${FASTER_WHISPER_URL}/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return reply.code(502).send({ message: "stt provider failed" });
  }

  const data = await response.json();
  return data;
});

app.get("/v1/tts/voices", async (request, reply) => {
  const user = getUserFromAccessToken(request);
  if (!user) {
    return reply.code(401).send({ message: "unauthorized" });
  }

  return {
    items: [
      { provider: "piper", id: "ru_RU-irina-medium", label: "Piper Irina RU" },
      { provider: "piper", id: "ru_RU-ruslan-medium", label: "Piper Ruslan RU" },
      { provider: "piper", id: "en_US-lessac-medium", label: "Piper Lessac EN" },
      { provider: "xtts", id: "xtts-default", label: "XTTS Default Voice" },
      { provider: "openai", id: "alloy", label: "OpenAI Alloy" },
      { provider: "openai", id: "verse", label: "OpenAI Verse" },
      { provider: "openai", id: "sage", label: "OpenAI Sage" },
      { provider: "elevenlabs", id: ELEVENLABS_VOICE_ID || "eleven-default", label: "ElevenLabs Voice" },
    ],
  };
});

app.post("/v1/tts/synthesize", async (request, reply) => {
  const user = getUserFromAccessToken(request);
  if (!user) {
    return reply.code(401).send({ message: "unauthorized" });
  }

  const body = request.body || {};
  const text = String(body.text || "").trim();
  const provider = String(body.provider || TTS_PROVIDER_DEFAULT).toLowerCase();
  const voiceId = String(body.voiceId || "").trim();
  const speed = Number(body.speed || 1);

  if (!text) {
    return reply.code(400).send({ message: "text required" });
  }

  try {
    const result = await synthesizeTts({ text, provider, voiceId, speed });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "tts provider failed";
    return reply.code(502).send({ message });
  }
});

app.post("/v1/tts", async (request, reply) => {
  // Backward-compatible alias for previous endpoint.
  const user = getUserFromAccessToken(request);
  if (!user) {
    return reply.code(401).send({ message: "unauthorized" });
  }

  const body = request.body || {};
  const text = String(body.text || body.transcript || "").trim();
  if (!text) {
    return reply.code(400).send({ message: "text required" });
  }

  try {
    return await synthesizeTts({
      text,
      provider: String(body.provider || TTS_PROVIDER_DEFAULT).toLowerCase(),
      voiceId: String(body.voice || body.voiceId || "").trim(),
      speed: Number(body.speed || 1),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "tts provider failed";
    return reply.code(502).send({ message });
  }
});

app.get("/v1/realtime", { websocket: true }, (socket, request) => {
  socket.on("message", async (rawMessage) => {
    let payload;
    try {
      payload = JSON.parse(String(rawMessage));
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "invalid json" }));
      return;
    }

    if (payload.type !== "user_text") {
      socket.send(JSON.stringify({ type: "error", message: "unsupported event type" }));
      return;
    }

    const character = findCharacter(String(payload.characterId || ""));
    const userText = String(payload.text || "").trim();
    if (!userText) {
      socket.send(JSON.stringify({ type: "error", message: "text required" }));
      return;
    }

    const responseText = await generateReply({
      character,
      userText,
      provider: String(payload.provider || "preview"),
      model: String(payload.model || ""),
      history: Array.isArray(payload.history) ? payload.history : [],
    });

    const words = responseText.split(" ");
    let index = 0;

    const timer = setInterval(() => {
      index += 1;
      const delta = words[index - 1];
      socket.send(JSON.stringify({ type: "assistant_chunk", delta: `${delta} ` }));

      if (index >= words.length) {
        clearInterval(timer);
        socket.send(JSON.stringify({ type: "assistant_final", text: responseText }));
      }
    }, 35);
  });
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.code(500).send({ message: "internal error" });
});

app.listen({ port: PORT, host: HOST }).then(() => {
  app.log.info(`AI NPC backend listening on http://${HOST}:${PORT}`);
});

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function issueTokens(user) {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: "access",
      tokenVersion: user.tokenVersion,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );

  const refreshToken = jwt.sign(
    {
      sub: user.id,
      type: "refresh",
      tokenVersion: user.tokenVersion,
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TTL }
  );

  return { accessToken, refreshToken };
}

function getUserFromAccessToken(request) {
  const authHeader = request.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload || payload.type !== "access") {
    return null;
  }

  const user = users.find((item) => item.id === payload.sub);
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    return null;
  }

  return user;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function findCharacter(characterId) {
  const character = [...defaultCharacters, ...customCharacters].find((item) => item.id === characterId);
  return character || defaultCharacters[0];
}

async function generateReply({ character, userText, provider, model, history }) {
  if (provider === "ollama") {
    try {
      return await runOllama({ character, userText, model, history });
    } catch {
      return previewReply(character, userText);
    }
  }

  if (provider === "openrouter") {
    try {
      return await runOpenRouter({ character, userText, model, history });
    } catch {
      return previewReply(character, userText);
    }
  }

  return previewReply(character, userText);
}

async function runOllama({ character, userText, model, history }) {
  const messages = buildMessages(character, userText, history);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || OLLAMA_MODEL,
      stream: false,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error("ollama failed");
  }

  const data = await response.json();
  const text = data?.message?.content?.trim();
  if (!text) {
    throw new Error("empty ollama response");
  }

  return text;
}

async function runOpenRouter({ character, userText, model, history }) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("missing OPENROUTER_API_KEY");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost",
      "X-Title": "AI NPC Platform",
    },
    body: JSON.stringify({
      model: model || OPENROUTER_MODEL,
      messages: buildMessages(character, userText, history),
    }),
  });

  if (!response.ok) {
    throw new Error("openrouter failed");
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("empty openrouter response");
  }

  return text;
}

async function synthesizeTts({ text, provider, voiceId, speed }) {
  if (provider === "piper") {
    if (!PIPER_URL) {
      throw new Error("piper adapter not configured (PIPER_URL)");
    }
    return runRemoteTtsAdapter({
      url: `${PIPER_URL}/synthesize`,
      payload: { text, voice: voiceId || "ru_RU-irina-medium", speed },
      provider,
      voiceId: voiceId || "ru_RU-irina-medium",
    });
  }

  if (provider === "xtts") {
    if (!XTTS_URL) {
      throw new Error("xtts adapter not configured (XTTS_URL)");
    }
    return runRemoteTtsAdapter({
      url: `${XTTS_URL}/synthesize`,
      payload: { text, voice: voiceId || "xtts-default", speed },
      provider,
      voiceId: voiceId || "xtts-default",
    });
  }

  if (provider === "openai") {
    if (!OPENAI_API_KEY) {
      throw new Error("openai tts not configured (OPENAI_API_KEY)");
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice: voiceId || OPENAI_TTS_VOICE,
        input: text,
        format: "mp3",
      }),
    });

    if (!response.ok) {
      throw new Error("openai tts failed");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      provider,
      voiceId: voiceId || OPENAI_TTS_VOICE,
      mimeType: "audio/mpeg",
      audioBase64: buffer.toString("base64"),
    };
  }

  if (provider === "elevenlabs") {
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
      throw new Error("elevenlabs not configured (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID)");
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || ELEVENLABS_VOICE_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        model_id: ELEVENLABS_MODEL_ID,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error("elevenlabs tts failed");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      provider,
      voiceId: voiceId || ELEVENLABS_VOICE_ID,
      mimeType: "audio/mpeg",
      audioBase64: buffer.toString("base64"),
    };
  }

  throw new Error(`unsupported tts provider: ${provider}`);
}

async function runRemoteTtsAdapter({ url, payload, provider, voiceId }) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`${provider} adapter failed`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (typeof data.audioBase64 === "string" && data.audioBase64.trim()) {
      return {
        provider,
        voiceId,
        mimeType: data.mimeType || "audio/wav",
        audioBase64: data.audioBase64,
      };
    }

    throw new Error(`${provider} adapter returned invalid json`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    provider,
    voiceId,
    mimeType: contentType || "audio/wav",
    audioBase64: buffer.toString("base64"),
  };
}

function buildMessages(character, userText, history) {
  const context = history
    .slice(-8)
    .map((item) => ({ role: item.role || "user", content: String(item.text || "") }))
    .filter((item) => item.content.trim());

  return [{ role: "system", content: character.systemPrompt }, ...context, { role: "user", content: userText }];
}

function previewReply(character, userText) {
  return `${character.name}: ${character.opening} Main direction for your request: ${userText}. I will keep style ${character.tone.toLowerCase()} and focus on ${character.role.toLowerCase()}.`;
}