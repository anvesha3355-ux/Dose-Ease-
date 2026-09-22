import React, { useEffect, useState } from 'react';
import { MedicationLog } from '../types';
import { playMedicationChime } from '../services/notifications';

interface MedicationReminderModalProps {
  isOpen: boolean;
  log: MedicationLog | null;
  onClose: () => void;
  onTaken: (logId: string) => void;
  onSnooze: (logId: string, durationMinutes: number) => void;
  onSkip: (logId: string) => void;
  onTookEarlier: (log: MedicationLog) => void;
  isDarkMode: boolean;
  highVolume?: boolean;
}

export const MedicationReminderModal: React.FC<MedicationReminderModalProps> = ({
  isOpen,
  log,
  onClose,
  onTaken,
  onSnooze,
  onSkip,
  onTookEarlier,
  isDarkMode,
  highVolume = false,
}) => {
  const [selectedSnooze, setSelectedSnooze] = useState<number>(10);
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);

  useEffect(() => {
    if (isOpen && log) {
      playMedicationChime(highVolume);
    }
  }, [isOpen, log, highVolume]);

  if (!isOpen || !log) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in zoom-in-95 duration-200"
    >
      <div
        className={`w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-5 border my-auto ${
          isDarkMode
            ? 'bg-slate-900 border-indigo-500/60 text-slate-100 shadow-[0_0_50px_rgba(79,70,229,0.3)]'
            : 'bg-white border-indigo-400 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Urgent Senior Chime Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-3 animate-bounce">
            <span className="material-symbols-outlined text-[36px]">alarm</span>
          </div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
            Medication Reminder
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
            Time for your medicine
          </h2>
          <p className="text-xs text-slate-400 mt-1">Scheduled for {log.scheduledTime}</p>
        </div>

        {/* Medicine Info Card */}
        <div
          className={`p-5 rounded-2xl border text-center ${
            isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <h3 className="text-2xl font-black text-indigo-400 leading-tight">
            {log.medicationName}
          </h3>
          <p className="text-base font-semibold mt-1">{log.dosage}</p>
          {log.mealTiming && (
            <span className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {log.mealTiming.replace('_', ' ').toUpperCase()}
            </span>
          )}
          {log.notes && (
            <p className="text-xs text-slate-400 mt-2 italic">{log.notes}</p>
          )}
        </div>

        {/* Action Buttons (Large and accessible) */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              onTaken(log.id);
              onClose();
            }}
            className="w-full min-h-[58px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg sm:text-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[28px]">check_circle</span>
            <span>TAKEN</span>
          </button>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    onSnooze(log.id, selectedSnooze);
                    onClose();
                  }}
                  className="w-full min-h-[50px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[20px]">snooze</span>
                  <span>SNOOZE ({selectedSnooze}m)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSnoozePicker(!showSnoozePicker)}
                  className="text-[11px] text-indigo-400 font-bold block text-center mt-1 hover:underline"
                >
                  Change snooze time
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    onSkip(log.id);
                    onClose();
                  }}
                  className={`w-full min-h-[50px] rounded-2xl border font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                      : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                  <span>SKIP</span>
                </button>
              </div>
            </div>

            {showSnoozePicker && (
              <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-300">Snooze length:</span>
                <div className="flex items-center gap-1.5">
                  {[5, 10, 15, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setSelectedSnooze(mins);
                        setShowSnoozePicker(false);
                      }}
                      className={`px-2.5 py-1 rounded-xl font-bold border transition-all ${
                        selectedSnooze === mins
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onTookEarlier(log);
            }}
            className="text-xs text-slate-400 hover:text-indigo-400 font-semibold py-1 underline"
          >
            Did you take this earlier? Record exact time
          </button>
        </div>
      </div>
    </div>
  );
};
