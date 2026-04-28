import { useState } from 'react';
import { Cpu, Menu, X, Key, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import SettingsModal from './SettingsModal';

export default function Navbar() {
  const { currentPage, setPage } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const navItems = [
    { label: 'Персонажи', page: 'characters' as const },
    { label: 'Создать', page: 'create' as const },
    { label: 'API Docs', page: 'api-docs' as const },
    { label: 'Дашборд', page: 'dashboard' as const },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-purple-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={() => setPage('landing')}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-transform">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight">
                <span className="gradient-text">NeuralCast</span>
              </span>
              <span className="tag hidden sm:block">BETA</span>
            </button>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.page}
                  onClick={() => setPage(item.page)}
                  className={`nav-link px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    currentPage === item.page
                      ? 'text-purple-300 bg-purple-900/20'
                      : 'hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSettingsOpen(true)}
                className="btn-ghost px-3 py-2 text-sm flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                <span className="hidden sm:block">API Ключи</span>
              </button>
              <button
                onClick={() => setPage('characters')}
                className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"
              >
                Начать
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-white/5 text-purple-300"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="md:hidden pb-4 border-t border-purple-900/20 mt-2 pt-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.page}
                  onClick={() => { setPage(item.page); setMenuOpen(false); }}
                  className={`block w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    currentPage === item.page
                      ? 'text-purple-300 bg-purple-900/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
