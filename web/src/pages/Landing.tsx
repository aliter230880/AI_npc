import { Link } from "react-router-dom";
import {
  ArrowRight, Sparkles, Mic, Brain, BookOpen, Code2, Zap, Shield,
  Globe, MessageSquare, Gamepad2, Smartphone, Glasses, Cpu, Rocket, Layers,
  Network, Eye, Languages, Users, ChevronDown, Play
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Character, SystemInfo } from "@/lib/types";
import { Tilt } from "@/components/Tilt";

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-3xl sm:text-5xl font-bold metallic">{v}</div>
      <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/40 mt-2">{k}</div>
    </div>
  );
}

function FeatureTile({ icon, title, text, accent }: { icon: React.ReactNode; title: string; text: string; accent: string }) {
  return (
    <Tilt className="card-hover rounded-2xl p-6 group">
      <div className={`size-11 rounded-xl border flex items-center justify-center mb-4 ${accent}`}>{icon}</div>
      <h3 className="font-semibold mb-1.5 text-[15px]">{title}</h3>
      <p className="text-sm text-white/55 leading-relaxed">{text}</p>
    </Tilt>
  );
}

function ChannelCard({ icon, label, idx }: { icon: React.ReactNode; label: string; idx: string }) {
  return (
    <Tilt className="card-hover rounded-2xl p-5 min-w-[180px] sm:min-w-0">
      <div className="flex items-center justify-between text-white/40 text-xs">
        <div className="size-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-violet-300">{icon}</div>
        <span className="font-mono">{idx}</span>
      </div>
      <div className="mt-4 text-base font-medium">{label}</div>
    </Tilt>
  );
}

export default function Landing() {
  const [chars, setChars] = useState<Character[]>([]);
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    apiFetch<Character[]>("/characters?limit=6").then(setChars).catch(() => {});
    apiFetch<SystemInfo>("/info").then(setInfo).catch(() => {});
  }, []);

  return (
    <>
      {/* ============== HERO ============== */}
      <section className="relative">
        {/* Liquid blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="blob blob-1 blob-liquid w-[420px] h-[420px] -top-40 -left-32" />
          <div className="blob blob-2 blob-liquid w-[520px] h-[520px] top-20 -right-32" style={{ animationDelay: "-4s" }} />
          <div className="blob blob-3 w-[300px] h-[300px] top-[40%] left-[35%]" style={{ animationDelay: "-2s" }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-20 sm:pt-28 pb-20 text-center">
          {/* Status pill */}
          <div className="reveal inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-white/70 mb-8">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Open beta · {info?.llm_provider === "openrouter" ? "live on OpenRouter" : "playground"}
            <span className="text-white/30">·</span>
            <span className="font-mono text-white/50 text-[11px]">v0.1</span>
          </div>

          {/* Title */}
          <h1 className="reveal reveal-delay-1 text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight max-w-5xl mx-auto leading-[1.02]">
            <span className="metallic">Characters that</span>
            <br />
            <span className="gradient-text">come alive.</span>
          </h1>

          <p className="reveal reveal-delay-2 mt-6 text-lg sm:text-xl text-white/55 max-w-2xl mx-auto leading-relaxed">
            Build, talk to, and embed AI characters with their own personality, memory, and voice.
            <br className="hidden sm:block" />
            <span className="text-white/40">Open. Uncensored. Yours.</span>
          </p>

          <div className="reveal reveal-delay-3 mt-10 flex items-center gap-3 justify-center flex-wrap">
            <Link to="/explore" className="btn-primary text-base px-7 py-3.5">
              <Play className="size-4" /> Try a character <ArrowRight className="size-4" />
            </Link>
            <Link to="/builder" className="btn-secondary text-base px-7 py-3.5">
              <Sparkles className="size-4" /> Create your own
            </Link>
          </div>

          {/* Stats */}
          <div className="reveal reveal-delay-4 mt-20 grid grid-cols-3 max-w-2xl mx-auto gap-6">
            <Stat k="Characters" v={chars.length ? `${chars.length}+` : "∞"} />
            <Stat k="Languages" v="65+" />
            <Stat k="Latency" v="< 1s" />
          </div>

          {/* Hero card preview */}
          {chars.length > 0 && (
            <div className="relative mx-auto max-w-5xl mt-20">
              <Tilt max={4} className="reveal reveal-delay-5 gradient-border-static rounded-3xl glass-strong p-1.5 sm:p-2">
                <div className="rounded-3xl bg-[var(--color-bg-2)] p-6 sm:p-8 grid sm:grid-cols-3 gap-4">
                  {chars.slice(0, 3).map((c) => (
                    <Link
                      to={`/chat/${c.id}`}
                      key={c.id}
                      className="card-hover rounded-2xl p-5 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative size-12 rounded-xl bg-gradient-to-br from-violet-500/30 via-indigo-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center font-semibold">
                          {c.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                          <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 border-2 border-[var(--color-bg-2)]" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-semibold truncate">{c.name}</div>
                          <div className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">{c.language}</div>
                        </div>
                        <ArrowRight className="size-4 text-white/30 group-hover:text-violet-300 group-hover:translate-x-0.5 transition" />
                      </div>
                      <p className="text-sm text-white/55 mt-3 line-clamp-2 text-left leading-relaxed">{c.description || "Open to chat"}</p>
                    </Link>
                  ))}
                </div>
              </Tilt>
            </div>
          )}

          {/* Scroll cue */}
          <a href="#features" className="reveal reveal-delay-5 mt-16 inline-flex flex-col items-center gap-1 text-white/30 hover:text-white/60 transition">
            <span className="text-[10px] uppercase tracking-[0.3em]">Scroll to discover</span>
            <ChevronDown className="size-4 animate-bounce" />
          </a>
        </div>
      </section>

      {/* ============== MARQUEE: Languages / Models ============== */}
      <section className="py-10 border-y border-white/5 overflow-hidden">
        <div className="text-center mb-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">Speaks the language of your players</div>
        </div>
        <div className="marquee">
          <div className="marquee-track text-white/30 text-sm font-mono px-6">
            {[
              "English", "Русский", "Español", "中文", "Français", "Deutsch", "日本語",
              "Português", "한국어", "Italiano", "Nederlands", "العربية", "हिन्दी", "Türkçe"
            ].concat([
              "English", "Русский", "Español", "中文", "Français", "Deutsch", "日本語",
              "Português", "한국어", "Italiano", "Nederlands", "العربية", "हिन्दी", "Türkçe"
            ]).map((l, i) => (
              <span key={i} className="hover:text-white transition whitespace-nowrap">{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-[10px] uppercase tracking-[0.3em] text-violet-300/80 mb-3">The platform</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Everything <span className="metallic">you need</span> to build
            <br />
            <span className="gradient-text">conversational AI</span>
          </h2>
          <p className="mt-4 text-white/55">From the spark of an idea to a fully embodied character — without the licensing rooms.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureTile icon={<Brain className="size-5" />} title="Personality + memory" text="Each character has a unique voice, backstory, and traits. They remember conversations across sessions." accent="bg-violet-500/10 border-violet-400/25 text-violet-300" />
          <FeatureTile icon={<Mic className="size-5" />} title="Voice in & out" text="Speak naturally, hear them respond. Browser-native today, Silero / ElevenLabs for studio quality." accent="bg-cyan-500/10 border-cyan-400/25 text-cyan-300" />
          <FeatureTile icon={<BookOpen className="size-5" />} title="Knowledge base" text="Drop a PDF, a wiki, a lore document. Your character lives in it and talks like they belong." accent="bg-pink-500/10 border-pink-400/25 text-pink-300" />
          <FeatureTile icon={<Code2 className="size-5" />} title="Drop-in SDK" text="A web widget, a Unity package, a REST API. Plug a character into anything that can talk." accent="bg-amber-500/10 border-amber-400/25 text-amber-300" />
          <FeatureTile icon={<Zap className="size-5" />} title="Stream-fast" text="First-token streaming, sentence-level TTS — replies start while the model is still typing." accent="bg-emerald-500/10 border-emerald-400/25 text-emerald-300" />
          <FeatureTile icon={<Shield className="size-5" />} title="Yours, on your terms" text="No content lock-in. Export your data. Self-host the backend if you really want to." accent="bg-indigo-500/10 border-indigo-400/25 text-indigo-300" />
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="blob blob-1 w-[400px] h-[400px] top-0 right-1/4 opacity-40" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 mb-3">How it works</div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
              <span className="metallic">Three steps</span> to a living character
            </h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 relative">
            {[
              { n: "01", icon: <Brain className="size-5" />, title: "Craft the mind", desc: "Name, traits, backstory, system prompt. Optional knowledge base. The blueprint of who they are." },
              { n: "02", icon: <Sparkles className="size-5" />, title: "Embody the voice", desc: "Pick a language, a voice, a temperament. Test in seconds — speak, hear, refine." },
              { n: "03", icon: <Rocket className="size-5" />, title: "Deploy anywhere", desc: "Web widget on a site, NPC inside Unity, API call from your app. One character, every channel." },
            ].map((s, i) => (
              <Tilt key={i} className="card-hover rounded-2xl p-7 relative overflow-hidden">
                <div className="absolute -top-6 -right-4 text-[120px] font-bold leading-none text-white/5 select-none">{s.n}</div>
                <div className="relative">
                  <div className="size-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-violet-300 mb-5">
                    {s.icon}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-violet-300/80 mb-2">Step {s.n}</div>
                  <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </Tilt>
            ))}
          </div>
        </div>
      </section>

      {/* ============== OMNICHANNEL ============== */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-[10px] uppercase tracking-[0.3em] text-pink-300/80 mb-3">Omnichannel</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="metallic">Create once.</span>
            <br />
            <span className="gradient-text">Deploy everywhere.</span>
          </h2>
          <p className="mt-4 text-white/55">Your character lives wherever your audience is — websites, games, mobile apps, VR.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <ChannelCard icon={<Globe className="size-4" />} label="Websites" idx="01" />
          <ChannelCard icon={<Smartphone className="size-4" />} label="Mobile apps" idx="02" />
          <ChannelCard icon={<Gamepad2 className="size-4" />} label="Video games" idx="03" />
          <ChannelCard icon={<Cpu className="size-4" />} label="REST API" idx="04" />
          <ChannelCard icon={<Glasses className="size-4" />} label="VR & AR" idx="05" />
          <ChannelCard icon={<MessageSquare className="size-4" />} label="Web widget" idx="06" />
        </div>
      </section>

      {/* ============== USE CASES ============== */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="reveal">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-white/70 mb-4">
              <Users className="size-3.5" /> Who builds with us
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
              From <span className="metallic">solo storytellers</span>
              <br />
              to <span className="gradient-text">game studios</span>
            </h2>
            <ul className="mt-8 space-y-5 text-white/70 leading-relaxed">
              <li className="flex gap-3"><MessageSquare className="size-5 text-violet-300 shrink-0 mt-0.5" /><span><b className="text-white">Writers & roleplayers</b> craft companions that stay in character across thousands of messages.</span></li>
              <li className="flex gap-3"><Gamepad2 className="size-5 text-cyan-300 shrink-0 mt-0.5" /><span><b className="text-white">Indie game devs</b> drop NPCs into Unity that hold conversations, not 4-line dialogue trees.</span></li>
              <li className="flex gap-3"><Languages className="size-5 text-pink-300 shrink-0 mt-0.5" /><span><b className="text-white">Educators</b> build language partners and tutors that meet learners where they are.</span></li>
              <li className="flex gap-3"><Network className="size-5 text-emerald-300 shrink-0 mt-0.5" /><span><b className="text-white">Brand teams</b> spin up always-on, personality-aligned representatives.</span></li>
            </ul>
            <Link to="/explore" className="btn-primary mt-10 inline-flex">Browse the catalog <ArrowRight className="size-4" /></Link>
          </div>

          {/* Live chat preview */}
          <Tilt max={5}>
            <div className="card-hover rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 size-72 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-16 size-72 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="size-9 rounded-xl bg-gradient-to-br from-violet-500/40 to-cyan-500/40 border border-white/10 flex items-center justify-center text-sm font-semibold">AD</div>
                  <div>
                    <div className="text-sm font-semibold">Aria the Detective</div>
                    <div className="text-xs text-emerald-300/80 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Online
                    </div>
                  </div>
                </div>

                <div className="self-start max-w-[88%] rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-4 py-2.5 text-sm leading-relaxed">
                  <div className="text-[10px] text-white/40 mb-1">Aria</div>
                  Take a seat. Tell me what kind of trouble brought you to my door.
                </div>
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-violet-500/20 border border-violet-400/30 px-4 py-2.5 text-sm leading-relaxed">
                  <div className="text-[10px] text-violet-200/70 mb-1">You</div>
                  A friend disappeared three nights ago.
                </div>
                <div className="self-start max-w-[88%] rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-4 py-2.5 text-sm leading-relaxed">
                  <div className="text-[10px] text-white/40 mb-1">Aria</div>
                  Three nights — long enough for the rain to wash a trail, short enough that someone still remembers a face. Start with the last place they were seen…
                </div>

                {/* typing indicator */}
                <div className="self-start rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/50 inline-flex items-center gap-1.5 w-fit">
                  <span className="flex gap-1">
                    <span className="size-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                  thinking
                </div>
              </div>
            </div>
          </Tilt>
        </div>
      </section>

      {/* ============== INFRASTRUCTURE ============== */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 mb-3">Infrastructure</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="metallic">World-class</span> stack
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Layers className="size-5" />, title: "Modern stack", text: "FastAPI, React 19, Postgres, Qdrant" },
            { icon: <Zap className="size-5" />, title: "Low latency", text: "Streaming end-to-end, < 1s first token" },
            { icon: <Eye className="size-5" />, title: "Frontier models", text: "GPT-OSS, DeepSeek, Llama, Mistral" },
            { icon: <Shield className="size-5" />, title: "Built for scale", text: "Kubernetes-ready, horizontally scalable" },
          ].map((b, i) => (
            <Tilt key={i} className="card-hover rounded-2xl p-6 text-center">
              <div className="mx-auto size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-violet-300 mb-4">{b.icon}</div>
              <div className="font-semibold text-sm">{b.title}</div>
              <div className="text-xs text-white/50 mt-1.5 leading-relaxed">{b.text}</div>
            </Tilt>
          ))}
        </div>
      </section>

      {/* ============== PRICING ============== */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/80 mb-3">Pricing</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="metallic">Simple. Honest.</span>
            <br />
            <span className="gradient-text">Less than a coffee.</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {[
            { name: "Free", price: "$0", desc: "Talk to public characters, build a few of your own.", items: ["100 messages / day", "3 private characters", "Browser voice", "Community support"] },
            { name: "Hobby", price: "$9", desc: "For storytellers and indie devs.", items: ["5 000 messages / mo", "30 min voice / mo", "Unlimited characters", "Knowledge base", "Email support"], highlight: true },
            { name: "Pro", price: "$29", desc: "API access, higher limits, custom models.", items: ["30 000 msgs / mo", "200 min voice", "REST API + SDK", "Priority support", "Custom model routing"] },
          ].map((p) => (
            <Tilt key={p.name} max={3}>
              <div className={`card-hover rounded-3xl p-7 h-full flex flex-col ${p.highlight ? "gradient-border-static glow-violet" : ""}`}>
                {p.highlight && (
                  <div className="self-start text-[10px] uppercase tracking-[0.2em] text-violet-300 bg-violet-500/15 border border-violet-400/30 rounded-full px-3 py-1 mb-4">Most popular</div>
                )}
                <div className="text-sm uppercase tracking-wider text-white/50">{p.name}</div>
                <div className="mt-2 text-5xl font-bold metallic">{p.price}<span className="text-base text-white/40 font-normal ml-1">/mo</span></div>
                <p className="mt-3 text-sm text-white/60">{p.desc}</p>
                <ul className="mt-6 space-y-2.5 text-sm text-white/75 flex-1">
                  {p.items.map((i) => <li key={i} className="flex gap-2"><span className="text-violet-300">✓</span>{i}</li>)}
                </ul>
                <button className={(p.highlight ? "btn-primary" : "btn-secondary") + " mt-7 w-full"} disabled>
                  Coming soon
                </button>
              </div>
            </Tilt>
          ))}
        </div>
      </section>

      {/* ============== CTA ============== */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-20 sm:py-28">
        <Tilt max={3}>
          <div className="card-hover rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-96 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 right-0 size-72 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-white/70 mb-6">
                <Sparkles className="size-3.5 text-violet-300" /> Two clicks to a working AI companion
              </div>
              <h2 className="text-4xl sm:text-6xl font-bold tracking-tight">
                <span className="metallic">Build a character.</span>
                <br />
                <span className="gradient-text">Let it speak.</span>
              </h2>
              <p className="relative mt-5 text-white/55 max-w-md mx-auto">No credit card. No SDK to install. Just talk.</p>
              <div className="relative mt-10 flex items-center gap-3 justify-center flex-wrap">
                <Link to="/builder" className="btn-primary text-base px-7 py-3.5">Start building <ArrowRight className="size-4" /></Link>
                <Link to="/explore" className="btn-secondary text-base px-7 py-3.5">Browse public ones</Link>
              </div>
            </div>
          </div>
        </Tilt>
      </section>
    </>
  );
}
