import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { Character } from "@/lib/types";
import { Search, MessageCircle, Globe, Lock, Sparkles, ArrowRight } from "lucide-react";
import { Tilt } from "@/components/Tilt";

function CharCard({ c }: { c: Character }) {
  const initials = c.name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return (
    <Tilt max={5}>
      <Link
        to={`/chat/${c.id}`}
        className="card-hover rounded-2xl p-5 group flex flex-col h-full"
      >
        <div className="flex items-start gap-3">
          <div className="relative size-14 rounded-2xl bg-gradient-to-br from-violet-500/30 via-indigo-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center text-lg font-semibold shrink-0">
            {initials || "?"}
            {c.is_public && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 border-2 border-[var(--color-bg-2)]" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className="font-semibold truncate">{c.name}</div>
              {c.is_public ? <Globe className="size-3.5 text-white/40 shrink-0" /> : <Lock className="size-3.5 text-white/40 shrink-0" />}
            </div>
            <div className="text-[10px] text-white/40 uppercase tracking-[0.15em] mt-1">{c.language}</div>
          </div>
        </div>
        <p className="text-sm text-white/55 mt-4 line-clamp-3 leading-relaxed flex-1">{c.description || "No description yet."}</p>
        {c.tags && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 4).map((t) => (
              <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/55">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-5 flex items-center text-xs text-white/40 group-hover:text-violet-300 transition">
          <MessageCircle className="size-3.5 mr-1.5" />
          Start chatting
          <ArrowRight className="size-3.5 ml-auto group-hover:translate-x-0.5 transition" />
        </div>
      </Link>
    </Tilt>
  );
}

export default function Explore() {
  const [chars, setChars] = useState<Character[] | null>(null);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<string>("");

  useEffect(() => {
    apiFetch<Character[]>("/characters?limit=200").then(setChars).catch(() => setChars([]));
  }, []);

  const filtered = useMemo(() => {
    if (!chars) return [];
    return chars.filter((c) => {
      if (lang && c.language !== lang) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (!c.name.toLowerCase().includes(needle) && !c.description.toLowerCase().includes(needle) && !c.tags.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [chars, q, lang]);

  const allLangs = useMemo(() => {
    const s = new Set((chars || []).map((c) => c.language));
    return Array.from(s).sort();
  }, [chars]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="flex flex-wrap items-end gap-4 mb-10">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-violet-300/80 mb-2">Catalog</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight metallic">Explore</h1>
          <p className="text-white/50 mt-2">Public characters anyone can chat with.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input className="input pl-9 w-64" placeholder="Search by name, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-32" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">All langs</option>
            {allLangs.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
          <Link to="/builder" className="btn-primary"><Sparkles className="size-4" /> New</Link>
        </div>
      </div>

      {chars === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-hover rounded-2xl p-5 animate-pulse h-44" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-hover rounded-2xl p-10 text-center text-white/50">No characters match your filters yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => <CharCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}
