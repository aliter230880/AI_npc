// Простое хранилище JWT в localStorage + событие "cp-auth-change" для подписчиков.

const TOKEN_KEY = "cp_token";
const REFRESH_KEY = "cp_refresh";

export function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setToken(token: string | null, refresh?: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (refresh !== undefined) {
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    else localStorage.removeItem(REFRESH_KEY);
  }
  window.dispatchEvent(new Event("cp-auth-change"));
}

export function getRefresh(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
}
