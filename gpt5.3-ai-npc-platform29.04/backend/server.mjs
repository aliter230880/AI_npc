import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
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
const accessTokenTtl = process.env.ACCESS_TOKEN_TTL || "15m";
const refreshTokenTtl = process.env.REFRESH_TOKEN_TTL || "7d";
const usageLimitMessages = Number(process.env.USAGE_LIMIT_MESSAGES || 5000);
const usageLimitSttSeconds = Number(process.env.USAGE_LIMIT_STT_SECONDS || 7200);
const usageLimitTtsSeconds = Number(process.env.USAGE_LIMIT_TTS_SECONDS || 7200);
const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || "admin@local");
const adminPassword = process.env.ADMIN_PASSWORD || "admin123456";
const adminName = process.env.ADMIN_NAME || "Administrator";
const openAiApiKey = process.env.OPENAI_API_KEY || "";
const openAiChatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const openAiSttModel = process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe";
const openAiTtsModel = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const openAiTtsVoice = process.env.OPENAI_TTS_VOICE || "alloy";

const { Pool } = pg;

await app.register(cors, { origin: true, methods: ["GET", "POST", "OPTIONS"] });
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await app.register(multipart);
await app.register(websocket);

const characters = [
  {
    id: "mara-archivist",
    name: "Mara Archivist",
    role: "Lore Guide",
    tone: "Calm, precise, narrative-first",
    systemPrompt: "Preserve lore continuity and answer with grounded narrative clues.",
    behavior: ["Remembers plot details", "Protects canon", "Suggests next quests"],
    opening: "I can continue from your previous discoveries and keep narrative consistency.",
  },
  {
    id: "captain-rook",
    name: "Captain Rook",
    role: "Squad Commander",
    tone: "Direct, tactical, mission-driven",
    systemPrompt: "Focus on tactical actions and mission planning with concise commands.",
    behavior: ["Gives concise commands", "Evaluates risk", "Focuses on objectives"],
    opening: "Give me your mission context and I will produce a tactical plan.",
  },
  {
    id: "vexa-vale",
    name: "Vexa Vale",
    role: "Dynamic Merchant",
    tone: "Friendly, witty, value-focused",
    systemPrompt: "Act as a merchant and optimize offers based on user intent and trust.",
    behavior: ["Adjusts offers by reputation", "Remembers preferences", "Supports multi-language style"],
    opening: "Tell me what you need and I will tailor an offer to your profile.",
  },
];

const sessions = new Map();
const messages = [];
const users = new Map();
const memories = [];
const knowledgeDocuments = [];
const knowledgeChunks = [];
const workspaces = [];
const workspaceMembers = [];
const workspaceUsage = new Map();
const auditLogs = [];
const loginAttemptStore = new Map();

const memoryPriorityWeight = {
  low: 1,
  normal: 2,
  high: 3,
};

function normalizeMemoryPriority(priority) {
  const value = String(priority || "normal").toLowerCase();
  if (value === "low" || value === "normal" || value === "high") {
    return value;
  }
  return "normal";
}

function isMemoryExpired(memory) {
  if (!memory.expiresAt || memory.pinned) {
    return false;
  }
  return Date.parse(memory.expiresAt) <= Date.now();
}

function splitTextIntoChunks(text, chunkSize = 650) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const chunks = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const slice = normalized.slice(cursor, cursor + chunkSize).trim();
    if (slice) {
      chunks.push(slice);
    }
    cursor += chunkSize;
  }

  return chunks;
}

function scoreChunk(query, content) {
  const q = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);
  const c = String(content || "").toLowerCase();
  return q.reduce((acc, token) => (c.includes(token) ? acc + 1 : acc), 0);
}

function getCharacterById(characterId) {
  return characters.find((item) => item.id === characterId) || null;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function signAccessToken(user, workspace) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role || "user",
      workspaceId: workspace?.id || null,
      workspaceRole: workspace?.role || null,
      tokenVersion: user.tokenVersion || 1,
      type: "access",
    },
    jwtSecret,
    { expiresIn: accessTokenTtl }
  );
}

function signRefreshToken(user, workspace) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role || "user",
      workspaceId: workspace?.id || null,
      workspaceRole: workspace?.role || null,
      tokenVersion: user.tokenVersion || 1,
      type: "refresh",
      jti: randomUUID(),
    },
    jwtSecret,
    { expiresIn: refreshTokenTtl }
  );
}

function issueAuthTokens(user, workspace) {
  const accessToken = signAccessToken(user, workspace);
  const refreshToken = signRefreshToken(user, workspace);

  return {
    accessToken,
    refreshToken,
    token: accessToken,
  };
}

function usageDefaults() {
  return {
    messagesUsed: 0,
    sttSecondsUsed: 0,
    ttsSecondsUsed: 0,
    limits: {
      messages: usageLimitMessages,
      sttSeconds: usageLimitSttSeconds,
      ttsSeconds: usageLimitTtsSeconds,
    },
  };
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

function getRefreshTokenFromBody(body) {
  return String((body || {}).refreshToken || "").trim();
}

function getLoginThrottleState(key) {
  const now = Date.now();
  const state = loginAttemptStore.get(key);
  if (!state || now - state.firstAttemptAt > 15 * 60 * 1000) {
    const fresh = { count: 0, firstAttemptAt: now, blockedUntil: 0 };
    loginAttemptStore.set(key, fresh);
    return fresh;
  }

  return state;
}

function isLoginBlocked(ip, email) {
  const byEmail = getLoginThrottleState(`email:${ip}:${email}`);
  const byIp = getLoginThrottleState(`ip:${ip}`);
  const now = Date.now();
  return byEmail.blockedUntil > now || byIp.blockedUntil > now;
}

function recordFailedLogin(ip, email) {
  const now = Date.now();
  const byEmail = getLoginThrottleState(`email:${ip}:${email}`);
  byEmail.count += 1;
  if (byEmail.count >= 8) {
    byEmail.blockedUntil = now + 15 * 60 * 1000;
  }

  const byIp = getLoginThrottleState(`ip:${ip}`);
  byIp.count += 1;
  if (byIp.count >= 30) {
    byIp.blockedUntil = now + 15 * 60 * 1000;
  }
}

function clearFailedLogin(ip, email) {
  loginAttemptStore.delete(`email:${ip}:${email}`);
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
    async getCharacter(characterId) {
      return characters.find((item) => item.id === characterId) || null;
    },
    async hasCharacter(characterId) {
      return characters.some((item) => item.id === characterId);
    },
    async updateCharacterConfig(characterId, patch) {
      const target = characters.find((item) => item.id === characterId);
      if (!target) {
        return null;
      }

      if (typeof patch.tone === "string" && patch.tone.trim()) {
        target.tone = patch.tone.trim();
      }
      if (typeof patch.opening === "string" && patch.opening.trim()) {
        target.opening = patch.opening.trim();
      }
      if (typeof patch.systemPrompt === "string") {
        target.systemPrompt = patch.systemPrompt.trim();
      }
      if (Array.isArray(patch.behavior)) {
        target.behavior = patch.behavior.map((item) => String(item)).filter(Boolean).slice(0, 12);
      }

      return target;
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
    async addMemory(memory) {
      const prepared = {
        id: memory.id || randomUUID(),
        characterId: memory.characterId,
        sessionId: memory.sessionId || null,
        content: String(memory.content || "").trim(),
        priority: normalizeMemoryPriority(memory.priority),
        pinned: Boolean(memory.pinned),
        expiresAt: memory.expiresAt || null,
        createdAt: memory.createdAt || new Date().toISOString(),
      };
      memories.push(prepared);
      return prepared;
    },
    async listCharacterMemories(characterId, limit = 6, options = {}) {
      const includeExpired = Boolean(options.includeExpired);
      return memories
        .filter((item) => item.characterId === characterId)
        .filter((item) => (includeExpired ? true : !isMemoryExpired(item)))
        .sort((a, b) => {
          const p = (memoryPriorityWeight[b.priority] || 2) - (memoryPriorityWeight[a.priority] || 2);
          if (p !== 0) {
            return p;
          }
          if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1;
          }
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        })
        .slice(0, limit);
    },
    async updateMemory(memoryId, patch) {
      const memory = memories.find((item) => item.id === memoryId);
      if (!memory) {
        return null;
      }

      if (typeof patch.content === "string" && patch.content.trim()) {
        memory.content = patch.content.trim();
      }
      if (typeof patch.priority === "string") {
        memory.priority = normalizeMemoryPriority(patch.priority);
      }
      if (typeof patch.pinned === "boolean") {
        memory.pinned = patch.pinned;
      }
      if (typeof patch.expiresAt === "string") {
        memory.expiresAt = patch.expiresAt || null;
      }

      return memory;
    },
    async deleteMemory(memoryId) {
      const index = memories.findIndex((item) => item.id === memoryId);
      if (index === -1) {
        return false;
      }
      memories.splice(index, 1);
      return true;
    },
    async clearCharacterMemories(characterId) {
      const before = memories.length;
      for (let i = memories.length - 1; i >= 0; i -= 1) {
        if (memories[i].characterId === characterId) {
          memories.splice(i, 1);
        }
      }
      return before - memories.length;
    },
    async addKnowledgeDocument({ characterId, title, content }) {
      const document = {
        id: randomUUID(),
        characterId,
        title: String(title || "Knowledge Document"),
        createdAt: new Date().toISOString(),
      };
      knowledgeDocuments.push(document);

      const chunks = splitTextIntoChunks(content).map((chunk, index) => ({
        id: randomUUID(),
        documentId: document.id,
        characterId,
        content: chunk,
        position: index,
      }));
      knowledgeChunks.push(...chunks);

      return { ...document, chunkCount: chunks.length };
    },
    async listKnowledgeDocuments(characterId) {
      return knowledgeDocuments
        .filter((item) => item.characterId === characterId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    async deleteKnowledgeDocument(documentId) {
      const index = knowledgeDocuments.findIndex((item) => item.id === documentId);
      if (index === -1) {
        return false;
      }

      knowledgeDocuments.splice(index, 1);
      for (let i = knowledgeChunks.length - 1; i >= 0; i -= 1) {
        if (knowledgeChunks[i].documentId === documentId) {
          knowledgeChunks.splice(i, 1);
        }
      }

      return true;
    },
    async searchKnowledgeChunks(characterId, query, limit = 5) {
      return knowledgeChunks
        .filter((item) => item.characterId === characterId)
        .map((item) => ({ ...item, score: scoreChunk(query, item.content) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.position - b.position)
        .slice(0, limit);
    },
    async createUser({ email, passwordHash, name, role = "user" }) {
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
        role,
        tokenVersion: 1,
        defaultWorkspaceId: null,
        createdAt: new Date().toISOString(),
      };
      users.set(user.id, user);
      return user;
    },
    async getUserByEmail(email) {
      const normalizedEmail = normalizeEmail(email);
      return [...users.values()].find((user) => user.email === normalizedEmail) || null;
    },
    async createWorkspace({ name, ownerUserId }) {
      const workspace = {
        id: randomUUID(),
        name: String(name || "Workspace").trim() || "Workspace",
        createdAt: new Date().toISOString(),
      };
      workspaces.push(workspace);

      workspaceMembers.push({
        id: randomUUID(),
        workspaceId: workspace.id,
        userId: ownerUserId,
        role: "owner",
        createdAt: new Date().toISOString(),
      });

      const owner = users.get(ownerUserId);
      if (owner) {
        owner.defaultWorkspaceId = workspace.id;
        users.set(ownerUserId, owner);
      }

      workspaceUsage.set(workspace.id, usageDefaults());
      return workspace;
    },
    async listUserWorkspaces(userId) {
      return workspaceMembers
        .filter((member) => member.userId === userId)
        .map((member) => {
          const workspace = workspaces.find((item) => item.id === member.workspaceId);
          if (!workspace) {
            return null;
          }
          return { ...workspace, role: member.role };
        })
        .filter(Boolean);
    },
    async getWorkspaceMembership(userId, workspaceId) {
      return workspaceMembers.find((member) => member.userId === userId && member.workspaceId === workspaceId) || null;
    },
    async setUserDefaultWorkspace(userId, workspaceId) {
      const user = users.get(userId);
      if (!user) {
        return null;
      }
      user.defaultWorkspaceId = workspaceId;
      users.set(userId, user);
      return user;
    },
    async getUserDefaultWorkspace(userId) {
      const user = users.get(userId);
      if (!user || !user.defaultWorkspaceId) {
        return null;
      }

      const workspace = workspaces.find((item) => item.id === user.defaultWorkspaceId);
      const member = workspaceMembers.find(
        (item) => item.workspaceId === user.defaultWorkspaceId && item.userId === userId
      );

      if (!workspace || !member) {
        return null;
      }

      return { ...workspace, role: member.role };
    },
    async incrementUsage(workspaceId, metric, amount) {
      const usage = workspaceUsage.get(workspaceId) || usageDefaults();
      if (metric === "messages") {
        usage.messagesUsed += amount;
      }
      if (metric === "sttSeconds") {
        usage.sttSecondsUsed += amount;
      }
      if (metric === "ttsSeconds") {
        usage.ttsSecondsUsed += amount;
      }
      workspaceUsage.set(workspaceId, usage);
      return usage;
    },
    async getUsage(workspaceId) {
      const usage = workspaceUsage.get(workspaceId) || usageDefaults();
      workspaceUsage.set(workspaceId, usage);
      return usage;
    },
    async logAudit(entry) {
      auditLogs.push({ id: randomUUID(), ...entry, createdAt: new Date().toISOString() });
      return true;
    },
    async listAudit(workspaceId, limit = 50) {
      return auditLogs
        .filter((item) => item.workspaceId === workspaceId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit);
    },
    async bumpUserTokenVersion(userId) {
      const user = users.get(userId);
      if (!user) {
        return null;
      }

      user.tokenVersion = (user.tokenVersion || 1) + 1;
      users.set(userId, user);
      return user;
    },
    async promoteUserToAdmin(email) {
      const normalizedEmail = normalizeEmail(email);
      const found = [...users.values()].find((user) => user.email === normalizedEmail);
      if (!found) {
        return null;
      }

      found.role = "admin";
      users.set(found.id, found);
      return found;
    },
    async getUserById(userId) {
      const user = users.get(userId);
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "user",
        tokenVersion: user.tokenVersion || 1,
        defaultWorkspaceId: user.defaultWorkspaceId || null,
        createdAt: user.createdAt,
        passwordHash: user.passwordHash,
      };
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
          system_prompt TEXT NOT NULL DEFAULT '',
          behavior JSONB NOT NULL,
          opening TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS system_prompt TEXT NOT NULL DEFAULT '';");

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
        CREATE TABLE IF NOT EXISTS memories (
          id UUID PRIMARY KEY,
          character_id TEXT NOT NULL REFERENCES characters(id),
          session_id UUID,
          content TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'normal',
          pinned BOOLEAN NOT NULL DEFAULT FALSE,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query("ALTER TABLE memories ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';");
      await pool.query("ALTER TABLE memories ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;");
      await pool.query("ALTER TABLE memories ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;");

      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_documents (
          id UUID PRIMARY KEY,
          character_id TEXT NOT NULL REFERENCES characters(id),
          title TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
          id UUID PRIMARY KEY,
          document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
          character_id TEXT NOT NULL REFERENCES characters(id),
          content TEXT NOT NULL,
          position INTEGER NOT NULL
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          token_version INTEGER NOT NULL DEFAULT 1,
          default_workspace_id UUID,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS default_workspace_id UUID;");

      await pool.query(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS workspace_members (
          id UUID PRIMARY KEY,
          workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(workspace_id, user_id)
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS workspace_usage (
          workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
          messages_used INTEGER NOT NULL DEFAULT 0,
          stt_seconds_used INTEGER NOT NULL DEFAULT 0,
          tts_seconds_used INTEGER NOT NULL DEFAULT 0,
          messages_limit INTEGER NOT NULL DEFAULT 5000,
          stt_seconds_limit INTEGER NOT NULL DEFAULT 7200,
          tts_seconds_limit INTEGER NOT NULL DEFAULT 7200,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY,
          workspace_id UUID,
          actor_user_id UUID,
          action TEXT NOT NULL,
          target_type TEXT,
          target_id TEXT,
          details JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      for (const character of characters) {
        await pool.query(
          `
            INSERT INTO characters (id, name, role, tone, system_prompt, behavior, opening)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
            ON CONFLICT (id)
            DO UPDATE SET
              name = EXCLUDED.name,
              role = EXCLUDED.role,
              tone = EXCLUDED.tone,
              system_prompt = EXCLUDED.system_prompt,
              behavior = EXCLUDED.behavior,
              opening = EXCLUDED.opening;
          `,
          [
            character.id,
            character.name,
            character.role,
            character.tone,
            character.systemPrompt || "",
            JSON.stringify(character.behavior),
            character.opening,
          ]
        );
      }
    },
    async listCharacters() {
      const { rows } = await pool.query(
        "SELECT id, name, role, tone, system_prompt, behavior, opening FROM characters ORDER BY created_at ASC"
      );
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        tone: row.tone,
        systemPrompt: row.system_prompt || "",
        behavior: Array.isArray(row.behavior) ? row.behavior : [],
        opening: row.opening,
      }));
    },
    async getCharacter(characterId) {
      const { rows } = await pool.query(
        "SELECT id, name, role, tone, system_prompt, behavior, opening FROM characters WHERE id = $1 LIMIT 1",
        [characterId]
      );
      if (!rows[0]) {
        return null;
      }

      return {
        id: rows[0].id,
        name: rows[0].name,
        role: rows[0].role,
        tone: rows[0].tone,
        systemPrompt: rows[0].system_prompt || "",
        behavior: Array.isArray(rows[0].behavior) ? rows[0].behavior : [],
        opening: rows[0].opening,
      };
    },
    async hasCharacter(characterId) {
      const { rows } = await pool.query("SELECT id FROM characters WHERE id = $1 LIMIT 1", [characterId]);
      return rows.length > 0;
    },
    async updateCharacterConfig(characterId, patch) {
      const current = await this.getCharacter(characterId);
      if (!current) {
        return null;
      }

      const next = {
        tone: typeof patch.tone === "string" && patch.tone.trim() ? patch.tone.trim() : current.tone,
        opening:
          typeof patch.opening === "string" && patch.opening.trim() ? patch.opening.trim() : current.opening,
        systemPrompt: typeof patch.systemPrompt === "string" ? patch.systemPrompt.trim() : current.systemPrompt,
        behavior: Array.isArray(patch.behavior)
          ? patch.behavior.map((item) => String(item)).filter(Boolean).slice(0, 12)
          : current.behavior,
      };

      await pool.query(
        "UPDATE characters SET tone = $1, opening = $2, system_prompt = $3, behavior = $4::jsonb WHERE id = $5",
        [next.tone, next.opening, next.systemPrompt, JSON.stringify(next.behavior), characterId]
      );

      return this.getCharacter(characterId);
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
    async addMemory(memory) {
      const prepared = {
        id: memory.id || randomUUID(),
        characterId: memory.characterId,
        sessionId: memory.sessionId || null,
        content: String(memory.content || "").trim(),
        priority: normalizeMemoryPriority(memory.priority),
        pinned: Boolean(memory.pinned),
        expiresAt: memory.expiresAt || null,
        createdAt: memory.createdAt || new Date().toISOString(),
      };

      await pool.query(
        "INSERT INTO memories (id, character_id, session_id, content, priority, pinned, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          prepared.id,
          prepared.characterId,
          prepared.sessionId,
          prepared.content,
          prepared.priority,
          prepared.pinned,
          prepared.expiresAt,
          prepared.createdAt,
        ]
      );
      return prepared;
    },
    async listCharacterMemories(characterId, limit = 6, options = {}) {
      const safeLimit = Math.max(1, Math.min(20, Number(limit) || 6));
      const includeExpired = Boolean(options.includeExpired);
      const whereExpiry = includeExpired ? "" : "AND (expires_at IS NULL OR expires_at > NOW() OR pinned = TRUE)";
      const { rows } = await pool.query(
        `SELECT id, character_id, session_id, content, priority, pinned, expires_at, created_at
         FROM memories
         WHERE character_id = $1 ${whereExpiry}
         ORDER BY pinned DESC,
                  CASE priority WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END DESC,
                  created_at DESC
         LIMIT $2`,
        [characterId, safeLimit]
      );

      return rows.map((row) => ({
        id: row.id,
        characterId: row.character_id,
        sessionId: row.session_id,
        content: row.content,
        priority: normalizeMemoryPriority(row.priority),
        pinned: Boolean(row.pinned),
        expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
      }));
    },
    async updateMemory(memoryId, patch) {
      const current = await pool.query(
        "SELECT id, character_id, session_id, content, priority, pinned, expires_at, created_at FROM memories WHERE id = $1 LIMIT 1",
        [memoryId]
      );
      if (!current.rows[0]) {
        return null;
      }

      const row = current.rows[0];
      const next = {
        content: typeof patch.content === "string" && patch.content.trim() ? patch.content.trim() : row.content,
        priority: typeof patch.priority === "string" ? normalizeMemoryPriority(patch.priority) : row.priority,
        pinned: typeof patch.pinned === "boolean" ? patch.pinned : Boolean(row.pinned),
        expiresAt: typeof patch.expiresAt === "string" ? patch.expiresAt || null : row.expires_at,
      };

      await pool.query(
        "UPDATE memories SET content = $1, priority = $2, pinned = $3, expires_at = $4 WHERE id = $5",
        [next.content, next.priority, next.pinned, next.expiresAt, memoryId]
      );

      const updated = await pool.query(
        "SELECT id, character_id, session_id, content, priority, pinned, expires_at, created_at FROM memories WHERE id = $1 LIMIT 1",
        [memoryId]
      );
      const updatedRow = updated.rows[0];

      return {
        id: updatedRow.id,
        characterId: updatedRow.character_id,
        sessionId: updatedRow.session_id,
        content: updatedRow.content,
        priority: normalizeMemoryPriority(updatedRow.priority),
        pinned: Boolean(updatedRow.pinned),
        expiresAt: updatedRow.expires_at ? new Date(updatedRow.expires_at).toISOString() : null,
        createdAt: new Date(updatedRow.created_at).toISOString(),
      };
    },
    async deleteMemory(memoryId) {
      const result = await pool.query("DELETE FROM memories WHERE id = $1", [memoryId]);
      return (result.rowCount || 0) > 0;
    },
    async clearCharacterMemories(characterId) {
      const result = await pool.query("DELETE FROM memories WHERE character_id = $1", [characterId]);
      return result.rowCount || 0;
    },
    async addKnowledgeDocument({ characterId, title, content }) {
      const document = {
        id: randomUUID(),
        characterId,
        title: String(title || "Knowledge Document"),
        createdAt: new Date().toISOString(),
      };

      await pool.query(
        "INSERT INTO knowledge_documents (id, character_id, title, created_at) VALUES ($1, $2, $3, $4)",
        [document.id, document.characterId, document.title, document.createdAt]
      );

      const chunks = splitTextIntoChunks(content).map((chunk, index) => ({
        id: randomUUID(),
        documentId: document.id,
        characterId,
        content: chunk,
        position: index,
      }));

      for (const chunk of chunks) {
        await pool.query(
          "INSERT INTO knowledge_chunks (id, document_id, character_id, content, position) VALUES ($1, $2, $3, $4, $5)",
          [chunk.id, chunk.documentId, chunk.characterId, chunk.content, chunk.position]
        );
      }

      return { ...document, chunkCount: chunks.length };
    },
    async listKnowledgeDocuments(characterId) {
      const { rows } = await pool.query(
        "SELECT id, character_id, title, created_at FROM knowledge_documents WHERE character_id = $1 ORDER BY created_at DESC",
        [characterId]
      );

      return rows.map((row) => ({
        id: row.id,
        characterId: row.character_id,
        title: row.title,
        createdAt: new Date(row.created_at).toISOString(),
      }));
    },
    async deleteKnowledgeDocument(documentId) {
      const result = await pool.query("DELETE FROM knowledge_documents WHERE id = $1", [documentId]);
      return (result.rowCount || 0) > 0;
    },
    async searchKnowledgeChunks(characterId, query, limit = 5) {
      const safeLimit = Math.max(1, Math.min(20, Number(limit) || 5));
      const { rows } = await pool.query(
        "SELECT id, document_id, character_id, content, position FROM knowledge_chunks WHERE character_id = $1",
        [characterId]
      );

      return rows
        .map((row) => ({
          id: row.id,
          documentId: row.document_id,
          characterId: row.character_id,
          content: row.content,
          position: row.position,
          score: scoreChunk(query, row.content),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.position - b.position)
        .slice(0, safeLimit);
    },
    async createUser({ email, passwordHash, name, role = "user" }) {
      const user = {
        id: randomUUID(),
        email: normalizeEmail(email),
        passwordHash,
        name: name || "User",
        role,
        tokenVersion: 1,
        defaultWorkspaceId: null,
        createdAt: new Date().toISOString(),
      };

      try {
        await pool.query(
          "INSERT INTO users (id, email, password_hash, role, token_version, name, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [user.id, user.email, user.passwordHash, user.role, user.tokenVersion, user.name, user.createdAt]
        );
        return user;
      } catch {
        return null;
      }
    },
    async getUserByEmail(email) {
      const { rows } = await pool.query(
        "SELECT id, email, password_hash, role, token_version, default_workspace_id, name, created_at FROM users WHERE email = $1 LIMIT 1",
        [normalizeEmail(email)]
      );
      if (!rows[0]) {
        return null;
      }

      return {
        id: rows[0].id,
        email: rows[0].email,
        passwordHash: rows[0].password_hash,
        role: rows[0].role || "user",
        tokenVersion: rows[0].token_version || 1,
        defaultWorkspaceId: rows[0].default_workspace_id || null,
        name: rows[0].name,
        createdAt: new Date(rows[0].created_at).toISOString(),
      };
    },
    async createWorkspace({ name, ownerUserId }) {
      const workspace = {
        id: randomUUID(),
        name: String(name || "Workspace").trim() || "Workspace",
        createdAt: new Date().toISOString(),
      };

      await pool.query("INSERT INTO workspaces (id, name, created_at) VALUES ($1, $2, $3)", [
        workspace.id,
        workspace.name,
        workspace.createdAt,
      ]);

      await pool.query(
        "INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, $5)",
        [randomUUID(), workspace.id, ownerUserId, "owner", new Date().toISOString()]
      );

      await pool.query("UPDATE users SET default_workspace_id = $1 WHERE id = $2", [workspace.id, ownerUserId]);
      await pool.query(
        "INSERT INTO workspace_usage (workspace_id, messages_limit, stt_seconds_limit, tts_seconds_limit) VALUES ($1, $2, $3, $4) ON CONFLICT (workspace_id) DO NOTHING",
        [workspace.id, usageLimitMessages, usageLimitSttSeconds, usageLimitTtsSeconds]
      );

      return workspace;
    },
    async listUserWorkspaces(userId) {
      const { rows } = await pool.query(
        `SELECT w.id, w.name, w.created_at, wm.role
         FROM workspace_members wm
         JOIN workspaces w ON w.id = wm.workspace_id
         WHERE wm.user_id = $1
         ORDER BY w.created_at DESC`,
        [userId]
      );

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        createdAt: new Date(row.created_at).toISOString(),
      }));
    },
    async getWorkspaceMembership(userId, workspaceId) {
      const { rows } = await pool.query(
        "SELECT id, workspace_id, user_id, role, created_at FROM workspace_members WHERE user_id = $1 AND workspace_id = $2 LIMIT 1",
        [userId, workspaceId]
      );
      if (!rows[0]) {
        return null;
      }
      return {
        id: rows[0].id,
        workspaceId: rows[0].workspace_id,
        userId: rows[0].user_id,
        role: rows[0].role,
        createdAt: new Date(rows[0].created_at).toISOString(),
      };
    },
    async setUserDefaultWorkspace(userId, workspaceId) {
      await pool.query("UPDATE users SET default_workspace_id = $1 WHERE id = $2", [workspaceId, userId]);
      return this.getUserById(userId);
    },
    async getUserDefaultWorkspace(userId) {
      const { rows } = await pool.query(
        `SELECT w.id, w.name, w.created_at, wm.role
         FROM users u
         JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = u.default_workspace_id
         JOIN workspaces w ON w.id = u.default_workspace_id
         WHERE u.id = $1
         LIMIT 1`,
        [userId]
      );

      if (!rows[0]) {
        return null;
      }

      return {
        id: rows[0].id,
        name: rows[0].name,
        role: rows[0].role,
        createdAt: new Date(rows[0].created_at).toISOString(),
      };
    },
    async incrementUsage(workspaceId, metric, amount) {
      await pool.query(
        "INSERT INTO workspace_usage (workspace_id, messages_limit, stt_seconds_limit, tts_seconds_limit) VALUES ($1, $2, $3, $4) ON CONFLICT (workspace_id) DO NOTHING",
        [workspaceId, usageLimitMessages, usageLimitSttSeconds, usageLimitTtsSeconds]
      );

      if (metric === "messages") {
        await pool.query("UPDATE workspace_usage SET messages_used = messages_used + $1, updated_at = NOW() WHERE workspace_id = $2", [amount, workspaceId]);
      }
      if (metric === "sttSeconds") {
        await pool.query("UPDATE workspace_usage SET stt_seconds_used = stt_seconds_used + $1, updated_at = NOW() WHERE workspace_id = $2", [amount, workspaceId]);
      }
      if (metric === "ttsSeconds") {
        await pool.query("UPDATE workspace_usage SET tts_seconds_used = tts_seconds_used + $1, updated_at = NOW() WHERE workspace_id = $2", [amount, workspaceId]);
      }

      return this.getUsage(workspaceId);
    },
    async getUsage(workspaceId) {
      const { rows } = await pool.query(
        "SELECT workspace_id, messages_used, stt_seconds_used, tts_seconds_used, messages_limit, stt_seconds_limit, tts_seconds_limit FROM workspace_usage WHERE workspace_id = $1 LIMIT 1",
        [workspaceId]
      );
      if (!rows[0]) {
        return usageDefaults();
      }

      return {
        messagesUsed: rows[0].messages_used,
        sttSecondsUsed: rows[0].stt_seconds_used,
        ttsSecondsUsed: rows[0].tts_seconds_used,
        limits: {
          messages: rows[0].messages_limit,
          sttSeconds: rows[0].stt_seconds_limit,
          ttsSeconds: rows[0].tts_seconds_limit,
        },
      };
    },
    async logAudit(entry) {
      await pool.query(
        "INSERT INTO audit_logs (id, workspace_id, actor_user_id, action, target_type, target_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)",
        [
          randomUUID(),
          entry.workspaceId || null,
          entry.actorUserId || null,
          entry.action,
          entry.targetType || null,
          entry.targetId || null,
          JSON.stringify(entry.details || {}),
          new Date().toISOString(),
        ]
      );
      return true;
    },
    async listAudit(workspaceId, limit = 50) {
      const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
      const { rows } = await pool.query(
        "SELECT id, workspace_id, actor_user_id, action, target_type, target_id, details, created_at FROM audit_logs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2",
        [workspaceId, safeLimit]
      );

      return rows.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        actorUserId: row.actor_user_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        details: row.details || {},
        createdAt: new Date(row.created_at).toISOString(),
      }));
    },
    async bumpUserTokenVersion(userId) {
      const { rows } = await pool.query(
        "UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING id, email, role, token_version, name, created_at",
        [userId]
      );

      if (!rows[0]) {
        return null;
      }

      return {
        id: rows[0].id,
        email: rows[0].email,
        role: rows[0].role || "user",
        tokenVersion: rows[0].token_version || 1,
        defaultWorkspaceId: rows[0].default_workspace_id || null,
        name: rows[0].name,
        createdAt: new Date(rows[0].created_at).toISOString(),
      };
    },
    async promoteUserToAdmin(email) {
      const { rows } = await pool.query(
        "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role, token_version, name, created_at",
        [normalizeEmail(email)]
      );

      if (!rows[0]) {
        return null;
      }

      return {
        id: rows[0].id,
        email: rows[0].email,
        role: rows[0].role || "user",
        tokenVersion: rows[0].token_version || 1,
        name: rows[0].name,
        createdAt: new Date(rows[0].created_at).toISOString(),
      };
    },
    async getUserById(userId) {
      const { rows } = await pool.query(
        "SELECT id, email, role, token_version, default_workspace_id, name, created_at FROM users WHERE id = $1 LIMIT 1",
        [userId]
      );
      if (!rows[0]) {
        return null;
      }

      return {
        id: rows[0].id,
        email: rows[0].email,
        role: rows[0].role || "user",
        tokenVersion: rows[0].token_version || 1,
        defaultWorkspaceId: rows[0].default_workspace_id || null,
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

  if (path === "/v1/auth/register" || path === "/v1/auth/login" || path === "/v1/auth/refresh") {
    return;
  }

  const incomingApiKey = request.headers["x-api-key"];
  const normalizedApiKey = Array.isArray(incomingApiKey) ? incomingApiKey[0] : incomingApiKey;
  const queryApiKey = requestUrl.searchParams.get("api_key") || "";
  const serviceAuthorized = apiKey ? normalizedApiKey === apiKey || queryApiKey === apiKey : false;

  const token = getAuthTokenFromRequest(request);
  const payload = token ? verifyJwtToken(token) : null;
  if (payload?.sub && payload?.type !== "refresh") {
    request.authUserId = String(payload.sub);
    request.authUserRole = String(payload.role || "user");
    request.authWorkspaceId = payload.workspaceId ? String(payload.workspaceId) : null;
    request.authWorkspaceRole = payload.workspaceRole ? String(payload.workspaceRole) : null;
  }

  if (!serviceAuthorized && !request.authUserId) {
    await reply.status(401).send({ error: "Unauthorized" });
  }
});

function isRequestAdmin(request) {
  return request.authUserRole === "admin";
}

function isWorkspaceAdmin(request) {
  return request.authWorkspaceRole === "owner" || request.authWorkspaceRole === "admin";
}

async function ensureWorkspaceContext(request) {
  if (!request.authUserId) {
    return null;
  }

  if (request.authWorkspaceId) {
    const member = await store.getWorkspaceMembership(request.authUserId, request.authWorkspaceId);
    if (member) {
      return { id: member.workspaceId, role: member.role };
    }
  }

  const fallback = await store.getUserDefaultWorkspace(request.authUserId);
  if (!fallback) {
    return null;
  }

  request.authWorkspaceId = fallback.id;
  request.authWorkspaceRole = fallback.role;
  return { id: fallback.id, role: fallback.role };
}

async function ensureUsageWithinLimit(request, metric, incrementBy) {
  const ctx = await ensureWorkspaceContext(request);
  if (!ctx) {
    return { ok: false, status: 400, error: "Workspace context is missing" };
  }

  const usage = await store.getUsage(ctx.id);
  const limits = usage.limits || usageDefaults().limits;

  if (metric === "messages" && usage.messagesUsed + incrementBy > limits.messages) {
    return { ok: false, status: 429, error: "Workspace message limit exceeded" };
  }
  if (metric === "sttSeconds" && usage.sttSecondsUsed + incrementBy > limits.sttSeconds) {
    return { ok: false, status: 429, error: "Workspace STT limit exceeded" };
  }
  if (metric === "ttsSeconds" && usage.ttsSecondsUsed + incrementBy > limits.ttsSeconds) {
    return { ok: false, status: 429, error: "Workspace TTS limit exceeded" };
  }

  return { ok: true, workspaceId: ctx.id };
}

async function ensureAdmin(request, reply) {
  if (isRequestAdmin(request)) {
    return true;
  }

  await reply.status(403).send({ error: "Admin access required" });
  return false;
}

async function ensureWorkspaceAdminOrSystemAdmin(request, reply) {
  if (isRequestAdmin(request) || isWorkspaceAdmin(request)) {
    return true;
  }

  await reply.status(403).send({ error: "Workspace admin access required" });
  return false;
}

function createRuleBasedReply(characterId, text, history = []) {
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

function buildMemoryCandidate(userText, npcText) {
  const raw = String(userText || "").trim();
  if (!raw || raw.length < 6) {
    return "";
  }

  if (!/(меня зовут|my name is|я люблю|i like|запомни|remember)/i.test(raw)) {
    return "";
  }

  return `User said: ${raw}\nNPC replied: ${String(npcText || "").trim()}`;
}

async function createReply(characterId, text, history = [], longTermMemories = [], knowledgeContext = []) {
  const character = (await store.getCharacter(characterId)) || getCharacterById(characterId);
  if (!character || !openAiApiKey) {
    return createRuleBasedReply(characterId, text, history);
  }

  try {
    const recentMessages = history
      .slice(-10)
      .map((item) => ({ role: item.role === "npc" ? "assistant" : "user", content: item.content }));

    const memoryContext = longTermMemories.length
      ? longTermMemories.map((memory, index) => `${index + 1}. ${memory.content}`).join("\n")
      : "No long-term memories yet.";

    const knowledgeBlock = knowledgeContext.length
      ? knowledgeContext.map((chunk, index) => `${index + 1}. ${chunk.content}`).join("\n")
      : "No external documents matched.";

    const systemPrompt = [
      `You are ${character.name} (${character.role}).`,
      `Tone: ${character.tone}.`,
      `Primary instruction: ${character.systemPrompt || "Stay in character and answer clearly."}`,
      `Behavior constraints: ${character.behavior.join(", ")}.`,
      "Respond briefly and naturally. Keep strict character consistency.",
      "If user writes in Russian, answer in Russian. If in English, answer in English.",
      `Long-term memories:\n${memoryContext}`,
      `Relevant knowledge chunks:\n${knowledgeBlock}`,
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiChatModel,
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          ...recentMessages,
          { role: "user", content: String(text || "") },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM failed: ${response.status}`);
    }

    const data = await response.json();
    const llmText = data?.choices?.[0]?.message?.content;
    if (!llmText || typeof llmText !== "string") {
      throw new Error("LLM returned empty content");
    }

    return llmText.trim();
  } catch {
    return createRuleBasedReply(characterId, text, history);
  }
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

async function transcribeAudioBuffer(buffer, fileName, language = "ru") {
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const form = new FormData();
  form.append("model", openAiSttModel);
  form.append("language", language);
  form.append("file", new Blob([buffer]), fileName || "voice.webm");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`STT failed: ${response.status}`);
  }

  const data = await response.json();
  const text = typeof data?.text === "string" ? data.text.trim() : "";
  return text;
}

async function ensureAdminUser() {
  const existing = await store.getUserByEmail(adminEmail);
  if (existing) {
    if (existing.role !== "admin") {
      return store.promoteUserToAdmin(adminEmail);
    }

    return existing;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const created = await store.createUser({
    email: adminEmail,
    passwordHash,
    name: adminName,
    role: "admin",
  });

  return created;
}

app.get("/health", async () => ({ status: "ok" }));

app.get("/v1/diagnostics", async () => {
  return {
    auth: { enabled: true, jwt: true, apiKey: Boolean(apiKey) },
    llm: { provider: "openai", enabled: Boolean(openAiApiKey), model: openAiChatModel },
    stt: { provider: "openai", enabled: Boolean(openAiApiKey), model: openAiSttModel },
    tts: { provider: "openai", enabled: Boolean(openAiApiKey), model: openAiTtsModel, voice: openAiTtsVoice },
    realtime: { ws: true },
  };
});

app.post("/v1/diagnostics/tts", async (request, reply) => {
  try {
    if (!openAiApiKey) {
      return reply.status(400).send({ error: "OPENAI_API_KEY is not configured" });
    }

    const text = String((request.body || {}).text || "Diagnostic voice check").slice(0, 120);
    const chunks = await synthesizeAudioChunks(text);
    return {
      ok: true,
      codec: "mp3",
      chunks: chunks.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS diagnostics failed";
    return reply.status(500).send({ error: message });
  }
});

app.post("/v1/stt", async (request, reply) => {
  try {
    const usageGate = await ensureUsageWithinLimit(request, "sttSeconds", 4);
    if (!usageGate.ok) {
      return reply.status(usageGate.status).send({ error: usageGate.error });
    }

    const part = await request.file();
    if (!part) {
      return reply.status(400).send({ error: "Audio file is required" });
    }

    const chunks = [];
    for await (const chunk of part.file) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    if (!buffer.length) {
      return reply.status(400).send({ error: "Empty audio payload" });
    }

    const language = typeof part.fields?.language?.value === "string" ? part.fields.language.value : "ru";
    const transcript = await transcribeAudioBuffer(buffer, part.filename || "voice.webm", language);

    await store.incrementUsage(usageGate.workspaceId, "sttSeconds", 4);

    return { transcript };
  } catch (error) {
    const message = error instanceof Error ? error.message : "STT error";
    return reply.status(500).send({ error: message });
  }
});

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

  const workspace = await store.createWorkspace({
    name: `${name}'s Workspace`,
    ownerUserId: user.id,
  });

  await store.logAudit({
    workspaceId: workspace.id,
    actorUserId: user.id,
    action: "auth.register",
    targetType: "user",
    targetId: user.id,
    details: { email: user.email },
  });

  const tokens = issueAuthTokens(user, { id: workspace.id, role: "owner" });
  return {
    ...tokens,
    user: { id: user.id, email: user.email, name: user.name, role: user.role || "user", createdAt: user.createdAt },
    workspace: { id: workspace.id, role: "owner", name: workspace.name },
  };
});

app.post("/v1/auth/login", async (request, reply) => {
  const body = request.body || {};
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (isLoginBlocked(request.ip || "unknown", email)) {
    return reply.status(429).send({ error: "Too many login attempts. Try again later." });
  }

  const user = await store.getUserByEmail(email);

  if (!user) {
    recordFailedLogin(request.ip || "unknown", email);
    return reply.status(401).send({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    recordFailedLogin(request.ip || "unknown", email);
    return reply.status(401).send({ error: "Invalid email or password" });
  }

  clearFailedLogin(request.ip || "unknown", email);

  const workspace = (await store.getUserDefaultWorkspace(user.id)) || (await store.listUserWorkspaces(user.id))[0] || null;
  if (!workspace) {
    return reply.status(400).send({ error: "User has no workspace" });
  }

  await store.logAudit({
    workspaceId: workspace.id,
    actorUserId: user.id,
    action: "auth.login",
    targetType: "user",
    targetId: user.id,
    details: { ip: request.ip || "unknown" },
  });

  const tokens = issueAuthTokens(user, workspace);
  return {
    ...tokens,
    user: { id: user.id, email: user.email, name: user.name, role: user.role || "user", createdAt: user.createdAt },
    workspace: { id: workspace.id, role: workspace.role, name: workspace.name },
  };
});

app.post("/v1/auth/refresh", async (request, reply) => {
  const body = request.body || {};
  const refreshToken = getRefreshTokenFromBody(body);
  if (!refreshToken) {
    return reply.status(400).send({ error: "Refresh token is required" });
  }

  const payload = verifyJwtToken(refreshToken);
  if (!payload?.sub || payload?.type !== "refresh") {
    return reply.status(401).send({ error: "Invalid refresh token" });
  }

  const user = await store.getUserById(String(payload.sub));
  if (!user) {
    return reply.status(401).send({ error: "Invalid refresh token" });
  }

  if (Number(payload.tokenVersion || 0) !== Number(user.tokenVersion || 1)) {
    return reply.status(401).send({ error: "Refresh token expired" });
  }

  const workspaceId = payload.workspaceId ? String(payload.workspaceId) : user.defaultWorkspaceId;
  const workspace = workspaceId ? await store.getWorkspaceMembership(user.id, workspaceId) : null;
  const activeWorkspace = workspace
    ? { id: workspace.workspaceId, role: workspace.role, name: "Workspace" }
    : (await store.getUserDefaultWorkspace(user.id));
  if (!activeWorkspace) {
    return reply.status(401).send({ error: "Workspace access missing" });
  }

  const tokens = issueAuthTokens(user, activeWorkspace);
  return {
    ...tokens,
    user: { id: user.id, email: user.email, name: user.name, role: user.role || "user", createdAt: user.createdAt },
    workspace: { id: activeWorkspace.id, role: activeWorkspace.role, name: activeWorkspace.name },
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

  const workspace = await store.getUserDefaultWorkspace(request.authUserId);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "user",
      createdAt: user.createdAt,
    },
    workspace: workspace ? { id: workspace.id, role: workspace.role, name: workspace.name } : null,
  };
});

app.get("/v1/workspaces", async (request, reply) => {
  if (!request.authUserId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const items = await store.listUserWorkspaces(request.authUserId);
  return items;
});

app.post("/v1/workspaces", async (request, reply) => {
  if (!request.authUserId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const body = request.body || {};
  const name = String(body.name || "Workspace").trim();
  const workspace = await store.createWorkspace({ name, ownerUserId: request.authUserId });
  await store.logAudit({
    workspaceId: workspace.id,
    actorUserId: request.authUserId,
    action: "workspace.create",
    targetType: "workspace",
    targetId: workspace.id,
    details: { name },
  });

  return workspace;
});

app.post("/v1/workspaces/switch", async (request, reply) => {
  if (!request.authUserId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const workspaceId = String((request.body || {}).workspaceId || "").trim();
  if (!workspaceId) {
    return reply.status(400).send({ error: "workspaceId is required" });
  }

  const member = await store.getWorkspaceMembership(request.authUserId, workspaceId);
  if (!member) {
    return reply.status(403).send({ error: "No access to workspace" });
  }

  await store.setUserDefaultWorkspace(request.authUserId, workspaceId);
  const user = await store.getUserById(request.authUserId);
  const workspace = await store.getUserDefaultWorkspace(request.authUserId);
  const tokens = issueAuthTokens(user, workspace);

  await store.logAudit({
    workspaceId,
    actorUserId: request.authUserId,
    action: "workspace.switch",
    targetType: "workspace",
    targetId: workspaceId,
    details: {},
  });

  return {
    ...tokens,
    workspace: { id: workspace.id, role: workspace.role, name: workspace.name },
  };
});

app.get("/v1/workspaces/usage", async (request, reply) => {
  const ctx = await ensureWorkspaceContext(request);
  if (!ctx) {
    return reply.status(400).send({ error: "Workspace context is missing" });
  }

  const usage = await store.getUsage(ctx.id);
  return usage;
});

app.get("/v1/workspaces/audit", async (request, reply) => {
  if (!(await ensureWorkspaceAdminOrSystemAdmin(request, reply))) {
    return;
  }

  const ctx = await ensureWorkspaceContext(request);
  if (!ctx) {
    return reply.status(400).send({ error: "Workspace context is missing" });
  }

  const requestUrl = new URL(request.url, "http://localhost");
  const limit = Number(requestUrl.searchParams.get("limit") || 50);
  const logs = await store.listAudit(ctx.id, limit);
  return logs;
});

app.post("/v1/auth/logout-all", async (request, reply) => {
  if (!request.authUserId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const user = await store.bumpUserTokenVersion(request.authUserId);
  if (!user) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  return { ok: true };
});

app.get("/v1/characters", async () => store.listCharacters());

app.get("/v1/characters/:characterId", async (request, reply) => {
  const character = await store.getCharacter(request.params.characterId);
  if (!character) {
    return reply.status(404).send({ error: "Character not found" });
  }
  return character;
});

app.get("/v1/characters/:characterId/config", async (request, reply) => {
  const character = await store.getCharacter(request.params.characterId);
  if (!character) {
    return reply.status(404).send({ error: "Character not found" });
  }

  return {
    id: character.id,
    tone: character.tone,
    opening: character.opening,
    systemPrompt: character.systemPrompt || "",
    behavior: character.behavior,
  };
});

app.patch("/v1/characters/:characterId/config", async (request, reply) => {
  if (!(await ensureWorkspaceAdminOrSystemAdmin(request, reply))) {
    return;
  }

  const patch = request.body || {};
  const updated = await store.updateCharacterConfig(request.params.characterId, patch);
  if (!updated) {
    return reply.status(404).send({ error: "Character not found" });
  }

  const ctx = await ensureWorkspaceContext(request);
  if (ctx) {
    await store.logAudit({
      workspaceId: ctx.id,
      actorUserId: request.authUserId,
      action: "character.config.update",
      targetType: "character",
      targetId: request.params.characterId,
      details: { fields: Object.keys(patch || {}) },
    });
  }

  return updated;
});

app.get("/v1/characters/:characterId/memories", async (request, reply) => {
  if (!(await ensureWorkspaceAdminOrSystemAdmin(request, reply))) {
    return;
  }

  const characterId = request.params.characterId;
  if (!(await store.hasCharacter(characterId))) {
    return reply.status(404).send({ error: "Character not found" });
  }

  const requestUrl = new URL(request.url, "http://localhost");
  const limit = Number(requestUrl.searchParams.get("limit") || 10);
  const includeExpired = requestUrl.searchParams.get("includeExpired") === "true";
  const memoriesList = await store.listCharacterMemories(characterId, limit, { includeExpired });
  return memoriesList;
});

app.post("/v1/characters/:characterId/memories", async (request, reply) => {
  if (!(await ensureWorkspaceAdminOrSystemAdmin(request, reply))) {
    return;
  }

  const characterId = request.params.characterId;
  if (!(await store.hasCharacter(characterId))) {
    return reply.status(404).send({ error: "Character not found" });
  }

  const body = request.body || {};
  const content = String(body.content || "").trim();
  if (!content) {
    return reply.status(400).send({ error: "Memory content is required" });
  }

  const memory = await store.addMemory({
    id: randomUUID(),
    characterId,
    sessionId: body.sessionId || null,
    content,
    priority: body.priority,
    pinned: Boolean(body.pinned),
    expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
    createdAt: new Date().toISOString(),
  });

  const ctx = await ensureWorkspaceContext(request);
  if (ctx) {
    await store.logAudit({
      workspaceId: ctx.id,
      actorUserId: request.authUserId,
      action: "memory.create",
      targetType: "memory",
      targetId: memory.id,
      details: { characterId },
    });
  }

  return memory;
});

app.patch("/v1/characters/:characterId/memories/:memoryId", async (request, reply) => {
  if (!(await ensureWorkspaceAdminOrSystemAdmin(request, reply))) {
    return;
  }

  const characterId = request.params.characterId;
  if (!(await store.hasCharacter(characterId))) {
    return reply.status(404).send({ error: "Character not found" });
  }

  const body = request.body || {};
  const updated = await store.updateMemory(request.params.memoryId, {
    content: body.content,
    priority: body.priority,
    pinned: body.pinned,
    expiresAt: body.expiresAt,
  });

  if (!updated || updated.characterId !== characterId) {
    return reply.status(404).send({ error: "Memory not found" });
  }

  const ctx = await ensureWorkspaceContext(request);
  if (ctx) {
    await store.logAudit({
      workspaceId: ctx.id,
      actorUserId: request.authUserId,
      action: "memory.update",
      targetType: "memory",
      targetId: updated.id,
      details: { fields: Object.keys(body || {}) },
    });
  }

  return updated;
});

app.delete("/v1/characters/:characterId/memories/:memoryId", async (request, reply) => {
  if (!(await ensureWorkspaceAdminOrSystemAdmin(request, reply))) {
    return;
  }

  const characterId = request.params.characterId;
  if (!(await store.hasCharacter(characterId))) {
    return reply.status(404).send({ error: "Character not found" });
  }

  const removed = await store.deleteMemory(request.params.memoryId);
  if (!removed) {
    return reply.status(404).send({ error: "Memory not found" });
  }

  const ctx = await ensureWorkspaceContext(request);
  if (ctx) {
    await store.logAudit({
      workspaceId: ctx.id,
      actorUserId: request.authUserId,
      action: "memory.delete",
      targetType: "memory",
      targetId: request.params.memoryId,
      details: {},
    });
  }

  return { ok: true };
});

app.delete("/v1/characters/:characterId/memories", async (request, reply) => {
  if (!(await ensureWorkspaceAdminOrSystemAdmin(request, reply))) {
    return;
  }

  const characterId = request.params.characterId;
  if (!(await store.hasCharacter(characterId))) {
    return reply.status(404).send({ error: "Character not found" });
  }

  const removed = await store.clearCharacterMemories(characterId);
  return { removed };
});

app.get("/v1/characters/:characterId/knowledge", async (request, reply) => {
  if (!(await ensureWorkspaceAdminOrSystemAdmin(request, reply))) {
    return;
  }

  const characterId = request.params.characterId;
  if (!(await store.hasCharacter(characterId))) {
    return reply.status(404).send({ error: "Character not found" });
  }

  return store.listKnowledgeDocuments(characterId);
});

app.post("/v1/characters/:characterId/knowledge", async (request, reply) => {
  if (!(await ensureWorkspaceAdminOrSystemAdmin(request, reply))) {
    return;
  }

  const characterId = request.params.characterId;
  if (!(await store.hasCharacter(characterId))) {
    return reply.status(404).send({ error: "Character not found" });
  }

  const part = await request.file();
  if (!part) {
    return reply.status(400).send({ error: "Document file is required" });
  }

  const buffers = [];
  for await (const chunk of part.file) {
    buffers.push(chunk);
  }
  const textContent = Buffer.concat(buffers).toString("utf8").trim();
  if (!textContent) {
    return reply.status(400).send({ error: "Document is empty or unsupported" });
  }

  const title = String(part.fields?.title?.value || part.filename || "Knowledge Document");
  const created = await store.addKnowledgeDocument({ characterId, title, content: textContent });

  const ctx = await ensureWorkspaceContext(request);
  if (ctx) {
    await store.logAudit({
      workspaceId: ctx.id,
      actorUserId: request.authUserId,
      action: "knowledge.upload",
      targetType: "knowledge_document",
      targetId: created.id,
      details: { characterId, title, chunkCount: created.chunkCount || 0 },
    });
  }

  return created;
});

app.delete("/v1/characters/:characterId/knowledge/:documentId", async (request, reply) => {
  if (!(await ensureWorkspaceAdminOrSystemAdmin(request, reply))) {
    return;
  }

  const characterId = request.params.characterId;
  if (!(await store.hasCharacter(characterId))) {
    return reply.status(404).send({ error: "Character not found" });
  }

  const removed = await store.deleteKnowledgeDocument(request.params.documentId);
  if (!removed) {
    return reply.status(404).send({ error: "Document not found" });
  }

  const ctx = await ensureWorkspaceContext(request);
  if (ctx) {
    await store.logAudit({
      workspaceId: ctx.id,
      actorUserId: request.authUserId,
      action: "knowledge.delete",
      targetType: "knowledge_document",
      targetId: request.params.documentId,
      details: { characterId },
    });
  }

  return { ok: true };
});

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
  const usageGate = await ensureUsageWithinLimit(request, "messages", 1);
  if (!usageGate.ok) {
    return reply.status(usageGate.status).send({ error: usageGate.error });
  }

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
  const longTermMemories = await store.listCharacterMemories(session.characterId, 6, { includeExpired: false });
  const knowledgeContext = await store.searchKnowledgeChunks(session.characterId, body.text, 5);
  const replyText = await createReply(session.characterId, body.text, history, longTermMemories, knowledgeContext);
  const npcMessage = {
    id: randomUUID(),
    sessionId: session.id,
    role: "npc",
    content: replyText,
    createdAt: new Date().toISOString(),
  };
  await store.pushMessage(npcMessage);

  const memoryContent = buildMemoryCandidate(body.text, npcMessage.content);
  if (memoryContent) {
    await store.addMemory({
      id: randomUUID(),
      characterId: session.characterId,
      sessionId: session.id,
      content: memoryContent,
      priority: "normal",
      pinned: false,
      expiresAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  await store.incrementUsage(usageGate.workspaceId, "messages", 1);

  return npcMessage;
});

app.get("/v1/realtime", { websocket: true }, (connection, request) => {
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

      const usageGate = await ensureUsageWithinLimit(request, "messages", 1);
      if (!usageGate.ok) {
        connection.send(JSON.stringify({ type: "error", message: usageGate.error }));
        return;
      }

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
      const longTermMemories = await store.listCharacterMemories(session.characterId, 6, { includeExpired: false });
      const knowledgeContext = await store.searchKnowledgeChunks(session.characterId, incomingText, 5);
      const replyText = await createReply(session.characterId, incomingText, history, longTermMemories, knowledgeContext);
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

      const memoryContent = buildMemoryCandidate(incomingText, npcMessage.content);
      if (memoryContent) {
        await store.addMemory({
          id: randomUUID(),
          characterId: session.characterId,
          sessionId: session.id,
          content: memoryContent,
          priority: "normal",
          pinned: false,
          expiresAt: null,
          createdAt: new Date().toISOString(),
        });
      }

      await store.incrementUsage(usageGate.workspaceId, "messages", 1);

      connection.send(JSON.stringify({ type: "final", message: npcMessage }));
    } catch {
      connection.send(JSON.stringify({ type: "error", message: "Invalid payload" }));
    }
  });
});

await store.init();
await ensureAdminUser();

app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`API listening on :${port} (${store.mode})`);
});
