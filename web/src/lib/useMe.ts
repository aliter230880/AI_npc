import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "./api";
import { getToken } from "./auth";
import type { User } from "./types";

export function useMe() {
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!getToken()) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      const u = await apiFetch<User>("/auth/me");
      setMe(u);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const onChange = () => { setLoading(true); refresh(); };
    window.addEventListener("cp-auth-change", onChange);
    return () => window.removeEventListener("cp-auth-change", onChange);
  }, []);

  return { me, loading, refresh };
}
