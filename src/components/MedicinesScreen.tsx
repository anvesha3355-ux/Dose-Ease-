import React, { useState } from 'react';
import { AuthUser, Medication } from '../types';
import { getMedications, saveMedication, deleteMedication, refillMedication } from '../services/storage';
import { evaluateDrugInteractions } from '../services/drugInteractions';
import { AddMedicineModal } from './AddMedicineModal';
import { DoctorReportModal } from './DoctorReportModal';
import { DrugInteractionsModal } from './DrugInteractionsModal';
import { PharmacyRefillModal } from './PharmacyRefillModal';
import { MedicalIdModal } from './MedicalIdModal';

interface MedicinesScreenProps {
  currentUser: AuthUser;
  isDarkMode: boolean;
  showToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onUpdateUser?: (updatedUser: AuthUser) => void;
}

export const MedicinesScreen: React.FC<MedicinesScreenProps> = ({
  currentUser,
  isDarkMode,
  showToast,
  onUpdateUser,
}) => {
  const [medications, setMedications] = useState<Medication[]>(() =>
    getMedications(currentUser.uid)
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [isDoctorReportOpen, setIsDoctorReportOpen] = useState(false);
  const [isInteractionsModalOpen, setIsInteractionsModalOpen] = useState(false);
  const [isPharmacyModalOpen, setIsPharmacyModalOpen] = useState(false);
  const [isMedicalIdModalOpen, setIsMedicalIdModalOpen] = useState(false);

  // Quick Refill Modal State
  const [refillTargetMed, setRefillTargetMed] = useState<Medication | null>(null);
  const [customRefillCount, setCustomRefillCount] = useState<string>('30');

  const refreshList = () => {
    setMedications(getMedications(currentUser.uid));
  };

  const handleSaveMedication = (med: Medication) => {
    saveMedication(currentUser.uid, med);
    refreshList();
    showToast(
      editingMedication ? 'Medicine Updated' : 'Medicine Added',
      `${med.name} is scheduled.`
    );
  };

  const handleDeleteMedication = (medId: string) => {
    deleteMedication(currentUser.uid, medId);
    refreshList();
    showToast('Medicine Removed', 'Medication was removed from your active list.', 'warning');
  };

  const handleApplyRefill = (addedCount: number) => {
    if (!refillTargetMed || addedCount <= 0) return;
    const updated = refillMedication(currentUser.uid, refillTargetMed.id, addedCount);
    refreshList();
    setRefillTargetMed(null);
    showToast(
      'Refill Recorded',
      `Added ${addedCount} pills to ${refillTargetMed.name}. Total remaining: ${updated?.currentPillsRemaining ?? 'N/A'}.`,
      'success'
    );
  };

  // Find any medications running low on supply
  const lowSupplyMeds = medications.filter(
    (m) =>
      typeof m.currentPillsRemaining === 'number' &&
      m.currentPillsRemaining <= (m.refillReminderThreshold ?? 5)
  );

  // Evaluate clinical drug-drug interactions
  const interactionAlerts = evaluateDrugInteractions(medications);
  const highRiskInteractions = interactionAlerts.filter((a) => a.severity === 'high');

  return (
    <div className="flex flex-col gap-5 pb-24">
      {/* Executive Header Banner */}
      <div
        className={`p-5 sm:p-6 rounded-3xl border shadow-2xl relative overflow-hidden transition-all ${
          isDarkMode
            ? 'bg-gradient-to-br from-[#0b1329]/95 via-[#080e1e]/95 to-[#040812] border-indigo-950/90 shadow-black/60 ring-1 ring-white/10'
            : 'bg-gradient-to-br from-white/90 via-indigo-50/70 to-rose-50/60 border-indigo-100 shadow-xl shadow-indigo-100/50 ring-1 ring-indigo-200/50'
        }`}
      >
        <div
          className={`absolute -right-2 -bottom-6 font-serif font-bold text-9xl select-none pointer-events-none ${
            isDarkMode ? 'text-indigo-500/10' : 'text-indigo-600/10'
          }`}
          aria-hidden="true"
        >
          ℞
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <span className={`text-xs font-serif font-bold uppercase tracking-widest block mb-1 ${
              isDarkMode ? 'text-amber-300' : 'text-indigo-800'
            }`}>
              Prescriptions &amp; Supplements Directory
            </span>
            <h2 className={`text-2xl sm:text-3xl font-bold tracking-wide font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              My Medicines
            </h2>
            <p className={`text-xs sm:text-sm mt-0.5 font-serif ${isDarkMode ? 'opacity-80 text-slate-300' : 'text-slate-600'}`}>
              {medications.length} active clinical prescription{medications.length !== 1 ? 's' : ''} on record.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsPharmacyModalOpen(true)}
              className={`min-h-[42px] px-3.5 rounded-2xl border font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm font-serif ${
                isDarkMode
                  ? 'bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border-teal-500/40'
                  : 'bg-teal-100/80 hover:bg-teal-200/80 text-teal-800 border-teal-200'
              }`}
              title="Open One-Tap Pharmacy Refill Hub"
            >
              <span className="material-symbols-outlined text-[18px]">local_pharmacy</span>
              <span>Pharmacy Refills</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMedicalIdModalOpen(true)}
              className={`min-h-[42px] px-3.5 rounded-2xl border font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm font-serif ${
                isDarkMode
                  ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/40'
                  : 'bg-rose-100/80 hover:bg-rose-200/80 text-rose-800 border-rose-200'
              }`}
              title="Wallet Emergency Medical ID Card"
            >
              <span className="material-symbols-outlined text-[18px]">id_card</span>
              <span>Medical ID</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDoctorReportOpen(true)}
              className={`min-h-[42px] px-3.5 rounded-2xl border font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm font-serif ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-indigo-50/90 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
              }`}
              title="Generate Clinical Adherence Report for Doctor"
            >
              <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
              <span>Doctor's Report</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingMedication(null);
                setIsAddModalOpen(true);
              }}
              className="min-h-[42px] px-4 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-indigo-950/60 border border-indigo-400/30 active:scale-[0.98] font-serif"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>+ Add Medicine</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drug Interaction & Safety Status Card */}
      {medications.length >= 1 && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
            interactionAlerts.length > 0
              ? highRiskInteractions.length > 0
                ? isDarkMode
                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                  : 'bg-rose-50/90 border-rose-200 text-rose-950'
                : isDarkMode
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                : 'bg-amber-50/90 border-amber-200 text-amber-950'
              : isDarkMode
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
              : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`material-symbols-outlined text-[24px] shrink-0 mt-0.5 ${
                interactionAlerts.length > 0
                  ? highRiskInteractions.length > 0
                    ? 'text-rose-500'
                    : 'text-amber-500'
                  : 'text-emerald-500'
              }`}
            >
              {interactionAlerts.length > 0 ? 'warning' : 'verified_user'}
            </span>
            <div>
              <strong className={`block text-sm font-bold font-serif ${
                isDarkMode
                  ? 'text-white'
                  : interactionAlerts.length > 0
                  ? 'text-rose-950'
                  : 'text-emerald-950'
              }`}>
                {interactionAlerts.length > 0
                  ? `Safety Alert: ${interactionAlerts.length} Potential Drug Interaction${interactionAlerts.length > 1 ? 's' : ''} Detected`
                  : 'Prescription Safety Check: Clear'}
              </strong>
              <p className={`text-xs mt-0.5 font-serif ${isDarkMode ? 'opacity-90' : 'text-slate-700'}`}>
                {interactionAlerts.length > 0
                  ? `${interactionAlerts.map((a) => a.category).slice(0, 2).join(', ')}. Review clinical advice before taking doses.`
                  : `All ${medications.length} active prescriptions are checked against clinical polypharmacy contraindications.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsInteractionsModalOpen(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 self-start sm:self-center transition-all font-serif ${
              interactionAlerts.length > 0
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-sm'
                : isDarkMode
                ? 'bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40'
                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200'
            }`}
          >
            {interactionAlerts.length > 0 ? 'View Safety Analysis →' : 'Review Interactions'}
          </button>
        </div>
      )}

      {/* Low Stock Alert Banner */}
      {lowSupplyMeds.length > 0 && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDarkMode
            ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
            : 'bg-amber-50/90 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-500 text-[24px] shrink-0 mt-0.5">
              production_quantity_limits
            </span>
            <div>
              <strong className={`block text-sm font-bold font-serif ${isDarkMode ? 'text-white' : 'text-amber-950'}`}>
                Refill Reminder: {lowSupplyMeds.length} {lowSupplyMeds.length === 1 ? 'medicine needs' : 'medicines need'} a refill soon
              </strong>
              <p className={`text-xs mt-0.5 font-serif ${isDarkMode ? 'text-amber-200/90' : 'text-amber-900/90'}`}>
                {lowSupplyMeds.map((m) => `${m.name} (${m.currentPillsRemaining ?? 0} pills left)`).join(', ')}.
                Please contact your pharmacy or record a refill below.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setIsPharmacyModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all font-serif"
            >
              <span className="material-symbols-outlined text-[16px]">local_pharmacy</span>
              <span>Pharmacy Refill Hub</span>
            </button>
            {lowSupplyMeds.length === 1 && (
              <button
                type="button"
                onClick={() => {
                  setRefillTargetMed(lowSupplyMeds[0]);
                  setCustomRefillCount('30');
                }}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-serif"
              >
                + Quick Add
              </button>
            )}
          </div>
        </div>
      )}

      {/* Medicines List */}
      <div className="flex flex-col gap-3">
        {medications.length === 0 ? (
          <div
            className={`p-8 rounded-3xl border text-center ${
              isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <span className="material-symbols-outlined text-[32px]">medication</span>
            </div>
            <h4 className="font-bold text-lg text-slate-200">No Medicines Added Yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Add your daily prescriptions, tablets, or drops to get automatic reminders, refill tracking, and caregiver verification.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingMedication(null);
                setIsAddModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold"
            >
              + Add Your First Medicine
            </button>
          </div>
        ) : (
          medications.map((med) => {
            const hasInventory = typeof med.currentPillsRemaining === 'number';
            const pillsRemaining = med.currentPillsRemaining ?? 0;
            const threshold = med.refillReminderThreshold ?? 5;
            const isLowSupply = hasInventory && pillsRemaining <= threshold;
            const pillColor = med.pillColor || 'White';
            const pillShape = med.pillShape || 'round';

            return (
              <div
                key={med.id}
                className={`p-5 rounded-3xl border transition-all flex flex-col gap-3.5 ${
                  isDarkMode
                    ? 'bg-slate-800/60 border-slate-700 shadow-lg shadow-black/20'
                    : 'bg-white/90 border-indigo-100 shadow-md shadow-indigo-100/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    {/* Visual Pill / Medicine Avatar */}
                    <div
                      className={`w-12 h-12 flex items-center justify-center font-bold shadow-inner shrink-0 ${
                        pillShape === 'capsule'
                          ? 'rounded-full border-2 border-slate-400/50'
                          : pillShape === 'oval'
                          ? 'rounded-2xl border-2 border-slate-400/50'
                          : pillShape === 'drop'
                          ? 'rounded-b-full rounded-t-lg border-2 border-slate-400/50'
                          : 'rounded-full border-2 border-slate-400/50'
                      }`}
                      style={{
                        backgroundColor:
                          pillColor === 'White'
                            ? '#f8fafc'
                            : pillColor === 'Blue'
                            ? '#38bdf8'
                            : pillColor === 'Yellow'
                            ? '#facc15'
                            : pillColor === 'Pink'
                            ? '#f472b6'
                            : pillColor === 'Red'
                            ? '#f87171'
                            : pillColor === 'Orange'
                            ? '#fb923c'
                            : pillColor === 'Green'
                            ? '#4ade80'
                            : '#c084fc',
                        color: pillColor === 'White' || pillColor === 'Yellow' ? '#0f172a' : '#ffffff',
                      }}
                      title={`${pillColor} ${pillShape}`}
                    >
                      <span className="material-symbols-outlined text-[24px]">
                        {pillShape === 'capsule'
                          ? 'pill'
                          : pillShape === 'drop' || med.type === 'Drops'
                          ? 'opacity'
                          : med.type === 'Syrup'
                          ? 'liquids'
                          : med.type === 'Injection'
                          ? 'vaccines'
                          : 'circle'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-bold text-lg sm:text-xl leading-tight font-serif ${
                          isDarkMode ? 'text-white' : 'text-slate-900'
                        }`}>
                          {med.name}
                        </h3>
                        {med.pillColor && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider font-serif ${
                            isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {med.pillColor} {med.pillShape || ''}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs sm:text-sm font-medium mt-0.5 font-serif ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {med.strength} • {med.dosageAmount} ({med.type})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMedication(med);
                        setIsAddModalOpen(true);
                      }}
                      className={`p-2 rounded-xl transition-all ${
                        isDarkMode
                          ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50'
                          : 'text-slate-500 hover:text-indigo-700 hover:bg-indigo-50'
                      }`}
                      title="Edit medicine"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                  </div>
                </div>

                {/* Supply & Refill Bar */}
                <div
                  className={`p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                    isLowSupply
                      ? isDarkMode
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-amber-50 border-amber-200'
                      : isDarkMode
                      ? 'bg-slate-900/50 border-slate-800'
                      : 'bg-indigo-50/60 border-indigo-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`material-symbols-outlined text-[20px] ${
                        isLowSupply ? 'text-amber-500 animate-pulse' : isDarkMode ? 'text-slate-400' : 'text-indigo-500'
                      }`}
                    >
                      {isLowSupply ? 'warning' : 'inventory_2'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold font-serif ${
                          isDarkMode ? 'text-slate-200' : 'text-slate-800'
                        }`}>
                          {hasInventory
                            ? `${pillsRemaining} pills remaining`
                            : 'Supply tracking disabled'}
                        </span>
                        {isLowSupply && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 font-serif">
                            Low Supply (≤ {threshold})
                          </span>
                        )}
                      </div>
                      {hasInventory && (
                        <p className={`text-[11px] font-serif ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Auto-decrements when dose is marked taken
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRefillTargetMed(med);
                      setCustomRefillCount('30');
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 self-start sm:self-center transition-all font-serif ${
                      isLowSupply
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md'
                        : isDarkMode
                        ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                        : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    <span>+ Refill Supply</span>
                  </button>
                </div>

                {/* Schedule and Food Pills */}
                <div className={`flex flex-wrap items-center gap-2 pt-2 border-t text-xs font-semibold font-serif ${
                  isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'
                }`}>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-xl border ${
                    isDarkMode
                      ? 'text-slate-300 bg-slate-900/60 border-slate-700/60'
                      : 'text-indigo-900 bg-indigo-50 border-indigo-200'
                  }`}>
                    <span className="material-symbols-outlined text-[16px] text-indigo-500">schedule</span>
                    <span>{med.scheduledTimes.join(', ')}</span>
                  </div>

                  <div className={`flex items-center gap-1 px-3 py-1 rounded-xl border ${
                    isDarkMode
                      ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                      : 'text-amber-900 bg-amber-100/70 border-amber-200'
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">restaurant</span>
                    <span className="capitalize">{med.mealTiming.replace('_', ' ')}</span>
                  </div>

                  <div className={`flex items-center gap-1 px-3 py-1 rounded-xl border ${
                    isDarkMode
                      ? 'text-slate-400 bg-slate-900/60 border-slate-700/60'
                      : 'text-slate-700 bg-slate-100 border-slate-200'
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">repeat</span>
                    <span className="capitalize">{med.frequency.replace('_', ' ')}</span>
                  </div>

                  {med.rxNumber && (
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border font-mono text-[11px] ${
                      isDarkMode
                        ? 'text-indigo-300 bg-indigo-950/40 border-indigo-500/30'
                        : 'text-indigo-900 bg-indigo-100/70 border-indigo-200'
                    }`}>
                      <span>Rx: {med.rxNumber}</span>
                    </div>
                  )}

                  {med.pharmacyPhone && (
                    <a
                      href={`tel:${med.pharmacyPhone}`}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] hover:underline font-serif ${
                        isDarkMode
                          ? 'text-emerald-300 bg-emerald-950/40 border-emerald-500/30'
                          : 'text-emerald-900 bg-emerald-100/70 border-emerald-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">call</span>
                      <span>Call Pharmacy ({med.pharmacyName || med.pharmacyPhone})</span>
                    </a>
                  )}
                </div>

                {/* Prescribing Doctor & Special Instructions */}
                {(med.prescribingDoctor || med.instructions) && (
                  <div className={`flex flex-col gap-1 text-xs font-serif ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {med.prescribingDoctor && (
                      <p>
                        <strong>Doctor:</strong> {med.prescribingDoctor}
                      </p>
                    )}
                    {med.instructions && (
                      <p className="italic">
                        <strong>Instructions:</strong> {med.instructions}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Quick Refill Modal */}
      {refillTargetMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl flex flex-col my-auto max-h-[90vh] overflow-hidden font-serif ${
              isDarkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white/95 border-indigo-100 text-slate-900 shadow-indigo-100/50'
            }`}
          >
            {/* Pinned Header */}
            <div className={`p-5 sm:p-6 border-b shrink-0 flex items-center justify-between ${
              isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-indigo-100 bg-white/90'
            }`}>
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider block ${
                  isDarkMode ? 'text-indigo-400' : 'text-indigo-700'
                }`}>
                  Refill Medication Supply
                </span>
                <h3 className="text-xl font-bold mt-0.5">{refillTargetMed.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setRefillTargetMed(null)}
                className={`p-1.5 rounded-full transition-all ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-indigo-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex flex-col gap-4 flex-1">
              <div className={`p-3.5 rounded-2xl border text-xs ${
                isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-indigo-50/70 border-indigo-100'
              }`}>
                <span className={`block mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Currently in bottle:</span>
                <strong className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {typeof refillTargetMed.currentPillsRemaining === 'number'
                    ? `${refillTargetMed.currentPillsRemaining} pills`
                    : '0 pills (Supply tracking will be enabled)'}
                </strong>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Select Refill Pack
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[30, 60, 90].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleApplyRefill(count)}
                      className={`py-3 px-2 rounded-2xl border font-bold text-sm flex flex-col items-center gap-0.5 transition-all shadow-sm ${
                        isDarkMode
                          ? 'bg-indigo-600/20 hover:bg-indigo-600 border-indigo-500/40 hover:border-indigo-600 text-indigo-300 hover:text-white'
                          : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900'
                      }`}
                    >
                      <span className="font-bold">+{count}</span>
                      <span className="text-[10px] opacity-80 font-normal">Pills</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Or Custom Pill Count
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={customRefillCount}
                    onChange={(e) => setCustomRefillCount(e.target.value)}
                    placeholder="e.g. 45"
                    className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold outline-none font-serif ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseInt(customRefillCount, 10);
                      if (parsed > 0) {
                        handleApplyRefill(parsed);
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 shadow-md font-serif"
                  >
                    Add Custom
                  </button>
                </div>
              </div>

              {refillTargetMed.pharmacyPhone && (
                <div className={`pt-2 border-t flex items-center justify-between text-xs ${
                  isDarkMode ? 'border-slate-800 text-slate-400' : 'border-indigo-100 text-slate-600'
                }`}>
                  <span>Need pharmacy prescription refill?</span>
                  <a
                    href={`tel:${refillTargetMed.pharmacyPhone}`}
                    className={`font-bold hover:underline flex items-center gap-1 ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">call</span>
                    <span>Call {refillTargetMed.pharmacyName || 'Pharmacy'}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <AddMedicineModal
        isOpen={isAddModalOpen}
        editingMedication={editingMedication}
        existingMedications={medications}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingMedication(null);
        }}
        onSave={handleSaveMedication}
        onDelete={handleDeleteMedication}
        userId={currentUser.uid}
        isDarkMode={isDarkMode}
      />

      {/* Drug Interactions Safety Analysis Modal */}
      {isInteractionsModalOpen && (
        <DrugInteractionsModal
          alerts={interactionAlerts}
          medications={medications}
          onClose={() => setIsInteractionsModalOpen(false)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Clinical Adherence Report Modal */}
      <DoctorReportModal
        isOpen={isDoctorReportOpen}
        onClose={() => setIsDoctorReportOpen(false)}
        currentUser={currentUser}
        isDarkMode={isDarkMode}
      />

      {/* Pharmacy Refill Hub Modal */}
      <PharmacyRefillModal
        isOpen={isPharmacyModalOpen}
        onClose={() => setIsPharmacyModalOpen(false)}
        currentUser={currentUser}
        medications={medications}
        onRefillMedication={(medId, addedCount) => {
          refillMedication(currentUser.uid, medId, addedCount);
          refreshList();
        }}
        onUpdateUser={(updated) => {
          if (onUpdateUser) onUpdateUser(updated);
        }}
        isDarkMode={isDarkMode}
        showToast={showToast}
      />

      {/* Wallet Emergency Medical ID Modal */}
      <MedicalIdModal
        isOpen={isMedicalIdModalOpen}
        onClose={() => setIsMedicalIdModalOpen(false)}
        currentUser={currentUser}
        medications={medications}
        onUpdateUser={(updated) => {
          if (onUpdateUser) onUpdateUser(updated);
        }}
        isDarkMode={isDarkMode}
        showToast={showToast}
      />
    </div>
  );
};
