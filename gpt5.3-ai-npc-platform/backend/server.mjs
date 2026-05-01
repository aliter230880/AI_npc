import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";

const app = Fastify({ logger: false });
const port = process.env.PORT || 8787;
const openAiKey = process.env.OPENAI_API_KEY || "";

let openai = null;
if (openAiKey && openAiKey !== "sk-your-key-here") {
  openai = new OpenAI({ apiKey: openAiKey });
}

await app.register(cors, { origin: true });
await app.register(websocket);

const characters = [
  { id: "mara", name: "Mara Archivist", role: "Lore Guide", tone: "Calm", 
    systemPrompt: "You are Mara Archivist, a lore guide. Speak calmly." },
  { id: "rook", name: "Captain Rook", role: "Commander", tone: "Direct",
    systemPrompt: "You are Captain Rook, a squad commander. Be direct." },
  { id: "vexa", name: "Vexa Vale", role: "Merchant", tone: "Friendly",
    systemPrompt: "You are Vexa Vale, a friendly merchant." }
];

const sessions = new Map();
const messages = new Map();

async function generateResponse(character, userText, history) {
  if (!openai) {
    return `[${character.name}]: Привет! Я ${character.role}. (Настройте OPENAI_API_KEY для AI ответов)`;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: character.systemPrompt },
        ...history.slice(-5).map(m => ({ role: m.role === "npc" ? "assistant" : m.role, content: m.content })),
        { role: "user", content: userText }
      ],
      temperature: 0.7,
      max_tokens: 300
    });
    return completion.choices[0].message.content;
  } catch (e) {
    return `[${character.name}]: Ошибка AI: ${e.message}`;
  }
}

app.get("/health", async () => ({ status: "ok", llm: openai ? "ready" : "demo-mode", updated: new Date().toISOString() }));
app.get("/v1/characters", async () => characters);

app.post("/v1/sessions", async (req) => {
  const { characterId } = req.body || {};
  const session = { id: randomUUID(), characterId, createdAt: new Date().toISOString() };
  sessions.set(session.id, session);
  messages.set(session.id, []);
  return session;
});

app.post("/v1/messages", async (req) => {
  const { sessionId, text } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) return { error: "Session not found" };
  
  const character = characters.find(c => c.id === session.characterId);
  const history = messages.get(sessionId) || [];
  const reply = await generateResponse(character, text, history);
  
  const msg = { id: randomUUID(), sessionId, role: "npc", content: reply, createdAt: new Date().toISOString() };
  const msgs = messages.get(sessionId) || [];
  msgs.push(msg);
  messages.set(sessionId, msgs);
  return msg;
});

app.get("/v1/realtime", { websocket: true }, (conn) => {
  conn.send(JSON.stringify({ type: "ready", message: "Connected" }));
  conn.on("message", async (raw) => {
    try {
      const payload = JSON.parse(String(raw));
      const session = sessions.get(payload.sessionId);
      if (!session) {
        conn.send(JSON.stringify({ type: "error", message: "Session not found" }));
        return;
      }
      const character = characters.find(c => c.id === session.characterId);
      const history = messages.get(session.id) || [];
      const reply = await generateResponse(character, payload.text || "", history);
      
      conn.send(JSON.stringify({ type: "transcript", source: "user", text: payload.text }));
      conn.send(JSON.stringify({ type: "chunk", text: reply }));
      conn.send(JSON.stringify({ type: "final", message: { content: reply } }));
    } catch {
      conn.send(JSON.stringify({ type: "error", message: "Invalid payload" }));
    }
  });
});

app.listen({ port, host: "0.0.0.0" }, () => {
  console.log(`🚀 AI_NPC API: http://localhost:${port}`);
  console.log(`📡 LLM: ${openai ? "✅ OpenAI Ready" : "⚠️ Demo Mode"}`);
});
