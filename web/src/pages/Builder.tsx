import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE, apiFetch } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { useApiError, useToast } from "@/lib/toast";
import type { Character, Voice } from "@/lib/types";
import { Save, Sparkles, Eye, Volume2 } from "lucide-react";

const EMPTY = {
  name: "",
  description: "",
  avatar_url: "",
  system_prompt: "",
  backstory: "",
  personality_traits: "",
  greeting: "",
  model: "",
  temperature: 0.8,
  language: "en",
  voice_provider: "",
  voice_id: "",
  is_public: false,
  nsfw: false,
  tags: "",
};

export default function Builder() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const { me, loading } = useMe();
  const onError = useApiError();
  const { push } = useToast();

  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editing);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    apiFetch<Voice[]>("/voice/voices").then(setVoices).catch(() => {});
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!me) navigate(`/login?next=/builder${id ? `/${id}` : ""}`, { replace: true });
  }, [loading, me, id, navigate]);

  useEffect(() => {
    if (!editing || !me) return;
    apiFetch<Character>(`/characters/${id}`)
      .then((c) => {
        setForm({
          name: c.name,
          description: c.description,
          avatar_url: c.avatar_url || "",
          system_prompt: c.system_prompt,
          backstory: c.backstory,
          personality_traits: c.personality_traits,
          greeting: c.greeting,
          model: c.model || "",
          temperature: c.temperature,
          language: c.language,
          voice_provider: c.voice_provider || "",
          voice_id: c.voice_id || "",
          is_public: c.is_public,
          nsfw: c.nsfw,
          tags: c.tags,
        });
        setLoaded(true);
      })
      .catch((e) => { onError(e); navigate("/dashboard"); });
  }, [editing, id, me]);

  function update<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function previewVoice() {
    if (!form.voice_id) return;
    setPreviewing(true);
    try {
      // Определяем пол по voice_id (female/male в названии)
      const isFemale = form.voice_id.includes('female');
      
      const sample = form.language === "ru"
        ? (isFemale 
            ? "Привет! Вот так звучит мой голос. Рада знакомству." 
            : "Привет! Вот так звучит мой голос. Рад знакомству.")
        : "Hello there. This is how my voice sounds. Nice to meet you.";
      const params = new URLSearchParams({ text: sample, voice: form.voice_id });
      const audio = new Audio(`${API_BASE}/voice/tts?${params.toString()}`);
      await audio.play();
      audio.onended = () => setPreviewing(false);
      audio.onerror = () => { setPreviewing(false); push("Voice preview failed", "error"); };
    } catch (e) {
      onError(e);
      setPreviewing(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return push("Name is required", "error");
    setBusy(true);
    try {
      if (editing) {
        const c = await apiFetch<Character>(`/characters/${id}`, { method: "PATCH", body: JSON.stringify(form) });
        push(`Saved "${c.name}"`, "ok");
        navigate(`/chat/${c.id}`);
      } else {
        const c = await apiFetch<Character>("/characters", { method: "POST", body: JSON.stringify(form) });
        push(`Created "${c.name}"`, "ok");
        navigate(`/chat/${c.id}`);
      }
    } catch (e) { onError(e); }
    finally { setBusy(false); }
  }

  async function deleteChar() {
    if (!editing || !id) return;
    if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/characters/${id}`, { method: "DELETE" });
      push(`Deleted "${form.name}"`, "ok");
      navigate("/dashboard");
    } catch (e) { onError(e); }
    finally { setBusy(false); }
  }

  if (!me || !loaded) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <div className="flex items-end gap-4 mb-10">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-pink-300/80 mb-2">Forge</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight metallic">{editing ? "Edit character" : "Create a character"}</h1>
          <p className="text-white/50 mt-2">Shape personality, backstory, and voice.</p>
        </div>
      </div>

      <form onSubmit={save} className="grid lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-hover rounded-2xl p-6 space-y-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" required maxLength={120} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Marcus the Pirate Captain" />
            </div>
            <div>
              <label className="label">Short description</label>
              <input className="input" maxLength={500} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="One-line summary shown in lists" />
            </div>
            <div>
              <label className="label">First message (greeting)</label>
              <textarea className="input min-h-[80px]" maxLength={2000} value={form.greeting} onChange={(e) => update("greeting", e.target.value)} placeholder="Hello, traveler. Pull up a chair." />
            </div>
          </div>

          <div className="card-hover rounded-2xl p-6 space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-violet-300/80">Personality</h3>
            <div>
              <label className="label">System prompt — the core of who they are</label>
              <textarea
                className="input min-h-[160px] font-mono text-xs leading-relaxed"
                maxLength={4000}
                value={form.system_prompt}
                onChange={(e) => update("system_prompt", e.target.value)}
                placeholder="You are a salty 18th-century pirate captain. You speak in nautical slang. Loyal to your crew, deeply suspicious of authority. You never break character..."
              />
            </div>
            <div>
              <label className="label">Backstory (kept in every message)</label>
              <textarea
                className="input min-h-[100px]"
                maxLength={4000}
                value={form.backstory}
                onChange={(e) => update("backstory", e.target.value)}
                placeholder="Born in Tortuga. Lost a leg to a shark off Madagascar..."
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Personality traits</label>
                <input className="input" maxLength={300} value={form.personality_traits} onChange={(e) => update("personality_traits", e.target.value)} placeholder="bold, sarcastic, loyal" />
              </div>
              <div>
                <label className="label">Tags</label>
                <input className="input" maxLength={300} value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="pirate, adventure, roleplay" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card-hover rounded-2xl p-6 space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/80">Settings</h3>
            <div>
              <label className="label">Language</label>
              <select className="input" value={form.language} onChange={(e) => update("language", e.target.value)}>
                <option value="en">English</option>
                <option value="ru">Русский</option>
                <option value="es">Español</option>
                <option value="zh">中文</option>
              </select>
            </div>
            <div>
              <label className="label">Temperature: <span className="text-violet-300">{form.temperature.toFixed(1)}</span></label>
              <input type="range" min={0} max={2} step={0.1} className="w-full accent-violet-400" value={form.temperature} onChange={(e) => update("temperature", parseFloat(e.target.value))} />
              <div className="flex justify-between text-[10px] text-white/40 mt-1"><span>focused</span><span>creative</span></div>
            </div>
            <div>
              <label className="label">Model (blank = default)</label>
              <input className="input" value={form.model} onChange={(e) => update("model", e.target.value)} placeholder="openai/gpt-oss-120b:free" />
            </div>
            <div>
              <label className="label">Avatar URL</label>
              <input className="input" value={form.avatar_url} onChange={(e) => update("avatar_url", e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div className="card-hover rounded-2xl p-6 space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">Voice</h3>
            <div>
              <label className="label">Server voice</label>
              <select
                className="input"
                value={form.voice_id}
                onChange={(e) => {
                  const vid = e.target.value;
                  const provider = vid.startsWith("google_") ? "google" : vid.startsWith("edge_") ? "edge" : "piper";
                  setForm((s) => ({ ...s, voice_id: vid, voice_provider: vid ? provider : "" }));
                }}
              >
                <option value="">Browser voice (default)</option>
                
                {/* Google TTS — премиум, 1 млн/мес бесплатно */}
                <optgroup label="🌟 Google Cloud TTS (premium, 1M chars/month free)">
                  {voices.filter((v) => v.id.startsWith("google_")).map((v) => {
                    const lang = v.language === "en" ? "English" : v.language === "ru" ? "Русский" : v.language;
                    const genderLabel = v.gender === "male" ? "♂" : "♀";
                    return (
                      <option key={v.id} value={v.id}>
                        {genderLabel} {v.name} — {lang}
                      </option>
                    );
                  })}
                </optgroup>
                
                {/* Edge TTS — хорошее качество, бесплатно, но может быть заблокирован */}
                {voices.some((v) => v.id.startsWith("edge_")) && (
                  <optgroup label="🎙️ Edge TTS (good quality, free, may be blocked in some regions)">
                    {voices.filter((v) => v.id.startsWith("edge_")).map((v) => {
                      const lang = v.language === "en" ? "English" : v.language === "ru" ? "Русский" : v.language;
                      const genderLabel = v.gender === "male" ? "♂" : "♀";
                      return (
                        <option key={v.id} value={v.id}>
                          {genderLabel} {v.name.replace(" (Edge)", "")} — {lang}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                
                {/* Piper — локальный fallback */}
                {voices.some((v) => !v.id.startsWith("google_") && !v.id.startsWith("edge_")) && (
                  <optgroup label="🔧 Piper (local fallback, basic quality)">
                    {voices.filter((v) => !v.id.startsWith("google_") && !v.id.startsWith("edge_")).map((v) => {
                      const styleLabel = v.style === "cheerful"
                        ? (v.language === "ru" ? "весёлый" : "cheerful")
                        : (v.language === "ru" ? "спокойный" : "calm");
                      const genderLabel = v.language === "ru"
                        ? (v.gender === "male" ? "♂" : "♀")
                        : (v.gender === "male" ? "♂" : "♀");
                      return (
                        <option key={v.id} value={v.id}>
                          {genderLabel} {v.name.replace(" (Piper fallback)", "")} — {styleLabel}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            </div>
            <button
              type="button"
              className="btn-secondary w-full"
              disabled={!form.voice_id || previewing}
              onClick={previewVoice}
            >
              <Volume2 className="size-4" /> {previewing ? "Synthesizing…" : "Preview voice"}
            </button>
            <p className="text-xs text-white/40 leading-relaxed">
              Google TTS: Premium Neural2/WaveNet voices, 1 million characters/month free. Highest quality and reliability. Edge TTS: Good quality but may be blocked in some regions. Piper: Local fallback with basic quality.
            </p>
          </div>

          <div className="card-hover rounded-2xl p-6 space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-pink-300/80">Visibility</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_public} onChange={(e) => update("is_public", e.target.checked)} />
              Public — anyone can chat (read-only)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.nsfw} onChange={(e) => update("nsfw", e.target.checked)} />
              NSFW — mark as adult content
            </label>
          </div>

          <button className="btn-primary w-full text-base py-3.5" disabled={busy}>
            {busy ? "Saving…" : (
              <>
                {editing ? <Save className="size-4" /> : <Sparkles className="size-4" />}
                {editing ? "Save changes" : "Create & chat"}
              </>
            )}
          </button>
          {editing && (
            <>
              <button type="button" className="btn-secondary w-full" onClick={() => navigate(`/chat/${id}`)}>
                <Eye className="size-4" /> Open chat
              </button>
              <button type="button" className="btn-ghost w-full text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40" onClick={deleteChar} disabled={busy}>
                🗑️ Delete character
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
