import React, { useState } from 'react';
import { AuthUser, Medication, PharmacyDetails } from '../types';
import { updateProfile } from '../services/auth';

interface PharmacyRefillModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  medications: Medication[];
  onRefillMedication: (medicationId: string, addedCount: number) => void;
  onUpdateUser: (updatedUser: AuthUser) => void;
  isDarkMode: boolean;
  showToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const PharmacyRefillModal: React.FC<PharmacyRefillModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  medications,
  onRefillMedication,
  onUpdateUser,
  isDarkMode,
  showToast,
}) => {
  if (!isOpen) return null;

  const defaultPharmacy: PharmacyDetails = currentUser.profile.preferredPharmacy || {
    name: 'Community Care Pharmacy #412',
    phone: '(800) 555-0199',
    address: '1244 Medical Center Blvd, Suite 100',
    storeNumber: 'Branch #412',
    pharmacistName: 'Dr. Michael Chen, PharmD',
    notes: 'Drive-thru window available. Refills typically ready in 2 hours.',
  };

  const [isEditingPharmacy, setIsEditingPharmacy] = useState(false);
  const [pharmacy, setPharmacy] = useState<PharmacyDetails>(defaultPharmacy);
  const [selectedMedForScript, setSelectedMedForScript] = useState<Medication | null>(
    medications[0] || null
  );
  const [refillInputCounts, setRefillInputCounts] = useState<Record<string, number>>({});

  const handleCopyRx = (rxNumber: string, medName: string) => {
    if (!rxNumber) {
      showToast('No Rx Number', `No prescription number is listed for ${medName}.`, 'info');
      return;
    }
    navigator.clipboard.writeText(rxNumber.trim());
    showToast('Rx # Copied', `${rxNumber} copied to clipboard for easy pharmacy ordering.`, 'success');
  };

  const handleSavePharmacy = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = updateProfile(currentUser.uid, {
        preferredPharmacy: pharmacy,
      });
      onUpdateUser(updated);
      setIsEditingPharmacy(false);
      showToast('Pharmacy Updated', 'Your preferred pharmacy contact details have been saved.', 'success');
    } catch {
      showToast('Save Failed', 'Could not save pharmacy information.', 'error');
    }
  };

  const getRefillScript = (med: Medication | null) => {
    if (!med) return '';
    const patientName = `${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}`.trim();
    const dob = currentUser.profile.dateOfBirth ? `(DOB: ${currentUser.profile.dateOfBirth})` : '';
    const rx = med.rxNumber ? `Rx #${med.rxNumber}` : 'my prescription';
    return `Hello, I'd like to request a refill for ${patientName} ${dob}. The prescription is ${rx} for ${med.name} ${med.strength}. Please let me know when it will be ready for pickup.`;
  };

  const handleCopyScript = (med: Medication) => {
    const text = getRefillScript(med);
    navigator.clipboard.writeText(text);
    showToast('Refill Script Copied', 'Paste into messaging or read directly over the phone to your pharmacist.', 'success');
  };

  const cleanPhone = (pharmacy.phone || '').replace(/[^0-9+]/g, '');

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-serif"
    >
      <div
        className={`w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col border my-auto max-h-[90vh] overflow-hidden ${
          isDarkMode
            ? 'bg-slate-900 border-teal-500/40 text-slate-100 shadow-[0_0_45px_rgba(20,184,166,0.15)]'
            : 'bg-white border-teal-500 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Pinned Header */}
        <div className={`p-5 sm:p-6 border-b shrink-0 flex items-start justify-between gap-4 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-teal-100 bg-white/90'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/30 shrink-0">
              <span className="material-symbols-outlined text-[28px]">local_pharmacy</span>
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-teal-400 block">
                Pharmacy Refill &amp; Rx Manager
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                One-Tap Refill Hub
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex flex-col gap-6 flex-1">

        {/* Preferred Pharmacy Card */}
        <div
          className={`p-5 rounded-3xl border flex flex-col gap-4 ${
            isDarkMode ? 'bg-slate-800/80 border-slate-700/80' : 'bg-teal-50/70 border-teal-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-teal-400 text-[26px]">storefront</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-white">{pharmacy.name}</h3>
                  {pharmacy.storeNumber && (
                    <span className="text-[11px] font-mono bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full border border-teal-500/30">
                      {pharmacy.storeNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">{pharmacy.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <a
                href={`tel:${cleanPhone}`}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-teal-600/20 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                <span>Call {pharmacy.phone}</span>
              </a>

              <button
                type="button"
                onClick={() => setIsEditingPharmacy(!isEditingPharmacy)}
                className="p-2 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1"
                title="Edit Pharmacy Contact Info"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            </div>
          </div>

          {pharmacy.notes && (
            <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-700/50">
              <span className="material-symbols-outlined text-[16px] text-teal-400">info</span>
              <span>{pharmacy.notes}</span>
            </div>
          )}

          {/* Inline Pharmacy Edit Form */}
          {isEditingPharmacy && (
            <form onSubmit={handleSavePharmacy} className="pt-3 border-t border-slate-700 flex flex-col gap-3">
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                Edit Preferred Pharmacy
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Pharmacy Name</label>
                  <input
                    type="text"
                    required
                    value={pharmacy.name}
                    onChange={(e) => setPharmacy({ ...pharmacy, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    placeholder="e.g. Walgreens #1042"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={pharmacy.phone}
                    onChange={(e) => setPharmacy({ ...pharmacy, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    placeholder="(800) 555-0199"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Address / Location</label>
                  <input
                    type="text"
                    value={pharmacy.address || ''}
                    onChange={(e) => setPharmacy({ ...pharmacy, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    placeholder="123 Health Ave"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Store / Branch #</label>
                  <input
                    type="text"
                    value={pharmacy.storeNumber || ''}
                    onChange={(e) => setPharmacy({ ...pharmacy, storeNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    placeholder="Branch #412"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingPharmacy(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold"
                >
                  Save Pharmacy
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Prescription Inventory & Rx Quick-Copy List */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-teal-400">medication</span>
              <span>Active Prescriptions &amp; Rx Numbers</span>
            </h3>
            <span className="text-xs text-slate-400">
              {medications.length} active medicine{medications.length !== 1 ? 's' : ''}
            </span>
          </div>

          {medications.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 text-center text-xs text-slate-400">
              No active medications recorded yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
              {medications.map((med) => {
                const pillsLeft = med.currentPillsRemaining ?? 0;
                const threshold = med.refillReminderThreshold ?? 5;
                const isLow = pillsLeft <= threshold;
                const rxNumber = med.rxNumber || 'RX-PENDING';

                return (
                  <div
                    key={med.id}
                    className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      isLow
                        ? 'bg-amber-950/20 border-amber-500/50'
                        : isDarkMode
                        ? 'bg-slate-800/60 border-slate-700/70'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                        style={{ backgroundColor: `${med.color}25`, color: med.color }}
                      >
                        <span className="material-symbols-outlined text-[20px]">{med.icon}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-extrabold text-white">{med.name}</strong>
                          <span className="text-xs text-slate-400">({med.strength})</span>
                          {isLow && (
                            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
                              Low ({pillsLeft} left)
                            </span>
                          )}
                        </div>

                        {/* Rx Number with 1-tap copy */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono font-bold text-teal-300 bg-teal-950/50 px-2 py-0.5 rounded-lg border border-teal-500/30">
                            {rxNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyRx(rxNumber, med.name)}
                            className="text-xs text-slate-400 hover:text-teal-300 flex items-center gap-0.5 transition-all"
                            title="Copy Rx # to clipboard"
                          >
                            <span className="material-symbols-outlined text-[15px]">content_copy</span>
                            <span className="text-[11px] font-semibold">Copy Rx</span>
                          </button>
                          <span className="text-slate-600">•</span>
                          <button
                            type="button"
                            onClick={() => setSelectedMedForScript(med)}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
                          >
                            Generate Script
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Inventory Refill Action */}
                    <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onRefillMedication(med.id, 30);
                          showToast('Refill Logged', `Added +30 pills to ${med.name}.`, 'success');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
                        title="Add 30 pills"
                      >
                        +30
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onRefillMedication(med.id, 60);
                          showToast('Refill Logged', `Added +60 pills to ${med.name}.`, 'success');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
                        title="Add 60 pills"
                      >
                        +60
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onRefillMedication(med.id, 90);
                          showToast('Refill Logged', `Added +90 pills to ${med.name}.`, 'success');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 border border-teal-500/40 text-xs font-bold transition-all"
                        title="Add 90 pills (3-month supply)"
                      >
                        +90
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Spoken / Message Refill Script Generator */}
        {selectedMedForScript && (
          <div
            className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
              isDarkMode ? 'bg-indigo-950/25 border-indigo-500/40 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400 text-[18px]">
                  record_voice_over
                </span>
                <strong className="text-xs font-extrabold uppercase tracking-wide">
                  Ready-to-Read Refill Script ({selectedMedForScript.name})
                </strong>
              </div>
              <button
                type="button"
                onClick={() => handleCopyScript(selectedMedForScript)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                <span>Copy Script</span>
              </button>
            </div>

            <p className="text-xs italic bg-slate-900/60 p-3 rounded-xl border border-indigo-500/20 text-slate-200 leading-relaxed font-mono">
              "{getRefillScript(selectedMedForScript)}"
            </p>
          </div>
        )}
        </div>

        {/* Pinned Footer */}
        <div className={`p-4 sm:p-5 border-t shrink-0 flex items-center justify-end gap-3 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-teal-100 bg-white/90'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm transition-all"
          >
            Close
          </button>
          <a
            href={`tel:${cleanPhone}`}
            className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-teal-600/25 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">call</span>
            <span>Call Pharmacy Now</span>
          </a>
        </div>
      </div>
    </div>
  );
};
