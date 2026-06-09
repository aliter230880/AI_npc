import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE, apiFetch, streamSSE } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { useApiError } from "@/lib/toast";
import type { Character, Conversation, Message } from "@/lib/types";
import { Send, Mic, Volume2, VolumeX, Pencil, ArrowLeft, Sparkles } from "lucide-react";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  emotion?: string | null;
  action?: string | null;
}

export default function Chat() {
  const { id } = useParams();
  const { me, loading } = useMe();
  const onError = useApiError();
  const [character, setCharacter] = useState<Character | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [tts, setTts] = useState<boolean>(() => localStorage.getItem("cp_tts") === "1");
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // загрузка персонажа + создание/открытие сессии
  useEffect(() => {
    if (!id) return;
    if (loading) return;

    let cancelled = false;
    (async () => {
      try {
        const c = await apiFetch<Character>(`/characters/${id}`);
        if (cancelled) return;
        setCharacter(c);
        const conv = await apiFetch<Conversation>("/chat/sessions", {
          method: "POST",
          body: JSON.stringify({ character_id: c.id }),
        });
        if (cancelled) return;
        setConversation(conv);
        const msgs = await apiFetch<Message[]>(`/chat/sessions/${conv.id}/messages`);
        if (cancelled) return;
        setMessages(msgs.map((m) => ({
          id: m.id,
          role: m.role as any,
          content: m.content,
          emotion: m.emotion,
          action: m.action,
        })));
      } catch (e) { onError(e); }
    })();

    return () => { cancelled = true; };
  }, [id, loading, me?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function browserSpeak(text: string) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    // дефолтный голос системы — лучше чем ничего
    const voices = window.speechSynthesis.getVoices() || [];
    const lang = character?.language === "zh" ? "zh-CN" : character?.language || "en";
    const v = voices.find((vv) => vv.lang.toLowerCase().startsWith(lang.toLowerCase()));
    if (v) { u.voice = v; u.lang = v.lang; }
    window.speechSynthesis.speak(u);
  }

  async function speak(text: string, emotion?: string | null) {
    if (!tts || !text) return;
    // Серверный TTS через /voice/tts (Edge + Piper fallback). Если не сработает — браузерный fallback.
    const voiceId = character?.voice_id || undefined;
    const lang = character?.language || "en";
    const params = new URLSearchParams({ text: text.slice(0, 2000) });
    if (voiceId) params.set("voice", voiceId);
    if (lang) params.set("language", lang);
    if (emotion) params.set("emotion", emotion);
    const url = `${API_BASE}/voice/tts?${params.toString()}`;
    try {
      // Останавливаем прошлое аудио если играет
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onerror = () => { browserSpeak(text); };
      await audio.play();
    } catch {
      browserSpeak(text);
    }
  }

  async function send(text: string) {
    if (!conversation || !text.trim() || sending) return;
    setInput("");
    setSending(true);
    setMessages((s) => [...s, { id: `u_${Date.now()}`, role: "user", content: text }]);
    const aiId = `a_${Date.now()}`;
    setMessages((s) => [...s, { id: aiId, role: "assistant", content: "", emotion: null, action: null }]);
    let collected = "";
    let emotion: string | null = null;
    try {
      for await (const piece of streamSSE(`/chat/sessions/${conversation.id}/stream`, { content: text })) {
        collected += piece;
        setMessages((s) => s.map((m) => (m.id === aiId ? { ...m, content: collected } : m)));
      }
      
      // После завершения стрима парсим JSON если есть
      if (collected) {
        try {
          const parsed = JSON.parse(collected);
          if (parsed.text && typeof parsed.text === "string") {
            setMessages((s) => s.map((m) => (m.id === aiId ? {
              ...m,
              content: parsed.text,
              emotion: parsed.emotion || null,
              action: parsed.action || null,
            } : m)));
            emotion = parsed.emotion;
            speak(parsed.text, emotion);
            return;
          }
        } catch {
          // Не JSON — обычный текст
        }
        speak(collected, emotion);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "stream error";
      setMessages((s) => s.map((m) => (m.id === aiId ? { ...m, content: `[error] ${msg}` } : m)));
    } finally { setSending(false); }
  }

  function toggleMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      onError(new Error("Voice input is only available in Chrome/Edge"));
      return;
    }
    if (recording) { recognitionRef.current?.stop(); return; }
    const r = new SR();
    const lang = (character?.language || "en").toLowerCase();
    r.lang = lang === "ru" ? "ru-RU" : lang === "es" ? "es-ES" : lang === "zh" ? "zh-CN" : "en-US";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setInput(finalText + interim);
    };
    r.onerror = (e: any) => onError(new Error(`Voice: ${e.error}`));
    r.onend = () => {
      setRecording(false);
      if (finalText.trim()) send(finalText);
    };
    recognitionRef.current = r;
    setRecording(true);
    r.start();
  }

  function toggleTts() {
    const next = !tts;
    setTts(next);
    localStorage.setItem("cp_tts", next ? "1" : "0");
    if (!next) window.speechSynthesis?.cancel();
  }

  if (!character) {
    return <div className="flex-1 flex items-center justify-center text-white/40">Loading…</div>;
  }

  const isOwner = me && character.owner_id === me.id;

  return (
    <div className="flex-1 flex flex-col">
      {/* Subheader */}
      <div className="border-b border-white/5 bg-black/30 backdrop-blur-2xl">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link to="/explore" className="btn-ghost px-2"><ArrowLeft className="size-4" /></Link>
          <div className="relative size-11 rounded-2xl bg-gradient-to-br from-violet-500/30 via-indigo-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center font-semibold shrink-0">
            {character.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 border-2 border-[var(--color-bg)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{character.name}</div>
            <div className="text-xs text-white/50 truncate flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/80">Online</span>
              <span className="text-white/30">·</span>
              <span className="truncate">{character.description || character.language.toUpperCase()}</span>
            </div>
          </div>
          <button onClick={toggleTts} className="btn-ghost px-2.5" title={tts ? "Voice replies on" : "Voice replies off"}>
            {tts ? <Volume2 className="size-4 text-violet-300" /> : <VolumeX className="size-4" />}
          </button>
          {isOwner && (
            <Link to={`/builder/${character.id}`} className="btn-ghost px-2.5" title="Edit"><Pencil className="size-4" /></Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-white/40 py-24">
              <Sparkles className="size-7 mx-auto mb-3 text-violet-300/70 float-y" />
              Say hi to start the conversation
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} reveal`}>
              <div className={
                m.role === "user"
                  ? "max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-tr-md px-4 py-2.5 text-sm bg-gradient-to-br from-violet-500/25 to-indigo-500/25 border border-violet-400/25 leading-relaxed whitespace-pre-wrap shadow-lg shadow-violet-500/5"
                  : "max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-tl-md px-4 py-2.5 text-sm glass leading-relaxed whitespace-pre-wrap"
              }>
                {m.role === "assistant" && (
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1.5">{character.name}</div>
                )}
                {/* Эмоция и действие */}
                {m.role === "assistant" && (m.emotion || m.action) && (
                  <div className="text-xs italic text-violet-300/80 mb-1">
                    {m.action && <span>*{m.action}*</span>}
                    {m.emotion && m.emotion !== "neutral" && (
                      <span className="ml-2 opacity-60">
                        {m.emotion === "happy" && "😊"}
                        {m.emotion === "sad" && "😢"}
                        {m.emotion === "angry" && "😠"}
                        {m.emotion === "surprised" && "😲"}
                        {m.emotion === "confused" && "😕"}
                        {m.emotion === "flirty" && "😏"}
                        {m.emotion === "scared" && "😨"}
                      </span>
                    )}
                  </div>
                )}
                {m.content || <span className="text-white/30">…</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compose */}
      <div className="border-t border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3 flex items-end gap-2">
          <button onClick={toggleMic} className={`size-11 rounded-full flex items-center justify-center transition shrink-0 ${recording ? "bg-pink-500/25 border border-pink-400/50 animate-pulse shadow-lg shadow-pink-500/30" : "glass hover:border-white/20"}`} title="Voice input">
            <Mic className={`size-4 ${recording ? "text-pink-300" : "text-white/70"}`} />
          </button>
          <textarea
            className="input min-h-[44px] max-h-40 resize-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Type a message…"
            disabled={sending}
            rows={1}
          />
          <button onClick={() => send(input)} disabled={sending || !input.trim()} className="btn-primary shrink-0 size-11 p-0 rounded-full">
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
