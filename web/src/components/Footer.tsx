import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-white/5 mt-24">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-gradient-to-br from-violet-400 via-indigo-400 to-cyan-400 flex items-center justify-center">
                <Sparkles className="size-3.5 text-black" />
              </div>
              <div className="leading-none">
                <div className="font-semibold tracking-tight text-[15px]">Aliterra</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-0.5">Characters</div>
              </div>
            </div>
            <p className="mt-4 text-white/50 leading-relaxed">
              AI characters with personality, memory, and voice. Open. Yours.
            </p>
          </div>
          <div>
            <div className="text-white/40 uppercase text-[10px] tracking-[0.2em] mb-4">Product</div>
            <ul className="space-y-2.5 text-white/65">
              <li><Link to="/explore" className="hover:text-white transition">Explore</Link></li>
              <li><Link to="/builder" className="hover:text-white transition">Create a character</Link></li>
              <li><a href="/#pricing" className="hover:text-white transition">Pricing</a></li>
            </ul>
          </div>
          <div>
            <div className="text-white/40 uppercase text-[10px] tracking-[0.2em] mb-4">Developers</div>
            <ul className="space-y-2.5 text-white/65">
              <li><span className="text-white/30 cursor-not-allowed">API & SDK · soon</span></li>
              <li><span className="text-white/30 cursor-not-allowed">Unity package · soon</span></li>
              <li><span className="text-white/30 cursor-not-allowed">Web widget · soon</span></li>
            </ul>
          </div>
          <div>
            <div className="text-white/40 uppercase text-[10px] tracking-[0.2em] mb-4">Legal</div>
            <ul className="space-y-2.5 text-white/65">
              <li><span className="text-white/30 cursor-not-allowed">Terms · soon</span></li>
              <li><span className="text-white/30 cursor-not-allowed">Privacy · soon</span></li>
              <li><span className="text-white/30 cursor-not-allowed">Content policy 18+ · soon</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-white/5 text-xs text-white/30 flex flex-wrap items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} Aliterra · ai.aliterra.space</div>
          <div className="font-mono">FastAPI + React 19 · powered by OpenRouter</div>
        </div>
      </div>
    </footer>
  );
}
