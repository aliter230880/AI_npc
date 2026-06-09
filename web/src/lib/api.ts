// Тонкий fetch-обёртник вокруг нашего FastAPI.
// В dev: ходим через /api → vite-proxy → http://127.0.0.1:8000
// В prod: fetch'имся на тот же origin, бэкенд должен отдавать /info, /auth, /characters, /chat...

import { getToken, setToken } from "./auth";

// Все API-запросы идут через префикс /api.
// В dev этот префикс перехватывает Vite-proxy и шлёт на http://127.0.0.1:8000.
// В prod Caddy проксирует /api/* → 127.0.0.1:8001 (см. Caddyfile).
export const API_BASE = "/api";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type") && opts.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token && opts.auth !== false) headers.set("Authorization", `Bearer ${token}`);

  const r = await fetch(API_BASE + path, { ...opts, headers });
  if (!r.ok) {
    let detail: any = r.statusText;
    let body: any = null;
    try {
      body = await r.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      try { detail = await r.text(); } catch {}
    }
    if (r.status === 401) setToken(null);
    throw new ApiError(r.status, detail, body);
  }
  if (r.status === 204) return undefined as T;
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await r.json()) as T;
  return (await r.text()) as unknown as T;
}

// SSE-стрим. Возвращает async iterator текстовых дельт.
export async function* streamSSE(path: string, body: unknown): AsyncGenerator<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(API_BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new ApiError(resp.status, text || resp.statusText);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const p of parts) {
      const line = p.trim();
      if (!line.startsWith("data:")) continue;
      let data = line.slice(5);
      if (data.startsWith(" ")) data = data.slice(1);
      if (data === "[DONE]") return;
      yield data.replaceAll("\\n", "\n");
    }
  }
}
