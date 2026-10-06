import React, { useState } from 'react';
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Bot,
  PhoneCall,
  KeyRound,
  Sun,
  Moon,
  Tv,
} from 'lucide-react';
import { Organization } from '../types';
import { MahallaInfo } from '../data/mahallasData';

interface LoginScreenProps {
  organizations: Organization[];
  onLoginSuccess: (role: 'tashkilot' | 'bosh_kabinet' | 'mahalla' | 'monitor', organization?: Organization, mahalla?: MahallaInfo) => void;
  botStatus: { isActive: boolean; botUsername?: string };
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  botStatus,
  isDarkMode = true,
  onToggleDarkMode,
}) => {
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLockedError, setIsLockedError] = useState<boolean>(false);
  const [lockedOrgName, setLockedOrgName] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLockedError(false);
    setLockedOrgName(null);

    const cleanPass = password.trim();
    if (!cleanPass) {
      setErrorMsg('Iltimos, maxsus parolni kiriting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: cleanPass }),
      });

      const data = await res.json().catch(() => null);

      if (data && data.success) {
        if (data.role === 'bosh_kabinet') {
          onLoginSuccess('bosh_kabinet');
        } else if (data.role === 'monitor') {
          onLoginSuccess('monitor');
        } else if (data.role === 'tashkilot' && data.organization) {
          onLoginSuccess('tashkilot', data.organization);
        } else if (data.role === 'mahalla' && data.mahalla) {
          onLoginSuccess('mahalla', undefined, data.mahalla);
        }
      } else {
        if (data && data.isLocked) {
          setIsLockedError(true);
          setLockedOrgName(data.organizationName || null);
          setErrorMsg(data.message || 'Panel Bosh Kabinet orqali qulflangan, iltimos bosh xodimga murojaat qiling.');
        } else {
          setIsLockedError(false);
          if (data && typeof data.attemptsLeft === 'number') {
            setAttemptsLeft(data.attemptsLeft);
          }
          setErrorMsg((data && data.message) || 'Kiritilgan maxsus parol noto‘g‘ri!');
        }
      }
    } catch (err) {
      setErrorMsg('Server bilan bog‘lanishda xatolik yuz berdi. Iltimos qayta urinib ko‘ring.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#070d18] text-slate-100' : 'bg-slate-100 text-slate-900'} flex flex-col justify-center items-center p-3 sm:p-4 relative overflow-hidden transition-colors duration-200`}>
      {/* Top Right Theme Toggle */}
      {onToggleDarkMode && (
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-20">
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Kunduzgi (Yorug‘) rejimga o‘tish' : 'Tungi rejimga o‘tish'}
            className={`px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl ${
              isDarkMode ? 'bg-slate-800/90 text-amber-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-indigo-600 border-slate-200 hover:bg-slate-50'
            } border shadow-md transition-all cursor-pointer flex items-center space-x-1.5`}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400 animate-pulse" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            <span className="text-xs font-bold">{isDarkMode ? 'Kun' : 'Tun'}</span>
          </button>
        </div>
      )}

      {/* Background Subtle Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className={`max-w-md w-full ${isDarkMode ? 'bg-[#0c1628] border-slate-800 shadow-2xl shadow-black/60' : 'bg-white border-slate-200 shadow-2xl'} border rounded-2xl sm:rounded-3xl overflow-hidden z-10 animate-fade-in`}>
        {/* Header */}
        <div className={`p-5 sm:p-7 md:p-8 text-center border-b ${isDarkMode ? 'border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-[#0c1628]' : 'border-slate-100 bg-gradient-to-b from-slate-50 to-white'}`}>
          <div className="inline-flex items-center justify-center p-3 bg-indigo-600/15 border border-indigo-500/30 rounded-2xl text-indigo-500 dark:text-indigo-400 mb-2.5 sm:mb-3 shadow-lg shadow-indigo-600/10">
            <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h1 className={`text-lg sm:text-xl md:text-2xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
            murojaatlar Nazorat Portali
          </h1>
          <p className={`text-[11px] sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mt-1`}>
            Murojaatlarni boshqarish va ijro etish axborot tizimi
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 md:p-8 space-y-4 sm:space-y-5">
          {/* Locked Alert Box */}
          {isLockedError && (
            <div className="bg-rose-950/70 border-2 border-rose-500 text-rose-100 p-3.5 sm:p-4 rounded-2xl text-xs space-y-2.5 sm:space-y-3 animate-shake shadow-xl shadow-rose-950/60">
              <div className="flex items-center space-x-2 text-rose-300 font-black text-xs sm:text-sm">
                <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0" />
                <span>🚨 Tashkilot Paneli Qulflangan!</span>
              </div>
              <div className="p-2.5 sm:p-3 bg-rose-900/60 border border-rose-600/60 rounded-xl text-rose-100 font-bold text-xs sm:text-[13px] leading-snug">
                {errorMsg || 'Panel Bosh Kabinet orqali qulflangan, iltimos bosh xodimga murojaat qiling.'}
              </div>
              {lockedOrgName && (
                <div className="text-[11px] sm:text-[12px] text-rose-200">
                  Tashkilot: <b className="text-white font-bold">{lockedOrgName}</b>
                </div>
              )}
              <div className="pt-2 border-t border-rose-500/30 flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-white">
                <div className="flex items-center space-x-1">
                  <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
                  <span>murojaatlar Bosh Kabinet:</span>
                </div>
                <span className="text-amber-300 font-mono font-bold">+998 94 062-05-55</span>
              </div>
            </div>
          )}

          {/* General Error Notice */}
          {!isLockedError && errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 p-3 rounded-xl text-xs flex items-center space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider flex items-center space-x-1.5`}>
                <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                <span>Maxsus Parol</span>
              </label>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                  setIsLockedError(false);
                }}
                placeholder="Maxsus parolni kiriting..."
                autoComplete="new-password"
                autoFocus
                className={`w-full ${
                  isDarkMode 
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white'
                } border rounded-xl pl-10 pr-11 py-3 sm:py-3.5 text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 sm:top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-white font-bold py-3 sm:py-3.5 px-4 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer min-h-[44px]"
          >
            <span>{isSubmitting ? 'Tekshirilmoqda...' : 'Tizimga Kirish'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      <footer className={`mt-5 text-center text-[10px] sm:text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        murojaatlar Murojaatlar va Tashkilotlar Boshqaruvi Axborot Tizimi
      </footer>
    </div>
  );
};
