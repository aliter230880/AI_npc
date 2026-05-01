import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";

const app = Fastify({ logger: false });
const port = process.env.PORT || 8787;

await app.register(cors, { origin: true });

const characters = [
  { id: "mara", name: "Mara Archivist", role: "Lore Guide" },
  { id: "rook", name: "Captain Rook", role: "Commander" },
  { id: "vexa", name: "Vexa Vale", role: "Merchant" }
];

const sessions = new Map();

app.get("/health", async () => ({ status: "ok", updated: new Date().toISOString() }));
app.get("/v1/characters", async () => characters);

app.post("/v1/sessions", async (req) => {
  const { characterId } = req.body || {};
  const session = { id: randomUUID(), characterId, createdAt: new Date().toISOString() };
  sessions.set(session.id, session);
  return session;
});

app.post("/v1/messages", async (req) => {
  const { sessionId, text } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) return { error: "Session not found" };
  const character = characters.find(c => c.id === session.characterId);
  return { 
    id: randomUUID(), 
    sessionId, 
    role: "npc", 
    content: `[${character?.name}]: Привет! Я ${character?.role}.`,
    createdAt: new Date().toISOString()
  };
});

app.listen({ port, host: "0.0.0.0" }, () => {
  console.log(`🚀 AI_NPC API running on http://localhost:${port}`);
});
