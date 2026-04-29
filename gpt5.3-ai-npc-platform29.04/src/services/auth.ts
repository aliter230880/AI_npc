export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
};

export type AuthWorkspace = {
  id: string;
  role: string;
  name: string;
};

const AUTH_TOKEN_KEY = "ai_npc_auth_token";
const REFRESH_TOKEN_KEY = "ai_npc_refresh_token";
const apiBase = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ?? "").trim();

function getBase() {
  return apiBase || "http://localhost:8787/v1";
}

type AuthResponse = {
  token: string;
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  workspace?: AuthWorkspace | null;
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

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || "";
}

function setStoredTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function registerAuth(email: string, password: string, name: string) {
  const payload = await authRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  setStoredTokens(payload.accessToken || payload.token, payload.refreshToken);
  return payload.user;
}

export async function loginAuth(email: string, password: string) {
  const payload = await authRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setStoredTokens(payload.accessToken || payload.token, payload.refreshToken);
  return payload.user;
}

export async function refreshAuthSession() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearAuthToken();
    return null;
  }

  try {
    const payload = await authRequest<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });

    setStoredTokens(payload.accessToken || payload.token, payload.refreshToken);
    return payload.user;
  } catch {
    clearAuthToken();
    return null;
  }
}

export async function logoutAllSessions() {
  const token = getStoredAuthToken();
  if (!token) {
    return false;
  }

  const response = await fetch(`${getBase()}/auth/logout-all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  clearAuthToken();
  return response.ok;
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
    const refreshed = await refreshAuthSession();
    if (!refreshed) {
      clearAuthToken();
      return null;
    }

    const retry = await fetch(`${getBase()}/auth/me`, {
      headers: {
        Authorization: `Bearer ${getStoredAuthToken()}`,
      },
    });

    if (!retry.ok) {
      clearAuthToken();
      return null;
    }

    const retryData = (await retry.json()) as { user: AuthUser };
    return retryData.user;
  }

  const data = (await response.json()) as { user: AuthUser };
  return data.user;
}
