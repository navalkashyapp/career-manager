import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  UserCircle,
  FileText,
  Mail,
  CheckSquare,
  LogOut,
  TrendingUp,
  Sun,
  Moon,
  Search,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { initAuth, googleSignIn, logout } from '../../store/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import CareerCoach from '../chat/CareerCoach';
import { Button } from '../ui/button';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Performance', path: '/performance', icon: TrendingUp },
  { name: 'Applications', path: '/applications', icon: Briefcase },
  { name: 'Google Tasks', path: '/tasks', icon: CheckSquare },
  { name: 'Career Profile', path: '/profile', icon: UserCircle },
  { name: 'Resume Studio', path: '/resume', icon: FileText },
  { name: 'Job Evaluator', path: '/evaluate', icon: Search },
  { name: 'Mail Inbox', path: '/mail', icon: Mail },
];

export default function Layout() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [, setUserProfile] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(() => {
    try {
      return localStorage.getItem('sidebar_minimized') === 'true';
    } catch {
      return false;
    }
  });
  const { theme, toggleTheme } = useTheme();
  const { status: backendStatus, lastChecked, checkNow } = useBackendStatus();

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_minimized', String(next));
      } catch (e) {
        console.error('Failed to save sidebar state:', e);
      }
      return next;
    });
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      async (user) => {
        const allowedEmails = ['kashyapnaval35@gmail.com', 'navalkashyaap@gmail.com'];
        if (user && !allowedEmails.includes(user.email || '')) {
          await logout();
          setNeedsAuth(true);
          setUserProfile(null);
          return;
        }
        setUserProfile(user);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
        setUserProfile(null);
      },
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      const allowedEmails = ['kashyapnaval35@gmail.com', 'navalkashyaap@gmail.com'];
      if (result?.user && !allowedEmails.includes(result.user.email || '')) {
        alert('Unauthorized email address: ' + result.user.email);
        await logout();
        setNeedsAuth(true);
        setIsLoggingIn(false);
        return;
      }
      setNeedsAuth(false);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        console.error('Login failed:', err);
      }
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] flex items-center justify-center text-slate-900 dark:text-white p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-[#1E293B] rounded-2xl p-8 border border-slate-200 dark:border-[#334155] shadow-2xl"
        >
          <div className="flex flex-col items-center space-y-6">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl shadow-indigo-500/25 border border-indigo-500/30 flex items-center justify-center p-1 bg-[#0F172A]">
              <img
                src="/app-icon.png"
                alt="Career Manager"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-semibold mb-2">My Career Manager</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                AI-powered TPM job search suite with resume optimization and Gmail integration.
              </p>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full h-12 flex items-center justify-center space-x-3 text-black dark:text-white"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                ></path>
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                ></path>
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                ></path>
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                ></path>
              </svg>
              <span>{isLoggingIn ? 'Signing in...' : 'Sign in with Google'}</span>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] flex flex-col md:flex-row text-slate-700 dark:text-slate-200 selection:bg-indigo-500/30 font-sans overflow-hidden">
      {/* Mobile Topbar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#1E293B] bg-slate-100 dark:bg-[#0F172A] z-40 relative shadow-sm">
        <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
          <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm flex items-center justify-center shrink-0 border border-indigo-500/30">
            <img src="/logo192.png" alt="Career Manager" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="font-semibold text-lg tracking-tight block leading-tight">
              Career Manager
            </span>
            <div
              className="flex items-center space-x-1.5 mt-0.5"
              title={
                lastChecked
                  ? `Backend last checked: ${lastChecked.toLocaleTimeString()}`
                  : 'Backend health check'
              }
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full inline-block shrink-0',
                  backendStatus === 'online' && 'bg-emerald-500 shadow-sm shadow-emerald-500/50',
                  backendStatus === 'offline' && 'bg-rose-500 shadow-sm shadow-rose-500/50',
                  backendStatus === 'checking' && 'bg-amber-400 animate-pulse',
                )}
              />
              <span className="text-[10px] font-medium tracking-wide uppercase text-slate-500 dark:text-slate-400">
                {backendStatus === 'online'
                  ? 'Online'
                  : backendStatus === 'offline'
                    ? 'Offline'
                    : 'Checking...'}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </Button>
      </div>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-40 border-r border-slate-200 dark:border-[#1E293B] bg-slate-100 dark:bg-[#0F172A] flex flex-col transition-all duration-300 ease-in-out md:translate-x-0 h-screen shrink-0',
          isSidebarMinimized ? 'w-64 md:w-16' : 'w-64 md:w-64',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Desktop Sidebar Header */}
        <div
          className={cn(
            'hidden md:flex h-16 items-center border-b border-slate-200 dark:border-[#1E293B] shrink-0 transition-all duration-300',
            isSidebarMinimized ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          {isSidebarMinimized ? (
            <div className="relative group flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                title={`Expand sidebar (Backend: ${backendStatus})`}
                className="h-10 w-10 p-1 text-slate-500 hover:text-indigo-400 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1E293B] rounded-xl transition-colors relative"
              >
                <img
                  src="/logo192.png"
                  alt="Career Manager"
                  className="w-7 h-7 rounded-lg object-cover"
                />
                <span
                  className={cn(
                    'absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-100 dark:border-[#0F172A]',
                    backendStatus === 'online' && 'bg-emerald-500 shadow-sm shadow-emerald-500/50',
                    backendStatus === 'offline' && 'bg-rose-500 shadow-sm shadow-rose-500/50',
                    backendStatus === 'checking' && 'bg-amber-400 animate-pulse',
                  )}
                />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-3 text-slate-900 dark:text-white overflow-hidden">
                <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm flex items-center justify-center shrink-0 border border-indigo-500/30">
                  <img
                    src="/logo192.png"
                    alt="Career Manager"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-lg tracking-tight truncate leading-tight">
                    Career Manager
                  </span>
                  <button
                    onClick={() => checkNow()}
                    title={
                      lastChecked
                        ? `Backend status: ${backendStatus} (Click to re-check. Last checked: ${lastChecked.toLocaleTimeString()})`
                        : 'Click to re-check backend connectivity'
                    }
                    className="flex items-center space-x-1.5 mt-0.5 group text-left cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full inline-block shrink-0 transition-colors',
                        backendStatus === 'online' &&
                          'bg-emerald-500 shadow-sm shadow-emerald-500/50',
                        backendStatus === 'offline' && 'bg-rose-500 shadow-sm shadow-rose-500/50',
                        backendStatus === 'checking' && 'bg-amber-400 animate-pulse',
                      )}
                    />
                    <span className="text-[10px] font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                      <span>
                        {backendStatus === 'online'
                          ? 'Online'
                          : backendStatus === 'offline'
                            ? 'Offline'
                            : 'Checking...'}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                title="Minimize sidebar"
                className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0 rounded-lg transition-colors"
              >
                <PanelLeftClose size={18} />
              </Button>
            </>
          )}
        </div>

        <nav
          className={cn(
            'flex-1 py-6 space-y-1 overflow-y-auto transition-all duration-300',
            isSidebarMinimized ? 'px-2' : 'px-4',
          )}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              title={item.name}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-xl text-sm font-medium transition-all duration-200',
                  isSidebarMinimized
                    ? 'md:justify-center md:px-0 md:py-2.5 md:w-10 md:h-10 md:mx-auto space-x-3 px-3 py-2.5'
                    : 'space-x-3 px-3 py-2.5',
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-[#1E293B] hover:text-slate-700 dark:text-slate-200',
                )
              }
            >
              <item.icon size={18} className="shrink-0" />
              <span className={cn('truncate', isSidebarMinimized && 'md:hidden')}>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div
          className={cn(
            'border-t border-slate-200 dark:border-[#1E293B] space-y-2 shrink-0 transition-all duration-300',
            isSidebarMinimized ? 'p-2 space-y-2' : 'p-4 space-y-2',
          )}
        >
          <Button
            variant="ghost"
            onClick={() => {
              toggleTheme();
              setIsMobileMenuOpen(false);
            }}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            className={cn(
              'flex items-center rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white transition-colors',
              isSidebarMinimized
                ? 'md:justify-center md:px-0 md:py-2.5 md:w-10 md:h-10 md:mx-auto w-full justify-start space-x-3 px-3 py-2.5'
                : 'w-full justify-start space-x-3 px-3 py-2.5',
            )}
          >
            {theme === 'dark' ? (
              <Sun size={18} className="shrink-0" />
            ) : (
              <Moon size={18} className="shrink-0" />
            )}
            <span className={cn('truncate', isSidebarMinimized && 'md:hidden')}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </Button>
          <Button
            variant="ghost"
            onClick={handleLogout}
            title="Sign Out"
            className={cn(
              'flex items-center rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors',
              isSidebarMinimized
                ? 'md:justify-center md:px-0 md:py-2.5 md:w-10 md:h-10 md:mx-auto w-full justify-start space-x-3 px-3 py-2.5'
                : 'w-full justify-start space-x-3 px-3 py-2.5',
            )}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={cn('truncate', isSidebarMinimized && 'md:hidden')}>Sign Out</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-[calc(100vh-73px)] md:h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <CareerCoach />
    </div>
  );
}
