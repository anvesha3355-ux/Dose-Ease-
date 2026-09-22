import React from 'react';
import { AuthUser } from '../types';

interface EmergencyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  isDarkMode: boolean;
  onOpenMedicalId?: () => void;
}

export const EmergencyGuideModal: React.FC<EmergencyGuideModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isDarkMode,
  onOpenMedicalId,
}) => {
  if (!isOpen) return null;

  const emergencyContact = currentUser?.profile?.emergencyContact;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-serif"
    >
      <div
        className={`w-full max-w-lg rounded-3xl shadow-2xl flex flex-col border my-auto max-h-[90vh] overflow-hidden ${
          isDarkMode
            ? 'bg-slate-900 border-rose-500/50 text-slate-100 shadow-[0_0_50px_rgba(244,63,94,0.25)]'
            : 'bg-white border-rose-400 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Pinned Header */}
        <div className={`p-5 sm:p-6 border-b shrink-0 flex items-start justify-between ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-rose-100 bg-white/90'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 shrink-0 animate-pulse">
              <span className="material-symbols-outlined text-[30px]">e911_emergency</span>
            </div>
            <div>
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-rose-400 block">
                Safety &amp; Emergency Support
              </span>
              <h2 className="text-xl sm:text-2xl font-black">Overdose &amp; Medical Help</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex flex-col gap-5 flex-1">

        {/* Mandatory Health App Compliance Notice */}
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
          <strong>Mandatory Medical Disclaimer:</strong> DoseEase is a medication organization and reminder tool. It does <strong>not</strong> replace professional advice, diagnosis, or treatment from a doctor, pharmacist, or licensed healthcare provider. Always follow your prescribing physician's directions.
        </div>

        {/* Quick Emergency Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Immediate Emergency Hotlines:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href="tel:911"
              className="min-h-[52px] px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[22px]">call</span>
              <span>Call 911 (Emergency)</span>
            </a>

            <a
              href="tel:18002221222"
              className="min-h-[52px] px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[20px]">local_hospital</span>
              <span>Poison Control (1-800-222-1222)</span>
            </a>
          </div>

          {/* Registered Emergency Contact Button */}
          {emergencyContact && emergencyContact.phone && (
            <a
              href={`tel:${emergencyContact.phone}`}
              className="min-h-[48px] px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">contact_phone</span>
              <span>
                Call {emergencyContact.name} ({emergencyContact.relation || 'Emergency Contact'})
              </span>
            </a>
          )}
        </div>

        {/* Action Steps Guide for Seniors */}
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex flex-col gap-2.5 ${
            isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-amber-400">warning</span>
            <span>Suspected Overdose or Adverse Reaction Steps:</span>
          </h3>

          <ol className="list-decimal pl-5 space-y-1 text-slate-300 text-xs leading-relaxed">
            <li>
              <strong>Stop taking the medication immediately.</strong> Do not take another dose.
            </li>
            <li>
              <strong>Stay calm.</strong> Check for symptoms such as dizziness, nausea, difficulty breathing, chest pain, or extreme drowsiness.
            </li>
            <li>
              <strong>Do NOT induce vomiting</strong> unless explicitly instructed to do so by Poison Control or emergency dispatch.
            </li>
            <li>
              <strong>Locate the medication bottle or prescription label</strong> so you can read the exact drug name, strength, and quantity to the emergency responder.
            </li>
            <li>
              <strong>Call Poison Control or 911</strong> right away, or have a family member drive you to the nearest emergency room.
            </li>
          </ol>
        </div>
        </div>

        {/* Pinned Action Buttons */}
        <div className={`p-4 sm:p-5 border-t shrink-0 flex flex-col gap-2.5 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-rose-100 bg-white/90'
        }`}>
          {/* Wallet Medical ID Quick Link */}
          {onOpenMedicalId && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMedicalId();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">id_card</span>
              <span>Show Wallet Emergency Medical ID Card</span>
            </button>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
          >
            Close Emergency Guide
          </button>
        </div>
      </div>
    </div>
  );
};
