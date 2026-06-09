import { Link, NavLink, useNavigate } from "react-router-dom";
import { Sparkles, LogOut, LogIn, Compass, LayoutDashboard, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useMe } from "@/lib/useMe";
import { setToken } from "@/lib/auth";

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        "magnetic relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition " +
        (isActive ? "bg-white/10 text-white" : "text-white/65 hover:text-white hover:bg-white/[0.04]")
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

export function Navbar() {
  const { me } = useMe();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-all duration-300 border-b ${
        scrolled
          ? "border-white/10 backdrop-blur-2xl bg-black/40 supports-[backdrop-filter]:bg-black/30"
          : "border-transparent backdrop-blur-md bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative size-9 rounded-xl bg-gradient-to-br from-violet-400 via-indigo-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow">
            <Sparkles className="size-4 text-black" />
            <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition" />
          </div>
          <div className="leading-none">
            <div className="font-semibold tracking-tight text-[15px]">Aliterra</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-0.5">Characters</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-6">
          <NavItem to="/explore" icon={<Compass className="size-4" />} label="Explore" />
          {me && (
            <>
              <NavItem to="/dashboard" icon={<LayoutDashboard className="size-4" />} label="My characters" />
              <NavItem to="/builder" icon={<Plus className="size-4" />} label="Create" />
            </>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {me ? (
            <>
              <span className="hidden sm:flex items-center gap-2 text-xs text-white/50 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {me.email}
              </span>
              <button
                className="btn-ghost"
                onClick={() => { setToken(null, null); navigate("/"); }}
                title="Log out"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary">
              <LogIn className="size-4" />
              <span>Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
