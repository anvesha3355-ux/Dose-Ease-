import React, { useState } from 'react';
import { MedicationLog } from '../types';

interface RetroactiveDoseModalProps {
  isOpen: boolean;
  log: MedicationLog | null;
  onClose: () => void;
  onConfirmTaken: (logId: string, actualTime: string, method: 'manual_later') => void;
  onConfirmSkipped: (logId: string) => void;
  onRemindLater: (logId: string) => void;
  isDarkMode: boolean;
}

export const RetroactiveDoseModal: React.FC<RetroactiveDoseModalProps> = ({
  isOpen,
  log,
  onClose,
  onConfirmTaken,
  onConfirmSkipped,
  onRemindLater,
  isDarkMode,
}) => {
  if (!isOpen || !log) return null;

  // Default approximate time to current time formatted
  const formatCurrentTime = () => {
    const d = new Date();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const [step, setStep] = useState<'prompt' | 'time_input'>('prompt');
  const [actualTime, setActualTime] = useState(formatCurrentTime());

  const handleTookIt = () => {
    setStep('time_input');
  };

  const handleSaveTakenTime = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmTaken(log.id, actualTime, 'manual_later');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 font-serif"
    >
      <div
        className={`w-full max-w-md rounded-3xl shadow-2xl flex flex-col border my-auto max-h-[90vh] overflow-hidden ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.8)]'
            : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}
      >
        {/* Pinned Header */}
        <div className={`p-5 sm:p-6 border-b shrink-0 flex items-start justify-between ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-white/90'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">help</span>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                Medication Check-In
              </span>
              <h3 className="font-extrabold text-xl sm:text-2xl leading-tight">
                Did you already take this?
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex flex-col gap-4 flex-1">

        {/* Medicine Details Card */}
        <div
          className={`p-4 rounded-2xl border ${
            isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold text-lg">{log.medicationName}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{log.dosage}</p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
              Scheduled: {log.scheduledTime}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Status: <span className="text-amber-400 font-semibold">Pending Confirmation</span>. We never assume you missed a dose.
          </p>
        </div>

        {step === 'prompt' ? (
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleTookIt}
              className="min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[22px]">check_circle</span>
              <span>YES, I TOOK IT</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onConfirmSkipped(log.id);
                onClose();
              }}
              className={`min-h-[48px] rounded-2xl border font-bold text-sm transition-all ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              NO, I DIDN'T TAKE IT (SKIP)
            </button>

            <button
              type="button"
              onClick={() => {
                onRemindLater(log.id);
                onClose();
              }}
              className="text-xs font-bold text-indigo-400 hover:underline py-1"
            >
              Remind me later
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveTakenTime} className="flex flex-col gap-3 pt-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Approximate time you took it:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={actualTime}
                onChange={(e) => setActualTime(e.target.value)}
                placeholder="e.g. 08:45 AM"
                className={`flex-1 font-mono text-base font-bold py-3 px-4 rounded-2xl border outline-none ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setActualTime(formatCurrentTime())}
                className="px-3 py-3 rounded-2xl bg-slate-800 text-xs font-bold text-indigo-400 border border-slate-700 hover:bg-slate-700"
              >
                Just Now
              </button>
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
              This will be recorded as: <strong>Taken manually at {actualTime}</strong> (Scheduled for {log.scheduledTime}).
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep('prompt')}
                className={`px-4 rounded-2xl border font-bold text-sm ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300'
                }`}
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[50px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-md transition-all active:scale-[0.98]"
              >
                Save Confirmation
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};
