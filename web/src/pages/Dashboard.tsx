import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { useApiError, useToast } from "@/lib/toast";
import type { Character } from "@/lib/types";
import { Plus, Pencil, Trash2, MessageCircle, Globe, Lock } from "lucide-react";

export default function Dashboard() {
  const { me, loading } = useMe();
  const [chars, setChars] = useState<Character[] | null>(null);
  const navigate = useNavigate();
  const onError = useApiError();
  const { push } = useToast();

  useEffect(() => {
    if (loading) return;
    if (!me) navigate("/login?next=/dashboard", { replace: true });
  }, [loading, me, navigate]);

  async function load() {
    try {
      const list = await apiFetch<Character[]>("/characters?only_mine=true&limit=200");
      setChars(list);
    } catch (e) { onError(e); }
  }

  useEffect(() => { if (me) load(); }, [me]);

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/characters/${id}`, { method: "DELETE" });
      setChars((s) => (s ?? []).filter((c) => c.id !== id));
      push(`Deleted "${name}"`, "ok");
    } catch (e) { onError(e); }
  }

  if (!me) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="flex flex-wrap items-end gap-4 mb-10">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 mb-2">Workspace</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight metallic">My characters</h1>
          <p className="text-white/50 mt-2">Build and manage your private and public characters.</p>
        </div>
        <Link to="/builder" className="btn-primary ml-auto"><Plus className="size-4" /> Create new</Link>
      </div>

      {chars === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card-hover rounded-2xl p-5 animate-pulse h-40" />)}
        </div>
      ) : chars.length === 0 ? (
        <div className="card-hover rounded-2xl p-12 text-center">
          <p className="text-white/60 mb-6">You haven't created any characters yet.</p>
          <Link to="/builder" className="btn-primary inline-flex"><Plus className="size-4" /> Create your first character</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chars.map((c) => (
            <div key={c.id} className="card-hover rounded-2xl p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="relative size-12 rounded-xl bg-gradient-to-br from-violet-500/30 via-indigo-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center font-semibold shrink-0">
                  {c.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="font-semibold truncate">{c.name}</div>
                    {c.is_public ? <Globe className="size-3.5 text-emerald-300" /> : <Lock className="size-3.5 text-white/40" />}
                  </div>
                  <div className="text-[10px] text-white/40 uppercase tracking-[0.15em] mt-1">{c.language}</div>
                </div>
              </div>
              <p className="text-sm text-white/55 mt-3 line-clamp-2 flex-1">{c.description || "No description"}</p>
              <div className="mt-5 flex items-center gap-1">
                <Link to={`/chat/${c.id}`} className="btn-ghost text-xs px-2.5 py-1.5"><MessageCircle className="size-3.5" /> Chat</Link>
                <Link to={`/builder/${c.id}`} className="btn-ghost text-xs px-2.5 py-1.5"><Pencil className="size-3.5" /> Edit</Link>
                <button onClick={() => remove(c.id, c.name)} className="btn-ghost text-xs px-2.5 py-1.5 text-pink-300 hover:bg-pink-500/10 ml-auto">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
