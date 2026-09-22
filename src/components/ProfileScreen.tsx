import React, { useState } from 'react';
import { AuthUser, NotificationSettings, UserProfile } from '../types';
import {
  getUserSettings,
  saveUserSettings,
  getPatientConnections,
  getCaregiverActivePatients,
  exportDoseEaseBackup,
  importDoseEaseBackup,
} from '../services/storage';
import { updateProfile, deleteAccount } from '../services/auth';
import {
  playMedicationChime,
  requestNotificationPermission,
  speakText,
} from '../services/notifications';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { EmergencyGuideModal } from './EmergencyGuideModal';
import { PharmacyRefillModal } from './PharmacyRefillModal';
import { MedicalIdModal } from './MedicalIdModal';
import { getMedications, refillMedication } from '../services/storage';
import { PROJECT_ZIP_BASE64 } from '../services/zipData';

interface ProfileScreenProps {
  currentUser: AuthUser;
  onLogout: () => void;
  onUserUpdated: (user: AuthUser) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  isSeniorMode?: boolean;
  setIsSeniorMode?: (val: boolean) => void;
  showToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  currentUser,
  onLogout,
  onUserUpdated,
  isDarkMode,
  setIsDarkMode,
  isSeniorMode = false,
  setIsSeniorMode,
  showToast,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(() =>
    getUserSettings(currentUser.uid)
  );

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showMedicalIdModal, setShowMedicalIdModal] = useState(false);
  const [showPharmacyModal, setShowPharmacyModal] = useState(false);
  const [medications, setMedications] = useState(() => getMedications(currentUser.uid));
  const [notifPermissionState, setNotifPermissionState] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [editFirstName, setEditFirstName] = useState(currentUser.profile.firstName);
  const [editLastName, setEditLastName] = useState(currentUser.profile.lastName || '');
  const [editPhone, setEditPhone] = useState(currentUser.profile.phoneNumber || '');
  const [editEmergName, setEditEmergName] = useState(
    currentUser.profile.emergencyContact?.name || ''
  );
  const [editEmergPhone, setEditEmergPhone] = useState(
    currentUser.profile.emergencyContact?.phone || ''
  );
  const [editEmergRel, setEditEmergRel] = useState(
    currentUser.profile.emergencyContact?.relation || ''
  );

  const isPatient = currentUser.profile.role === 'patient';
  const connectionsCount = isPatient
    ? getPatientConnections(currentUser.uid).filter((c) => c.status === 'active').length
    : getCaregiverActivePatients(currentUser.uid).length;

  const handleUpdateSetting = <K extends keyof NotificationSettings>(
    key: K,
    val: NotificationSettings[K]
  ) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    saveUserSettings(currentUser.uid, updated);
    showToast('Settings Saved', 'Your reminder preferences have been updated.');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<UserProfile> = {
      firstName: editFirstName.trim(),
      lastName: editLastName.trim() || undefined,
      phoneNumber: editPhone.trim() || undefined,
      emergencyContact: editEmergName.trim()
        ? {
            name: editEmergName.trim(),
            phone: editEmergPhone.trim(),
            relation: editEmergRel.trim(),
          }
        : undefined,
    };

    const updatedUser = updateProfile(currentUser.uid, updates);
    onUserUpdated(updatedUser);
    setIsEditingProfile(false);
    showToast('Profile Updated', 'Your contact information was updated.');
  };

  const handleDeleteAccount = () => {
    if (
      window.confirm(
        'Are you sure you want to delete your account? All medication schedules, logs, and caregiver links will be permanently deleted.'
      )
    ) {
      deleteAccount(currentUser.uid);
      showToast('Account Deleted', 'Your data has been removed.', 'info');
      onLogout();
    }
  };

  const handleExportBackup = () => {
    try {
      const backup = exportDoseEaseBackup(currentUser.uid);
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `doseease_backup_${new Date().toISOString().split('T')[0]}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast(
        'Backup Exported',
        `Successfully exported ${backup.medications.length} medications and history logs.`,
        'success'
      );
    } catch (err: any) {
      showToast('Export Error', err?.message || 'Could not export backup data', 'error');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const res = importDoseEaseBackup(currentUser.uid, parsed);
        if (res.success) {
          showToast('Data Restored', res.message, 'success');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showToast('Restore Failed', res.message, 'error');
        }
      } catch {
        showToast('Import Error', 'The selected file is not a valid DoseEase JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Profile Card */}
      <div
        className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden transition-all ${
          isDarkMode
            ? 'bg-gradient-to-br from-[#0b1329]/95 via-[#080e1e]/95 to-[#040812] border-indigo-950/90 shadow-black/60 ring-1 ring-white/10 text-white'
            : 'bg-gradient-to-br from-white/95 via-indigo-50/70 to-rose-50/60 border-indigo-100 shadow-indigo-100/50 ring-1 ring-indigo-200/50 text-slate-900'
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

        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-3xl font-bold text-2xl flex items-center justify-center shadow-xl border font-serif ${
              isDarkMode
                ? 'bg-gradient-to-br from-indigo-700 via-blue-900 to-slate-950 text-amber-300 shadow-indigo-950/80 border-amber-500/30'
                : 'bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 text-white shadow-indigo-200 border-white/60'
            }`}>
              {currentUser.profile.firstName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-xl sm:text-2xl font-bold tracking-wide font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser.profile.firstName} {currentUser.profile.lastName || ''}
                </h3>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider font-serif ${
                  isDarkMode
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}>
                  {currentUser.profile.role}
                </span>
              </div>
              <p className={`text-xs sm:text-sm mt-0.5 font-serif ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{currentUser.email}</p>
              {currentUser.profile.phoneNumber && (
                <p className={`text-xs mt-0.5 font-serif ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {currentUser.profile.phoneNumber}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingProfile(true)}
            className={`p-2.5 rounded-2xl transition-all ${
              isDarkMode
                ? 'bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white'
                : 'bg-white/80 hover:bg-white text-indigo-900 shadow-sm border border-indigo-100'
            }`}
            title="Edit Profile"
          >
            <span className="material-symbols-outlined text-[20px]">edit</span>
          </button>
        </div>

        {/* Emergency Contact */}
        {currentUser.profile.emergencyContact && (
          <div className={`mt-4 pt-4 border-t flex items-center justify-between text-xs ${
            isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'
          }`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-400 text-[20px]">e911_emergency</span>
              <div>
                <span className={`block text-[10px] uppercase font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Emergency Contact:
                </span>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser.profile.emergencyContact.name} ({currentUser.profile.emergencyContact.relation})
                </span>
              </div>
            </div>
            <a
              href={`tel:${currentUser.profile.emergencyContact.phone}`}
              className={`font-mono font-bold hover:underline ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}
            >
              {currentUser.profile.emergencyContact.phone}
            </a>
          </div>
        )}

        <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
          isDarkMode ? 'border-slate-700/60 text-slate-400' : 'border-indigo-100 text-slate-600'
        }`}>
          <span>
            {isPatient ? 'Connected Caregivers' : 'Active Monitored Patients'}:{' '}
            <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{connectionsCount}</strong>
          </span>
          <span className="text-emerald-500 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Session Authenticated
          </span>
        </div>
      </div>

      {/* Notification Settings */}
      <div
        className={`p-6 rounded-3xl border flex flex-col gap-4 shadow-sm font-serif ${
          isDarkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/90 border-indigo-100 text-slate-900'
        }`}
      >
        <h3 className={`text-base font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
          Reminder &amp; Alert Settings
        </h3>

        {/* Medication Reminders Toggle */}
        <label className="flex items-center justify-between cursor-pointer py-1">
          <div>
            <span className={`font-bold text-sm block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Medication Reminders</span>
            <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Receive alert dialogs &amp; chimes when medicine is due
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.remindersEnabled}
            onChange={(e) => handleUpdateSetting('remindersEnabled', e.target.checked)}
            className="w-5 h-5 accent-indigo-600 rounded"
          />
        </label>

        {/* Snooze Duration */}
        <div className={`flex items-center justify-between py-1 border-t ${isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'}`}>
          <div>
            <span className={`font-bold text-sm block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Snooze Duration</span>
            <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>How long to wait when snoozing a dose</span>
          </div>
          <select
            value={settings.snoozeDurationMinutes}
            onChange={(e) => handleUpdateSetting('snoozeDurationMinutes', Number(e.target.value))}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold outline-none ${
              isDarkMode
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-indigo-50 border-indigo-200 text-slate-900'
            }`}
          >
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
          </select>
        </div>

        {/* Grace Period */}
        <div className={`flex items-center justify-between py-1 border-t ${isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'}`}>
          <div>
            <span className={`font-bold text-sm block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Grace Period</span>
            <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Wait time before marking as pending confirmation
            </span>
          </div>
          <select
            value={settings.gracePeriodMinutes}
            onChange={(e) => handleUpdateSetting('gracePeriodMinutes', Number(e.target.value))}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold outline-none ${
              isDarkMode
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-indigo-50 border-indigo-200 text-slate-900'
            }`}
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </div>

        {/* Caregiver Alerts */}
        <label className={`flex items-center justify-between cursor-pointer py-1 border-t ${isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'}`}>
          <div>
            <span className={`font-bold text-sm block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Caregiver Alert Escalation</span>
            <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Notify approved caregiver if a dose is unconfirmed past grace period
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.caregiverAlertsEnabled}
            onChange={(e) => handleUpdateSetting('caregiverAlertsEnabled', e.target.checked)}
            className="w-5 h-5 accent-indigo-600 rounded"
          />
        </label>

        {/* High Volume Voice Toggle */}
        <label className={`flex items-center justify-between cursor-pointer py-1 border-t ${isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'}`}>
          <div>
            <span className={`font-bold text-sm block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>High-Volume Voice Chime</span>
            <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Senior-optimized clear audio cues during reminders
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.highVolumeVoice}
            onChange={(e) => handleUpdateSetting('highVolumeVoice', e.target.checked)}
            className="w-5 h-5 accent-indigo-600 rounded"
          />
        </label>

        {/* Audio Test & Notification Permission row */}
        <div className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 ${isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'}`}>
          <button
            type="button"
            onClick={() => {
              playMedicationChime(settings.highVolumeVoice);
              showToast('Playing Alert Chime', 'Testing notification sound.', 'info');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">volume_up</span>
            <span>Test Chime Sound</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const granted = await requestNotificationPermission();
              setNotifPermissionState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
              if (granted) {
                showToast('Notifications Enabled', 'System alerts will now arrive on schedule.', 'success');
              } else {
                showToast('Notifications Blocked', 'Please permit notifications in browser settings.', 'warning');
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-indigo-50 hover:bg-indigo-100 text-slate-800 border-indigo-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">notifications_active</span>
            <span>
              Permission:{' '}
              <strong className={notifPermissionState === 'granted' ? 'text-emerald-500' : 'text-amber-500'}>
                {notifPermissionState}
              </strong>
            </span>
          </button>
        </div>
      </div>

      {/* Clinical ID & Pharmacy Refills */}
      <div
        className={`p-6 rounded-3xl border flex flex-col gap-4 shadow-sm font-serif ${
          isDarkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/90 border-indigo-100 text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-500 text-[22px]">
              medical_information
            </span>
            <div>
              <h3 className={`font-bold text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Medical ID &amp; Pharmacy Refills</h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Emergency wallet identification and rapid prescription ordering</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowMedicalIdModal(true)}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-2 group ${
              isDarkMode
                ? 'bg-slate-900/60 border-slate-700/80 hover:border-rose-500/70'
                : 'bg-rose-50/50 border-rose-100 hover:border-rose-300 hover:bg-rose-50/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
                <span className="material-symbols-outlined text-[20px]">id_card</span>
                <span>Wallet Medical ID</span>
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                isDarkMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-rose-100 text-rose-800 border-rose-200'
              }`}>
                Printable
              </span>
            </div>
            <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Pocket-sized first-responder card with blood type ({currentUser.profile.bloodType || 'O+'}), critical drug allergies, emergency contacts, and active prescriptions.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setShowPharmacyModal(true)}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-2 group ${
              isDarkMode
                ? 'bg-slate-900/60 border-slate-700/80 hover:border-teal-500/70'
                : 'bg-teal-50/50 border-teal-100 hover:border-teal-300 hover:bg-teal-50/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-xs">
                <span className="material-symbols-outlined text-[20px]">local_pharmacy</span>
                <span>Pharmacy &amp; Refills</span>
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                isDarkMode ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' : 'bg-teal-100 text-teal-800 border-teal-200'
              }`}>
                1-Tap Dial
              </span>
            </div>
            <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Directly call {currentUser.profile.preferredPharmacy?.name || 'your pharmacy'}, copy Rx numbers, and log medication refills.
            </p>
          </button>
        </div>
      </div>

      {/* Compliance, Privacy & Emergency Policies */}
      <div
        className={`p-6 rounded-3xl border flex flex-col gap-3 shadow-sm font-serif ${
          isDarkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/90 border-indigo-100 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500 text-[22px]">policy</span>
          <div>
            <h3 className={`font-bold text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Compliance, Privacy & Emergency Guides</h3>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Google Play policy disclosures and safety resources</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
              isDarkMode
                ? 'bg-slate-900/60 border-slate-700/80 hover:border-indigo-500'
                : 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50/80'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-600 dark:text-indigo-400">
              <span className="material-symbols-outlined text-[16px]">privacy_tip</span>
              <span>Privacy Policy</span>
            </div>
            <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Data retention, consent & rights</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEmergencyModal(true)}
            className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
              isDarkMode
                ? 'bg-slate-900/60 border-slate-700/80 hover:border-rose-500'
                : 'bg-rose-50/50 border-rose-100 hover:border-rose-300 hover:bg-rose-50/80'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-rose-500">
              <span className="material-symbols-outlined text-[16px]">medical_services</span>
              <span>Emergency Guide</span>
            </div>
            <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Overdose protocol & poison control</span>
          </button>

          <a
            href="/account-deletion.html"
            target="_blank"
            rel="noopener noreferrer"
            className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
              isDarkMode
                ? 'bg-slate-900/60 border-slate-700/80 hover:border-amber-500'
                : 'bg-amber-50/50 border-amber-100 hover:border-amber-300 hover:bg-amber-50/80'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              <span>Deletion Portal</span>
            </div>
            <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Play Store web deletion URL</span>
          </a>
        </div>
      </div>

      {/* Senior Accessibility & Visual Theme */}
      <div
        className={`p-6 rounded-3xl border flex flex-col gap-4 shadow-sm font-serif ${
          isDarkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/90 border-indigo-100 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500 text-[22px]">
            accessibility_new
          </span>
          <div>
            <h3 className={`font-bold text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Accessibility &amp; Display</h3>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>High-contrast visuals and senior-optimized audio</p>
          </div>
        </div>

        {/* Senior Vision & Large Text Toggle */}
        <label className={`flex items-center justify-between cursor-pointer py-1 border-t ${isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'}`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Senior Vision &amp; Large Text Mode</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                isDarkMode ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                Recommended
              </span>
            </div>
            <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Enlarges typography, thickens borders, and expands touch targets for easy viewing
            </span>
          </div>
          <input
            type="checkbox"
            checked={isSeniorMode}
            onChange={(e) => {
              if (setIsSeniorMode) {
                setIsSeniorMode(e.target.checked);
              }
              handleUpdateSetting('seniorVisionMode', e.target.checked);
            }}
            className="w-5 h-5 accent-indigo-600 rounded"
          />
        </label>

        {/* Display Mode (Light / Dark) */}
        <div className={`flex items-center justify-between py-1 border-t ${isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'}`}>
          <div>
            <span className={`font-bold text-sm block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Visual Theme</span>
            <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Switch between dark twilight or pastel serene mode</span>
          </div>
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
            <span>{isDarkMode ? 'Pastel Light Mode' : 'Twilight Dark Mode'}</span>
          </button>
        </div>

        {/* Voice Cadence Test */}
        <div className={`flex items-center justify-between py-1 border-t ${isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'}`}>
          <div>
            <span className={`font-bold text-sm block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Speech Cadence Test</span>
            <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Paced at 0.88x speed for clear senior auditory comprehension
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              speakText(
                `Hello ${currentUser.profile.firstName}! This is DoseEase clear senior voice cadence. All your reminders are synchronized and secure.`
              );
              showToast('Speaking Voice Test', 'Testing senior-optimized audio speech cadence.', 'info');
            }}
            className={`px-3.5 py-2 rounded-2xl font-bold text-xs flex items-center gap-1.5 border transition-all ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
            <span>Test Voice</span>
          </button>
        </div>
      </div>

      {/* Data Portability & Emergency Backup */}
      <div
        className={`p-6 rounded-3xl border flex flex-col gap-4 shadow-sm font-serif ${
          isDarkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/90 border-indigo-100 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-teal-500 text-[22px]">
            cloud_sync
          </span>
          <div>
            <h3 className={`font-bold text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Data Portability &amp; Backup</h3>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Zero vendor lock-in: export or restore your full medical profile anytime
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportBackup}
            className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
              isDarkMode
                ? 'bg-slate-900/70 border-slate-700/80 hover:border-teal-500'
                : 'bg-teal-50/50 border-teal-100 hover:border-teal-300 hover:bg-teal-50/80'
            }`}
          >
            <span className="material-symbols-outlined text-teal-500 text-[24px] shrink-0 mt-0.5">
              download
            </span>
            <div>
              <strong className={`block text-xs sm:text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Export Full Backup (.json)
              </strong>
              <span className={`text-[11px] block mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Download all medications, refill inventory, history logs, and caregiver links to your device.
              </span>
            </div>
          </button>

          <label className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
            isDarkMode
              ? 'bg-slate-900/70 border-slate-700/80 hover:border-indigo-500'
              : 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50/80'
          }`}>
            <span className="material-symbols-outlined text-indigo-500 text-[24px] shrink-0 mt-0.5">
              upload_file
            </span>
            <div>
              <strong className={`block text-xs sm:text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Restore from Backup (.json)
              </strong>
              <span className={`text-[11px] block mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Migrate or restore records when changing phones or recovering saved offline data.
              </span>
            </div>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
        </div>

        {/* Project ZIP Archive Download */}
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          isDarkMode ? 'bg-slate-900/40 border-slate-700/70' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/15 text-indigo-500 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">folder_zip</span>
            </div>
            <div>
              <strong className={`block text-xs sm:text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Project Source Code Archive (.zip)
              </strong>
              <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Complete repository files including React frontend, Express server, and styles.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              try {
                const byteCharacters = atob(PROJECT_ZIP_BASE64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/zip' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'doseease-app.zip';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }, 200);
                showToast('Download Started', 'Project source ZIP downloaded to your computer.', 'success');
              } catch (err: any) {
                // Fallback to direct path
                window.location.href = '/doseease-app.zip';
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Download ZIP</span>
          </button>
        </div>
      </div>

      {/* Security & Data Isolation Statement */}
      <div className={`p-5 rounded-3xl border text-xs flex flex-col gap-2 font-serif ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-indigo-50/50 border-indigo-100 text-slate-600'
      }`}>
        <div className={`flex items-center gap-2 font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
          <span className="material-symbols-outlined text-[18px] text-indigo-500">shield</span>
          <span>Zero Data Leakage Guarantee</span>
        </div>
        <p>
          All your prescriptions, schedule times, and adherence logs are strictly partitioned by authenticated account credentials. Caregivers can only access records after explicit 6-digit code authorization, and access can be revoked instantly.
        </p>
      </div>

      {/* Logout & Delete Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2 font-serif">
        <button
          type="button"
          onClick={onLogout}
          className={`flex-1 min-h-[50px] rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
            isDarkMode
              ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
              : 'bg-white hover:bg-slate-50 text-slate-800 border-indigo-200 shadow-sm'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Log Out</span>
        </button>

        <button
          type="button"
          onClick={handleDeleteAccount}
          className="min-h-[50px] px-5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs flex items-center justify-center gap-1.5 border border-rose-500/30 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">delete_forever</span>
          <span>Delete Account</span>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-7 rounded-3xl max-w-md w-full flex flex-col gap-4 shadow-2xl border font-serif ${
            isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-indigo-100 text-slate-900'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Edit Profile</h3>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className={isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 98450 11223"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                  }`}
                />
              </div>

              <div className={`pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-indigo-100'}`}>
                <span className="block text-xs font-bold uppercase tracking-wider text-rose-500 mb-2">
                  Emergency Contact
                </span>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name (e.g. Family Member)"
                    value={editEmergName}
                    onChange={(e) => setEditEmergName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                    }`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Relation (e.g. Daughter)"
                      value={editEmergRel}
                      onChange={(e) => setEditEmergRel(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                      }`}
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={editEmergPhone}
                      onChange={(e) => setEditEmergPhone(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${
                    isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        isDarkMode={isDarkMode}
      />

      {/* Emergency Guide Modal */}
      <EmergencyGuideModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        onOpenMedicalId={() => setShowMedicalIdModal(true)}
      />

      {/* Wallet Emergency Medical ID Modal */}
      <MedicalIdModal
        isOpen={showMedicalIdModal}
        onClose={() => setShowMedicalIdModal(false)}
        currentUser={currentUser}
        medications={medications}
        onUpdateUser={(updated) => onUserUpdated(updated)}
        isDarkMode={isDarkMode}
        showToast={showToast}
      />

      {/* Pharmacy Refill Hub Modal */}
      <PharmacyRefillModal
        isOpen={showPharmacyModal}
        onClose={() => setShowPharmacyModal(false)}
        currentUser={currentUser}
        medications={medications}
        onRefillMedication={(medId, addedCount) => {
          refillMedication(currentUser.uid, medId, addedCount);
          setMedications(getMedications(currentUser.uid));
        }}
        onUpdateUser={(updated) => onUserUpdated(updated)}
        isDarkMode={isDarkMode}
        showToast={showToast}
      />
    </div>
  );
};
