import React, { useState } from 'react';
import { AuthUser, Medication } from '../types';
import { updateProfile } from '../services/auth';

interface MedicalIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  medications: Medication[];
  onUpdateUser?: (updatedUser: AuthUser) => void;
  isDarkMode: boolean;
  showToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const MedicalIdModal: React.FC<MedicalIdModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  medications,
  onUpdateUser,
  isDarkMode,
  showToast,
}) => {
  if (!isOpen) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [bloodType, setBloodType] = useState(currentUser.profile.bloodType || 'O+');
  const [dateOfBirth, setDateOfBirth] = useState(currentUser.profile.dateOfBirth || '1952-04-12');
  const [organDonor, setOrganDonor] = useState(currentUser.profile.organDonor ?? true);
  const [allergiesText, setAllergiesText] = useState(
    (currentUser.profile.allergies || ['Penicillin (Severe Rash/Anaphylaxis)', 'Sulfa Drugs']).join(', ')
  );
  const [conditionsText, setConditionsText] = useState(
    (currentUser.profile.chronicConditions || ['Hypertension', 'Type 2 Diabetes']).join(', ')
  );
  const [physicianName, setPhysicianName] = useState(
    currentUser.profile.primaryPhysician?.name || 'Dr. Robert Martinez, MD'
  );
  const [physicianPhone, setPhysicianPhone] = useState(
    currentUser.profile.primaryPhysician?.phone || '(555) 234-8900'
  );
  const [physicianClinic, setPhysicianClinic] = useState(
    currentUser.profile.primaryPhysician?.clinic || 'Downtown Geriatric Health Partners'
  );

  const allergies = allergiesText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const conditions = conditionsText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const emergencyContact = currentUser.profile.emergencyContact || {
    name: 'Sarah Vance',
    relation: 'Daughter / Power of Attorney',
    phone: '(555) 019-2834',
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = updateProfile(currentUser.uid, {
        bloodType,
        dateOfBirth,
        organDonor,
        allergies,
        chronicConditions: conditions,
        primaryPhysician: {
          name: physicianName,
          phone: physicianPhone,
          clinic: physicianClinic,
        },
      });
      if (onUpdateUser) onUpdateUser(updated);
      setIsEditing(false);
      showToast('Medical ID Saved', 'Emergency Medical ID details updated successfully.', 'success');
    } catch {
      showToast('Save Failed', 'Could not save medical ID details.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const summary = [
      `--- EMERGENCY MEDICAL ID (${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}) ---`,
      `DOB: ${dateOfBirth} | Blood Type: ${bloodType} | Organ Donor: ${organDonor ? 'Yes' : 'No'}`,
      `Emergency Contact: ${emergencyContact.name} (${emergencyContact.relation}) - ${emergencyContact.phone}`,
      `Primary Physician: ${physicianName} - ${physicianPhone}`,
      `Critical Allergies: ${allergies.join(', ') || 'No Known Drug Allergies (NKDA)'}`,
      `Medical Conditions: ${conditions.join(', ') || 'None reported'}`,
      `Active Medications (${medications.length}):`,
      ...medications.map(
        (m, i) =>
          `  ${i + 1}. ${m.name} ${m.strength} (${m.dosageAmount}) - Times: ${m.scheduledTimes.join(', ')} [${m.rxNumber || 'No Rx#'}]`
      ),
      `Emergency Instructions: In case of overdose or sudden unresponsiveness, dial 911 or Poison Control (800-222-1222).`,
    ].join('\n');

    navigator.clipboard.writeText(summary);
    showToast('Medical Summary Copied', 'Copied full emergency medical card text to clipboard.', 'success');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div
        className={`w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col border my-auto max-h-[90vh] overflow-hidden ${
          isDarkMode
            ? 'bg-slate-900 border-rose-500/40 text-slate-100 shadow-[0_0_50px_rgba(244,63,94,0.18)]'
            : 'bg-white border-rose-400 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Pinned Top Bar */}
        <div className={`p-5 sm:p-6 border-b shrink-0 flex items-start justify-between gap-3 no-print ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-rose-100 bg-white/90'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 shrink-0">
              <span className="material-symbols-outlined text-[28px]">id_card</span>
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400 block">
                Official First-Responder Card
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Wallet Emergency Medical ID
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5"
              title="Edit Medical ID Info"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              <span className="hidden sm:inline font-bold">Edit ID</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex flex-col gap-6 flex-1">
        {/* Edit Form (if toggled) */}
        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col gap-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-400 text-[18px]">contact_emergency</span>
              <span>Edit Emergency &amp; Medical Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Blood Type</label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold"
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Organ Donor</label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={organDonor}
                    onChange={(e) => setOrganDonor(e.target.checked)}
                    className="w-4 h-4 accent-rose-500 rounded"
                  />
                  <span className="text-xs text-slate-200 font-bold">Registered Donor</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Drug Allergies (comma-separated)
                </label>
                <input
                  type="text"
                  value={allergiesText}
                  onChange={(e) => setAllergiesText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  placeholder="e.g. Penicillin, Sulfa, Aspirin"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Medical Conditions (comma-separated)
                </label>
                <input
                  type="text"
                  value={conditionsText}
                  onChange={(e) => setConditionsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  placeholder="e.g. Diabetes, Hypertension, Asthma"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Primary Doctor</label>
                <input
                  type="text"
                  value={physicianName}
                  onChange={(e) => setPhysicianName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  placeholder="Dr. Robert Martinez, MD"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Doctor Phone</label>
                <input
                  type="tel"
                  value={physicianPhone}
                  onChange={(e) => setPhysicianPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  placeholder="(555) 234-8900"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Clinic / Hospital</label>
                <input
                  type="text"
                  value={physicianClinic}
                  onChange={(e) => setPhysicianClinic(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  placeholder="Downtown Geriatric Clinic"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : null}

        {/* The Card View (Screen & Printable Wallet Layout) */}
        <div
          id="emergency-wallet-card"
          className="wallet-card-print rounded-3xl border-2 border-rose-500/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white p-5 sm:p-6 flex flex-col gap-4 shadow-xl relative overflow-hidden"
        >
          {/* Top Red Alert Banner */}
          <div className="flex items-center justify-between pb-3 border-b border-rose-500/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-sm">
                +
              </div>
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-rose-400 block">
                  EMERGENCY MEDICAL IDENTIFICATION
                </span>
                <strong className="text-base sm:text-lg font-black tracking-tight">
                  DOSEEASE HEALTH PROFILE
                </strong>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">BLOOD TYPE</span>
              <span className="text-lg font-black text-rose-400 font-mono">{bloodType}</span>
            </div>
          </div>

          {/* Patient Vitals Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Patient Name</span>
              <strong className="text-sm font-extrabold text-white">
                {currentUser.profile.firstName} {currentUser.profile.lastName || ''}
              </strong>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Date of Birth</span>
              <span className="text-xs font-mono font-bold text-slate-200">{dateOfBirth}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Donor Status</span>
              <span className="text-xs font-bold text-emerald-400">
                {organDonor ? 'Registered Organ Donor' : 'Not Specified'}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Primary Physician</span>
              <span className="text-xs font-semibold text-slate-200 truncate block">
                {physicianName}
              </span>
            </div>
          </div>

          {/* Emergency Contact & Phone */}
          <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-400 block">
                Primary Emergency Contact (In Case of Emergency)
              </span>
              <strong className="text-xs sm:text-sm font-extrabold text-white">
                {emergencyContact.name} ({emergencyContact.relation})
              </strong>
            </div>

            <a
              href={`tel:${emergencyContact.phone.replace(/[^0-9+]/g, '')}`}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all self-start sm:self-center"
            >
              <span className="material-symbols-outlined text-[16px]">call</span>
              <span>{emergencyContact.phone}</span>
            </a>
          </div>

          {/* Critical Allergies & Conditions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-500/40">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1 mb-1.5">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                <span>Critical Drug Allergies</span>
              </span>
              {allergies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {allergies.map((allergy, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-bold bg-rose-600/30 text-rose-200 border border-rose-500/40 px-2 py-0.5 rounded-lg"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">No Known Drug Allergies (NKDA)</span>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1 mb-1.5">
                <span className="material-symbols-outlined text-[14px]">medical_information</span>
                <span>Chronic Conditions</span>
              </span>
              {conditions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {conditions.map((cond, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-medium bg-slate-700/60 text-slate-200 px-2 py-0.5 rounded-lg"
                    >
                      {cond}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">None reported</span>
              )}
            </div>
          </div>

          {/* Active Medication Regimen Table */}
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Active Prescriptions ({medications.length})
              </span>
              <span className="text-[10px] text-slate-400">DoseEase Regimen</span>
            </div>

            <div className="space-y-1 text-xs">
              {medications.slice(0, 5).map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-800/40 border border-slate-800 text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{med.name}</span>
                    <span className="text-slate-400">{med.strength}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-300 font-mono">
                    <span>{med.scheduledTimes.join(', ')}</span>
                    {med.rxNumber && (
                      <span className="text-teal-400 text-[10px]">{med.rxNumber}</span>
                    )}
                  </div>
                </div>
              ))}
              {medications.length > 5 && (
                <div className="text-[10px] text-slate-400 text-center italic py-0.5">
                  +{medications.length - 5} additional medications listed on full clinical chart
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* Pinned Modal Action Buttons */}
        <div className={`p-4 sm:p-5 border-t shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 no-print ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-rose-100 bg-white/90'
        }`}>
          <button
            type="button"
            onClick={handleCopySummary}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">content_copy</span>
            <span>Copy Text Summary</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/25 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Print Wallet Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
