import {
  clearMockAuthStorage,
  getSession,
  loginMockUser,
  logoutMockUser,
  registerMockUser,
  type AuthUser,
} from "./authMock";

export type AuthMode = "mock" | "api";

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

type AuthResponse = {
  user: AuthUser;
  accessToken?: string;
  refreshToken?: string;
};

const ACCESS_TOKEN_KEY = "ai_npc_access_token";
const REFRESH_TOKEN_KEY = "ai_npc_refresh_token";

const AUTH_MODE: AuthMode = import.meta.env.VITE_AUTH_MODE === "api" ? "api" : "mock";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function getAuthMode() {
  return AUTH_MODE;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function isBackendAuthReady() {
  return AUTH_MODE === "api" && Boolean(API_BASE_URL.trim());
}

export async function restoreAuthUser(): Promise<AuthUser | null> {
  if (AUTH_MODE === "mock") {
    return getSession()?.user || null;
  }

  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken || !API_BASE_URL) {
    return null;
  }

  try {
    return await fetchMe(accessToken);
  } catch {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      clearApiTokens();
      return null;
    }

    try {
      const refreshed = await refreshApiSession(refreshToken);
      saveApiTokens({
        accessToken: refreshed.accessToken || accessToken,
        refreshToken: refreshed.refreshToken || refreshToken,
      });
      return refreshed.user;
    } catch {
      clearApiTokens();
      return null;
    }
  }
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  if (AUTH_MODE === "mock") {
    return registerMockUser(input).user;
  }

  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Ошибка регистрации"));
  }

  const parsed = parseAuthResponse(await response.json());
  if (parsed.accessToken && parsed.refreshToken) {
    saveApiTokens({ accessToken: parsed.accessToken, refreshToken: parsed.refreshToken });
    return parsed.user;
  }

  // Some backends return user only on register, so login immediately.
  return loginUser({ email: input.email, password: input.password });
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthUser> {
  if (AUTH_MODE === "mock") {
    return loginMockUser(input).user;
  }

  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Неверный email или пароль"));
  }

  const parsed = parseAuthResponse(await response.json());
  if (!parsed.accessToken || !parsed.refreshToken) {
    throw new Error("Сервер не вернул токены доступа");
  }

  saveApiTokens({
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
  });
  return parsed.user;
}

export async function logoutUser(): Promise<void> {
  if (AUTH_MODE === "mock") {
    logoutMockUser();
    return;
  }

  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (accessToken && API_BASE_URL) {
    try {
      await fetch(`${API_BASE_URL}/v1/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      // Even if logout request fails we still clear local tokens.
    }
  }
  clearApiTokens();
}

export function resetPreviewAuthData() {
  if (AUTH_MODE === "mock") {
    clearMockAuthStorage();
  }
  clearApiTokens();
}

async function refreshApiSession(refreshToken: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error("Session refresh failed");
  }

  return parseAuthResponse(await response.json());
}

async function fetchMe(accessToken: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Unauthorized");
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const user = extractUser(payload);
  if (!user) {
    throw new Error("Invalid profile payload");
  }

  return user;
}

function parseAuthResponse(payload: unknown): AuthResponse {
  const root = asObject(payload);
  const data = asObject(root?.data);
  const combined = { ...root, ...data };
  const user = extractUser(combined);

  if (!user) {
    throw new Error("Некорректный ответ сервера");
  }

  return {
    user,
    accessToken: readString(combined.accessToken) || readString(combined.token),
    refreshToken: readString(combined.refreshToken),
  };
}

function extractUser(payload: Record<string, unknown> | null): AuthUser | null {
  if (!payload) {
    return null;
  }

  const nestedUser = asObject(payload.user);
  const source = nestedUser || payload;
  const id = readString(source.id);
  const email = readString(source.email);
  if (!id || !email) {
    return null;
  }

  return {
    id,
    email,
    name: readString(source.name) || "User",
    createdAt: readString(source.createdAt) || new Date().toISOString(),
  };
}

function saveApiTokens(tokens: Tokens) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

function clearApiTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    const message = readString(payload.message) || readString(payload.error);
    return message || fallback;
  } catch {
    return fallback;
  }
}