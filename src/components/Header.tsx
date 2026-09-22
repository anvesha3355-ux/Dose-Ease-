import React from 'react';
import { AuthUser } from '../types';

interface HeaderProps {
  currentUser: AuthUser;
  isOnline: boolean;
  onOpenProfile: () => void;
  pendingSyncCount: number;
  isDarkMode: boolean;
  onToggleTheme?: () => void;
  onTriggerRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isOnline,
  onOpenProfile,
  pendingSyncCount,
  isDarkMode,
  onToggleTheme,
  onTriggerRefresh,
}) => {
  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-200 px-4 py-3 sm:px-6 ${
        isDarkMode
          ? 'bg-[#070d1a]/95 backdrop-blur-xl border-b border-indigo-950/90 shadow-xl shadow-black/40'
          : 'bg-white/85 backdrop-blur-xl border-b border-indigo-100/90 shadow-md shadow-indigo-100/40'
      }`}
    >
      <div className="max-w-3xl lg:max-w-4xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              isDarkMode
                ? 'bg-gradient-to-br from-indigo-700 via-blue-900 to-slate-950 text-amber-300 border border-indigo-400/40 shadow-lg shadow-indigo-950/80'
                : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white border border-indigo-200 shadow-md shadow-indigo-200/60'
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">medication</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`font-bold text-xl tracking-wide font-serif ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                DoseEase
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-serif ${
                  isDarkMode
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-indigo-100/80 text-indigo-800 border border-indigo-200'
                }`}
              >
                {currentUser.profile.role}
              </span>
            </div>
            <span
              className={`text-[10px] block uppercase tracking-widest italic -mt-0.5 font-serif ${
                isDarkMode ? 'text-indigo-300/80' : 'text-indigo-600/90'
              }`}
            >
              Clinical Prescription System
            </span>
          </div>
        </div>

        {/* Right side status, theme toggle, and profile avatar */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Offline / Online Sync Indicator */}
          {!isOnline ? (
            <div
              className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border font-serif ${
                isDarkMode
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-amber-50 text-amber-800 border-amber-200 shadow-sm'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Offline Mode</span>
            </div>
          ) : pendingSyncCount > 0 ? (
            <button
              type="button"
              onClick={onTriggerRefresh}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border font-serif cursor-pointer transition-all active:scale-95 ${
                isDarkMode
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/30'
                  : 'bg-indigo-100/70 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }`}
              title="Click to sync local data queue now"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span>Syncing ({pendingSyncCount})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onTriggerRefresh}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full font-serif cursor-pointer transition-all hover:opacity-80 active:scale-95 ${
                isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
              }`}
              title="Pull down to refresh & sync or click here"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Synced</span>
            </button>
          )}

          {/* Quick Theme Toggle (Pastel Light / Dark Executive) */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className={`w-9 h-9 rounded-2xl flex items-center justify-center border transition-all active:scale-95 ${
                isDarkMode
                  ? 'bg-slate-800/90 hover:bg-slate-700 text-amber-300 border-slate-700/80 shadow-md'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200/80 shadow-sm'
              }`}
              title={isDarkMode ? 'Switch to Pastel Light Theme' : 'Switch to Dark Executive Theme'}
            >
              <span className="material-symbols-outlined text-[19px]">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          )}

          {/* Profile Avatar Button */}
          <button
            type="button"
            onClick={onOpenProfile}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl font-bold text-base flex items-center justify-center border shadow-md transition-all font-serif active:scale-95 ${
              isDarkMode
                ? 'bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-amber-300 border-amber-500/30'
                : 'bg-gradient-to-br from-indigo-100 to-purple-100 hover:from-indigo-200 hover:to-purple-200 text-indigo-900 border-indigo-200 shadow-indigo-100'
            }`}
            title="Profile & Settings"
          >
            {currentUser.profile.firstName.charAt(0)}
          </button>
        </div>
      </div>
    </header>
  );
};
