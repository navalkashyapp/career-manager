import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  UserCircle,
  FileText,
  Mail,
  CheckSquare,
  Settings,
  LogOut,
  TrendingUp,
  Sun,
  Moon,
  Search
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { initAuth, googleSignIn, logout } from '../../store/firebase';
import { useTheme } from '../../contexts/ThemeContext';
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
  const [userProfile, setUserProfile] = useState<any>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setUserProfile(user);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
        setUserProfile(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await googleSignIn();
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
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Briefcase size={32} />
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
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>{isLoggingIn ? 'Signing in...' : 'Sign in with Google'}</span>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] flex text-slate-700 dark:text-slate-200 selection:bg-indigo-500/30 font-sans">
      <aside className="w-64 border-r border-slate-200 dark:border-[#1E293B] bg-slate-100 dark:bg-[#0F172A] flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-[#1E293B]">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Briefcase size={18} />
            </div>
            <span className="font-semibold text-lg tracking-tight">Career Manager</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-[#1E293B] hover:text-slate-700 dark:text-slate-200"
              )}
            >
              <item.icon size={18} />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-[#1E293B] space-y-2">
          <Button
            variant="ghost"
            onClick={toggleTheme}
            className="flex items-center justify-start space-x-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </Button>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="flex items-center justify-start space-x-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <CareerCoach />
    </div>
  );
}
