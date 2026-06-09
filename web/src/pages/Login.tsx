import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { useApiError, useToast } from "@/lib/toast";
import type { TokenPair } from "@/lib/types";
import { Sparkles } from "lucide-react";

export default function Login({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const onError = useApiError();
  const { push } = useToast();

  const isRegister = mode === "register";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isRegister && !adult) return push("Please confirm you are 18+", "error");
    if (password.length < 8) return push("Password must be at least 8 characters", "error");
    setBusy(true);
    try {
      const path = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister ? { email, password, is_adult: true } : { email, password };
      const tok = await apiFetch<TokenPair>(path, { method: "POST", body: JSON.stringify(body), auth: false });
      setToken(tok.access_token, tok.refresh_token);
      push(isRegister ? "Welcome aboard" : "Logged in", "ok");
      navigate(next, { replace: true });
    } catch (e) { onError(e); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 relative">
      <div className="text-center mb-10">
        <Link to="/" className="inline-flex items-center gap-2 group">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-violet-400 via-indigo-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition pulse-glow">
            <Sparkles className="size-5 text-black" />
          </div>
        </Link>
        <h1 className="mt-6 text-3xl font-bold metallic">{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="text-white/50 mt-2 text-sm">
          {isRegister ? "Build characters, save your chats, and shape your worlds." : "Sign in to keep talking."}
        </p>
      </div>

      <form onSubmit={submit} className="card-hover rounded-2xl p-7 space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@domain.com" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </div>
        {isRegister && (
          <label className="flex items-start gap-2 text-sm text-white/70">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5" />
            <span>I am 18 years or older and accept the <a href="/legal/terms" className="text-violet-300 hover:underline">Terms</a> and <a href="/legal/content" className="text-violet-300 hover:underline">Content policy</a>.</span>
          </label>
        )}
        <button className="btn-primary w-full text-base py-3.5" disabled={busy}>
          {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="text-center mt-6 text-sm text-white/60">
        {isRegister ? (
          <>Already have an account? <Link to="/login" className="text-violet-300 hover:underline">Sign in</Link></>
        ) : (
          <>New here? <Link to="/register" className="text-violet-300 hover:underline">Create an account</Link></>
        )}
      </div>
    </div>
  );
}
