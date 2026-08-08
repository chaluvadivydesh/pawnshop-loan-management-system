import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Coins,
  Sun,
  Moon,
  Download,
  Users,
  Calculator,
  Clock,
  FileText,
  MapPin,
  Lock,
  Menu,
  X,
  ShieldCheck,
  BarChart3
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <RouterLink to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-slate-800 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-slate-950/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 text-amber-400 font-bold" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                GOLD & SILVER <span className="text-amber-500 font-extrabold text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 tracking-wider">PRO FINANCE</span>
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block -mt-1 tracking-widest uppercase">
                Loan Management Enterprise
              </span>
            </div>
          </RouterLink>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1">
            <RouterLink
              to="/"
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                location.pathname === '/'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Customers & Loans</span>
            </RouterLink>

            <RouterLink
              to="/due-dates"
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                location.pathname.startsWith('/due-dates')
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Due Dates</span>
            </RouterLink>

            <RouterLink
              to="/calculate"
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                location.pathname.startsWith('/calculate')
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>Calculator</span>
            </RouterLink>

            <RouterLink
              to="/village-report"
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                location.pathname.startsWith('/village-report')
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <MapPin className="w-4 h-4 text-amber-500" />
              <span>Village Report</span>
            </RouterLink>

            <RouterLink
              to="/financial-reports"
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                location.pathname.startsWith('/financial-reports')
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Financial Reports</span>
              <Lock className="w-3 h-3 text-amber-500" />
            </RouterLink>
          </nav>

          {/* Actions & Controls */}
          <div className="flex items-center space-x-2">
            {deferredPrompt && (
              <button
                onClick={handleInstallPWA}
                className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            )}

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-4 space-y-1">
          <RouterLink
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Customers & Loans
          </RouterLink>
          <RouterLink
            to="/due-dates"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Due Dates
          </RouterLink>
          <RouterLink
            to="/calculate"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Calculator
          </RouterLink>
          <RouterLink
            to="/village-report"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2"
          >
            <MapPin className="w-4 h-4 text-amber-500" />
            <span>Village Report</span>
          </RouterLink>
          <RouterLink
            to="/financial-reports"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2"
          >
            <FileText className="w-4 h-4" />
            <span>Financial Reports (Protected)</span>
          </RouterLink>
        </div>
      )}
    </header>
  );
};
