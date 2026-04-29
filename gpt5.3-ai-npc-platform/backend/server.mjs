import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import pg from "pg";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || 8787);
const databaseUrl = process.env.DATABASE_URL || "";
const apiKey = process.env.API_KEY || "";
const jwtSecret = process.env.JWT_SECRET || "dev-jwt-secret-change-me";
const openAiApiKey = process.env.OPENAI_API_KEY || "";
const openAiTtsModel = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const openAiTtsVoice = process.env.OPENAI_TTS_VOICE || "alloy";

const { Pool } = pg;

await app.register(cors, { origin: true, methods: ["GET", "POST", "OPTIONS"] });
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await app.register(websocket);

const characters = [
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

const sessions = new Map();
const messages = [];
const users = new Map();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function signJwtToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: "7d" });
}

function verifyJwtToken(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
}

function getAuthTokenFromRequest(request) {
  const authHeader = request.headers.authorization;
  const bearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const requestUrl = new URL(request.url, "http://localhost");
  return bearer || requestUrl.searchParams.get("token") || "";
}

function createMemoryStore() {
  return {
    mode: "memory",
    async init() {
      return;
    },
    async listCharacters() {
      return characters;
    },
    async hasCharacter(characterId) {
      return characters.some((item) => item.id === characterId);
    },
    async createSession(characterId) {
      const session = { id: randomUUID(), characterId, createdAt: new Date().toISOString() };
      sessions.set(session.id, session);
      return session;
    },
    async getSession(sessionId) {
      return sessions.get(sessionId) || null;
    },
    async listSessionMessages(sessionId) {
      return messages
        .filter((item) => item.sessionId === sessionId)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    },
    async pushMessage(message) {
      messages.push(message);
      return message;
    },
    async createUser({ email, passwordHash, name }) {
      const normalizedEmail = normalizeEmail(email);
      const existing = [...users.values()].find((user) => user.email === normalizedEmail);
      if (existing) {
        return null;
      }

      const user = {
        id: randomUUID(),
        email: normalizedEmail,
        passwordHash,
        name: name || "User",
        createdAt: new Date().toISOString(),
      };
      users.set(user.id, user);
      return user;
    },
    async getUserByEmail(email) {
      const normalizedEmail = normalizeEmail(email);
      return [...users.values()].find((user) => user.email === normalizedEmail) || null;
    },
    async getUserById(userId) {
      return users.get(userId) || null;
    },
  };
}

function createPostgresStore(url) {
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  return {
    mode: "postgres",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS characters (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          tone TEXT NOT NULL,
          behavior JSONB NOT NULL,
          opening TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY,
          character_id TEXT NOT NULL REFERENCES characters(id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY,
          session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'npc')),
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      for (const character of characters) {
        await pool.query(
          `
            INSERT INTO characters (id, name, role, tone, behavior, opening)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6)
            ON CONFLICT (id)
            DO UPDATE SET
              name = EXCLUDED.name,
              role = EXCLUDED.role,
              tone = EXCLUDED.tone,
              behavior = EXCLUDED.behavior,
              opening = EXCLUDED.opening;
          `,
          [
            character.id,
            character.name,
            character.role,
            character.tone,
            JSON.stringify(character.behavior),
            character.opening,
          ]
        );
      }
    },
    async listCharacters() {
      const { rows } = await pool.query(
        "SELECT id, name, role, tone, behavior, opening FROM characters ORDER BY created_at ASC"
      );
      return rows.map((row) => ({ ...row, behavior: Array.isArray(row.behavior) ? row.behavior : [] }));
    },
    async hasCharacter(characterId) {
      const { rows } = await pool.query("SELECT id FROM characters WHERE id = $1 LIMIT 1", [characterId]);
      return rows.length > 0;
    },
    async createSession(characterId) {
      const session = { id: randomUUID(), characterId, createdAt: new Date().toISOString() };
      await pool.query("INSERT INTO sessions (id, character_id, created_at) VALUES ($1, $2, $3)", [
        session.id,
        session.characterId,
        session.createdAt,
      ]);
      return session;
    },
    async getSession(sessionId) {
      const { rows } = await pool.query("SELECT id, character_id, created_at FROM sessions WHERE id = $1 LIMIT 1", [
        sessionId,
      ]);
      if (!rows[0]) {
        return null;
      }

      return {
        id: rows[0].id,
        characterId: rows[0].character_id,
        createdAt: new Date(rows[0].created_at).toISOString(),
      };
    },
    async listSessionMessages(sessionId) {
      const { rows } = await pool.query(
        "SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = $1 ORDER BY created_at ASC",
        [sessionId]
      );

      return rows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        role: row.role,
        content: row.content,
        createdAt: new Date(row.created_at).toISOString(),
      }));
    },
    async pushMessage(message) {
      await pool.query(
        "INSERT INTO messages (id, session_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5)",
        [message.id, message.sessionId, message.role, message.content, message.createdAt]
      );
      return message;
    },
    async createUser({ email, passwordHash, name }) {
      const user = {
        id: randomUUID(),
        email: normalizeEmail(email),
        passwordHash,
        name: name || "User",
        createdAt: new Date().toISOString(),
      };

      try {
        await pool.query(
          "INSERT INTO users (id, email, password_hash, name, created_at) VALUES ($1, $2, $3, $4, $5)",
          [user.id, user.email, user.passwordHash, user.name, user.createdAt]
        );
        return user;
      } catch {
        return null;
      }
    },
    async getUserByEmail(email) {
      const { rows } = await pool.query(
        "SELECT id, email, password_hash, name, created_at FROM users WHERE email = $1 LIMIT 1",
        [normalizeEmail(email)]
      );
      if (!rows[0]) {
        return null;
      }

      return {
        id: rows[0].id,
        email: rows[0].email,
        passwordHash: rows[0].password_hash,
        name: rows[0].name,
        createdAt: new Date(rows[0].created_at).toISOString(),
      };
    },
    async getUserById(userId) {
      const { rows } = await pool.query("SELECT id, email, name, created_at FROM users WHERE id = $1 LIMIT 1", [
        userId,
      ]);
      if (!rows[0]) {
        return null;
      }

      return {
        id: rows[0].id,
        email: rows[0].email,
        name: rows[0].name,
        createdAt: new Date(rows[0].created_at).toISOString(),
      };
    },
  };
}

const store = databaseUrl ? createPostgresStore(databaseUrl) : createMemoryStore();

app.addHook("onRequest", async (request, reply) => {
  const requestUrl = new URL(request.url, "http://localhost");
  const path = requestUrl.pathname;

  if (!path.startsWith("/v1")) {
    return;
  }

  if (path === "/v1/auth/register" || path === "/v1/auth/login") {
    return;
  }

  const incomingApiKey = request.headers["x-api-key"];
  const normalizedApiKey = Array.isArray(incomingApiKey) ? incomingApiKey[0] : incomingApiKey;
  const queryApiKey = requestUrl.searchParams.get("api_key") || "";
  const serviceAuthorized = apiKey ? normalizedApiKey === apiKey || queryApiKey === apiKey : false;

  const token = getAuthTokenFromRequest(request);
  const payload = token ? verifyJwtToken(token) : null;
  if (payload?.sub) {
    request.authUserId = String(payload.sub);
  }

  if (!serviceAuthorized && !payload?.sub) {
    await reply.status(401).send({ error: "Unauthorized" });
  }
});

function createReply(characterId, text, history = []) {
  const raw = String(text || "").trim();
  const normalized = raw.toLowerCase();
  const hasCyrillic = /[а-яё]/i.test(raw);

  if (/(как тебя зовут|кто ты|your name|who are you)/i.test(normalized)) {
    if (characterId === "captain-rook") {
      return hasCyrillic
        ? "Я капитан Рук. Командую отрядом и помогаю планировать миссии."
        : "I am Captain Rook. I command the squad and help plan missions.";
    }

    if (characterId === "vexa-vale") {
      return hasCyrillic
        ? "Я Векса Вейл, ваш торговец. Подберу выгодную сделку под ваш стиль игры."
        : "I am Vexa Vale, your merchant. I can tailor a deal for your playstyle.";
    }

    return hasCyrillic
      ? "Меня зовут Mara Archivist. Я хранитель лора и контекста вашего приключения."
      : "My name is Mara Archivist. I keep lore and narrative continuity for your adventure.";
  }

  if (/(что я сказал|повтори|what did i say|repeat)/i.test(normalized)) {
    const lastUser = history.filter((item) => item.role === "user").slice(-2)[0]?.content;
    if (lastUser) {
      return hasCyrillic ? `Ранее вы сказали: "${lastUser}".` : `Previously you said: "${lastUser}".`;
    }
  }

  if (characterId === "captain-rook") {
    return normalized.includes("enemy") || normalized.includes("бой")
      ? "Priority one: secure cover, mark hostile angles, then execute a coordinated flank in 20 seconds."
      : "Mission accepted. I recommend objective breakdown: recon, risk scan, execution, and extraction.";
  }

  if (characterId === "vexa-vale") {
    return normalized.includes("price") || normalized.includes("цена")
      ? "For a trusted player I can lower the final price by 15 percent and add a rare utility item."
      : "Interesting request. I can craft a personalized bundle based on your preferred playstyle.";
  }

  if (normalized.includes("quest") || normalized.includes("квест")) {
    return hasCyrillic
      ? "Контекст обновлен. Я связала вашу текущую зацепку с инцидентом в старом хранилище и подготовила следующую ветку."
      : "Narrative continuity updated. I linked your current clue to the old vault incident and prepared the next branch.";
  }

  return hasCyrillic
    ? "Контекст синхронизирован. Я продолжаю диалог в роли персонажа и учитываю ваши предыдущие реплики."
    : "Context synchronized. I can continue this dialogue with stable memory and role-consistent behavior.";
}

function createNpcAction(characterId, text) {
  const normalized = String(text || "").toLowerCase();
  if (characterId === "captain-rook") {
    if (normalized.includes("enemy") || normalized.includes("attack") || normalized.includes("бой")) {
      return { action: "move_to", confidence: 0.94, params: { zone: "left_flank", x: 18, y: 42 } };
    }
    return { action: "start_quest", confidence: 0.88, params: { questId: "operation_iron_wall" } };
  }

  if (characterId === "vexa-vale") {
    return { action: "offer_trade", confidence: 0.9, params: { discountPercent: 15 } };
  }

  return { action: "lore_hint", confidence: 0.89, params: { thread: "vault_incident" } };
}

async function synthesizeAudioChunks(text) {
  if (!openAiApiKey) {
    return [];
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: openAiTtsModel, voice: openAiTtsVoice, input: text, format: "mp3" }),
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  const chunkSize = 12 * 1024;
  const chunks = [];

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, offset + chunkSize).toString("base64"));
  }

  return chunks;
}

app.get("/health", async () => ({ status: "ok" }));

app.post("/v1/auth/register", async (request, reply) => {
  const body = request.body || {};
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const name = String(body.name || "").trim() || "User";

  if (!email || password.length < 6) {
    return reply.status(400).send({ error: "Invalid credentials" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await store.createUser({ email, passwordHash, name });
  if (!user) {
    return reply.status(409).send({ error: "User already exists" });
  }

  return {
    token: signJwtToken(user),
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
  };
});

app.post("/v1/auth/login", async (request, reply) => {
  const body = request.body || {};
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const user = await store.getUserByEmail(email);

  if (!user) {
    return reply.status(401).send({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return reply.status(401).send({ error: "Invalid email or password" });
  }

  return {
    token: signJwtToken(user),
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
  };
});

app.get("/v1/auth/me", async (request, reply) => {
  if (!request.authUserId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const user = await store.getUserById(request.authUserId);
  if (!user) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  return { user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt } };
});

app.get("/v1/characters", async () => store.listCharacters());

app.post("/v1/sessions", async (request, reply) => {
  const body = request.body || {};
  const characterId = body.characterId;
  if (!characterId || !(await store.hasCharacter(characterId))) {
    return reply.status(400).send({ error: "Invalid characterId" });
  }

  return store.createSession(characterId);
});

app.get("/v1/sessions/:sessionId/messages", async (request) => {
  const sessionId = request.params.sessionId;
  return store.listSessionMessages(sessionId);
});

app.post("/v1/messages", async (request, reply) => {
  const body = request.body || {};
  const session = await store.getSession(body.sessionId);
  if (!session) {
    return reply.status(404).send({ error: "Session not found" });
  }

  const userMessage = {
    id: randomUUID(),
    sessionId: session.id,
    role: "user",
    content: String(body.text || ""),
    createdAt: new Date().toISOString(),
  };
  await store.pushMessage(userMessage);

  const history = await store.listSessionMessages(session.id);
  const npcMessage = {
    id: randomUUID(),
    sessionId: session.id,
    role: "npc",
    content: createReply(session.characterId, body.text, history),
    createdAt: new Date().toISOString(),
  };
  await store.pushMessage(npcMessage);

  return npcMessage;
});

app.get("/v1/realtime", { websocket: true }, (connection) => {
  connection.send(JSON.stringify({ type: "ready", message: "Realtime channel connected" }));

  connection.on("message", async (raw) => {
    try {
      const payload = JSON.parse(String(raw));
      if (payload.type !== "user_message" && payload.type !== "user_voice") {
        connection.send(JSON.stringify({ type: "error", message: "Unsupported message type" }));
        return;
      }

      const session = await store.getSession(payload.sessionId);
      if (!session) {
        connection.send(JSON.stringify({ type: "error", message: "Session not found" }));
        return;
      }

      const incomingText = payload.type === "user_voice" ? String(payload.transcript || "") : String(payload.text || "");
      connection.send(JSON.stringify({ type: "transcript", source: "user", text: incomingText, isFinal: true }));

      const userMessage = {
        id: randomUUID(),
        sessionId: session.id,
        role: "user",
        content: incomingText,
        createdAt: new Date().toISOString(),
      };
      await store.pushMessage(userMessage);

      const history = await store.listSessionMessages(session.id);
      const replyText = createReply(session.characterId, incomingText, history);
      const npcAction = createNpcAction(session.characterId, incomingText);
      connection.send(JSON.stringify({ type: "npc_action", ...npcAction }));

      const words = replyText.split(" ");
      let partial = "";
      for (const word of words) {
        partial = `${partial}${partial ? " " : ""}${word}`;
        connection.send(JSON.stringify({ type: "chunk", text: partial }));
        await new Promise((resolve) => setTimeout(resolve, 45));
      }

      try {
        const audioChunks = await synthesizeAudioChunks(replyText);
        audioChunks.forEach((chunk, index) => {
          connection.send(JSON.stringify({ type: "audio_chunk", seq: index, codec: "mp3", data: chunk }));
        });
      } catch {
        connection.send(
          JSON.stringify({
            type: "audio_chunk",
            seq: 0,
            codec: "pcm16-mock",
            data: Buffer.from(replyText, "utf8").toString("base64"),
          })
        );
      }

      connection.send(JSON.stringify({ type: "transcript", source: "npc", text: replyText, isFinal: true }));

      const npcMessage = {
        id: randomUUID(),
        sessionId: session.id,
        role: "npc",
        content: replyText,
        createdAt: new Date().toISOString(),
      };
      await store.pushMessage(npcMessage);
      connection.send(JSON.stringify({ type: "final", message: npcMessage }));
    } catch {
      connection.send(JSON.stringify({ type: "error", message: "Invalid payload" }));
    }
  });
});

await store.init();

app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`API listening on :${port} (${store.mode})`);
});
