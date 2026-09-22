import React from 'react';
import { DrugInteractionAlert, Medication } from '../types';

interface DrugInteractionsModalProps {
  alerts: DrugInteractionAlert[];
  medications: Medication[];
  onClose: () => void;
  isDarkMode: boolean;
}

export const DrugInteractionsModal: React.FC<DrugInteractionsModalProps> = ({
  alerts,
  medications,
  onClose,
  isDarkMode,
}) => {
  const highRiskCount = alerts.filter((a) => a.severity === 'high').length;
  const moderateCount = alerts.filter((a) => a.severity === 'moderate').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-serif">
      <div
        className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl flex flex-col my-auto max-h-[90vh] overflow-hidden ${
          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Pinned Header */}
        <div className={`p-5 sm:p-6 border-b shrink-0 flex items-start justify-between gap-4 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-white/90'
        }`}>
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                highRiskCount > 0
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              <span className="material-symbols-outlined text-[28px]">
                {highRiskCount > 0 ? 'warning' : 'verified_user'}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-400 block">
                Safety &amp; Polypharmacy Checker
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Drug Interaction Analysis
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all shrink-0"
            title="Close"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex flex-col gap-6 flex-1">

        {/* Overview Banner */}
        {alerts.length === 0 ? (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-3">
            <span className="material-symbols-outlined text-[24px] text-emerald-400 shrink-0 mt-0.5">
              check_circle
            </span>
            <div className="text-sm">
              <strong className="block font-bold text-base text-emerald-200">
                No Known High-Risk Interactions Found
              </strong>
              <p className="mt-1 text-slate-300 text-xs leading-relaxed">
                Your current active prescription roster ({medications.length} medications) shows no conflicting drug pairings, duplicate active classes, or severe contraindications in the clinical safety database.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 flex items-start gap-3">
            <span className="material-symbols-outlined text-[24px] text-amber-400 shrink-0 mt-0.5">
              info
            </span>
            <div className="text-xs sm:text-sm">
              <span className="font-bold block text-amber-100">
                Found {alerts.length} Potential Prescription Alert{alerts.length > 1 ? 's' : ''} ({highRiskCount} High Risk, {moderateCount} Moderate Attention)
              </span>
              <p className="mt-1 text-slate-300 text-xs leading-relaxed">
                These clinical safety notes help you and your caregiver discuss medication timing, lab work, or alternatives with your doctor. Do NOT stop prescribed medications without medical advice.
              </p>
            </div>
          </div>
        )}

        {/* Alerts List */}
        {alerts.length > 0 && (
          <div className="flex flex-col gap-4 max-h-[55vh] overflow-y-auto pr-1">
            {alerts.map((alert) => {
              const isHigh = alert.severity === 'high';
              return (
                <div
                  key={alert.id}
                  className={`p-4 sm:p-5 rounded-2xl border flex flex-col gap-3 transition-all ${
                    isHigh
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : 'bg-amber-950/20 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                          isHigh
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {isHigh ? 'High Risk' : 'Moderate Attention'}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">{alert.category}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                      <span>Drugs:</span>
                      <strong className="text-white">{alert.drugsInvolved.join(' + ')}</strong>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      {alert.title}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {alert.description}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex items-start gap-2 text-indigo-200">
                    <span className="material-symbols-outlined text-indigo-400 text-[18px] shrink-0 mt-0.5">
                      stethoscope
                    </span>
                    <div>
                      <span className="font-bold text-indigo-300 block text-[11px] uppercase">
                        Doctor / Pharmacist Recommendation:
                      </span>
                      <span className="text-slate-300">{alert.clinicalAdvice}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* Pinned Footer Actions */}
        <div className={`p-4 sm:p-5 border-t shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-white/90'
        }`}>
          <span className="text-[11px] text-slate-400 text-center sm:text-left">
            Source: Clinical Geriatric Pharmacology Guidelines (Beers Criteria compliant)
          </span>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/30 transition-all"
          >
            Acknowledge &amp; Return
          </button>
        </div>
      </div>
    </div>
  );
};
