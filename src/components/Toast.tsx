import React from 'react';
import { ToastMessage } from '../types';

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  isDarkMode: boolean;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss, isDarkMode }) => {
  if (!toast) return null;

  const type = toast.type || 'success';

  return (
    <div
      id="app-floating-toast"
      role="alert"
      className={`fixed bottom-24 left-4 right-4 max-w-lg mx-auto z-50 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3 border transition-all animate-in fade-in slide-in-from-bottom-5 duration-300 font-serif ${
        isDarkMode
          ? 'bg-slate-900 text-slate-100 border-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.8)]'
          : 'bg-white text-slate-900 border-indigo-100 shadow-xl shadow-indigo-100/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            type === 'success'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : type === 'warning'
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : type === 'error'
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
              : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">
            {type === 'success'
              ? 'check_circle'
              : type === 'warning'
              ? 'warning'
              : type === 'error'
              ? 'error'
              : 'info'}
          </span>
        </div>
        <div>
          <p className="font-bold text-base leading-tight">{toast.title}</p>
          {toast.description && (
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{toast.description}</p>
          )}
        </div>
      </div>
      <button
        id="dismiss-toast-btn"
        type="button"
        onClick={onDismiss}
        className={`p-1.5 rounded-lg transition-colors ${
          isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
        }`}
        aria-label="Close notification"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  );
};
