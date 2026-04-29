export type AuthUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

const AUTH_TOKEN_KEY = "ai_npc_auth_token";
const apiBase = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ?? "").trim();

function getBase() {
  return apiBase || "http://localhost:8787/v1";
}

type AuthResponse = {
  token: string;
  user: AuthUser;
};

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Auth error ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getStoredAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function registerAuth(email: string, password: string, name: string) {
  const payload = await authRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
  return payload.user;
}

export async function loginAuth(email: string, password: string) {
  const payload = await authRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
  return payload.user;
}

export async function getMeAuth() {
  const token = getStoredAuthToken();
  if (!token) {
    return null;
  }

  const response = await fetch(`${getBase()}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    clearAuthToken();
    return null;
  }

  const data = (await response.json()) as { user: AuthUser };
  return data.user;
}
