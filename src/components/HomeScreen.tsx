import React, { useState, useEffect } from 'react';
import { AuthUser, MedicationLog, Medication, DoseStatus } from '../types';
import {
  getMedicationLogs,
  updateMedicationLog,
  getMedications,
  getTodayDateString,
  saveMedication,
  getUserSettings,
} from '../services/storage';
import {
  parseTimeToMinutes,
  sendBrowserNotification,
  speakDailyScheduleBriefing,
  stopSpeaking,
  isSpeechSupported,
} from '../services/notifications';
import { RetroactiveDoseModal } from './RetroactiveDoseModal';
import { MedicationReminderModal } from './MedicationReminderModal';
import { AddMedicineModal } from './AddMedicineModal';
import { EmergencyGuideModal } from './EmergencyGuideModal';
import { MedicalIdModal } from './MedicalIdModal';

interface HomeScreenProps {
  currentUser: AuthUser;
  isDarkMode: boolean;
  onNavigateTab: (tab: any) => void;
  showToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onUpdateUser?: (updatedUser: AuthUser) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentUser,
  isDarkMode,
  onNavigateTab,
  showToast,
  onUpdateUser,
}) => {
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [medications, setMedications] = useState<Medication[]>(() =>
    getMedications(currentUser.uid)
  );
  const [selectedRetroactiveLog, setSelectedRetroactiveLog] = useState<MedicationLog | null>(null);
  const [activeReminderLog, setActiveReminderLog] = useState<MedicationLog | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showEmergencyGuide, setShowEmergencyGuide] = useState(false);
  const [showMedicalIdModal, setShowMedicalIdModal] = useState(false);
  const [isSpeakingBriefing, setIsSpeakingBriefing] = useState(false);

  // Time-of-day greeting
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const refreshLogs = () => {
    const todayLogs = getMedicationLogs(currentUser.uid, getTodayDateString());
    setLogs(todayLogs);
    setMedications(getMedications(currentUser.uid));
  };

  useEffect(() => {
    refreshLogs();
  }, [currentUser.uid]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Live Reminder & Overdue Tracking Engine
  useEffect(() => {
    const checkReminders = () => {
      const userSettings = getUserSettings(currentUser.uid);
      if (!userSettings.remindersEnabled) return;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const gracePeriod = userSettings.gracePeriodMinutes || 30;

      const currentLogs = getMedicationLogs(currentUser.uid, getTodayDateString());
      let updatedAny = false;

      for (const log of currentLogs) {
        const s = String(log.status).toUpperCase();
        if (s === 'TAKEN' || s === 'TAKEN_LATER' || s === 'SKIPPED') {
          continue;
        }

        // If snoozed, check if snooze window has expired
        if (s === 'SNOOZED' && log.snoozedUntil) {
          const snoozeTime = new Date(log.snoozedUntil).getTime();
          if (Date.now() < snoozeTime) {
            continue;
          }
        }

        const scheduledMinutes = parseTimeToMinutes(log.scheduledTime);
        if (scheduledMinutes === -1) continue;

        const diff = currentMinutes - scheduledMinutes;

        // Due Now window: 5 min before up to grace period after
        if (diff >= -5 && diff <= gracePeriod) {
          if (s !== 'DUE_NOW') {
            const updated: MedicationLog = {
              ...log,
              status: 'due_now',
              updatedAt: new Date().toISOString(),
            };
            updateMedicationLog(currentUser.uid, updated);
            updatedAny = true;
          }

          if (!activeReminderLog) {
            setActiveReminderLog(log);
            sendBrowserNotification(`Medication Reminder: ${log.medicationName}`, {
              body: `${log.dosage} scheduled for ${log.scheduledTime}. Tap to confirm.`,
            });
          }
        } else if (diff > gracePeriod) {
          // Exceeded grace period -> mark as pending confirmation
          if (s !== 'PENDING_CONFIRMATION' && s !== 'UNCONFIRMED') {
            const updated: MedicationLog = {
              ...log,
              status: 'pending_confirmation',
              updatedAt: new Date().toISOString(),
            };
            updateMedicationLog(currentUser.uid, updated);
            updatedAny = true;
          }
        }
      }

      if (updatedAny) {
        refreshLogs();
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 20000);
    return () => clearInterval(interval);
  }, [currentUser.uid, activeReminderLog]);

  // Handle Mark Taken On-Time
  const handleMarkTakenOnTime = (logId: string) => {
    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const d = new Date();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const nowTime = `${hours}:${minutes} ${ampm}`;

    const updated: MedicationLog = {
      ...log,
      status: 'taken',
      actualRecordedTime: nowTime,
      confirmationMethod: 'on_time_button',
      updatedAt: new Date().toISOString(),
    };

    updateMedicationLog(currentUser.uid, updated);
    refreshLogs();
    showToast('Dose Confirmed Taken', `${log.medicationName} confirmed at ${nowTime}!`, 'success');
  };

  // Handle Mark Skipped
  const handleMarkSkipped = (logId: string) => {
    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const updated: MedicationLog = {
      ...log,
      status: 'skipped',
      confirmationMethod: 'on_time_button',
      updatedAt: new Date().toISOString(),
    };

    updateMedicationLog(currentUser.uid, updated);
    refreshLogs();
    showToast('Dose Skipped', `${log.medicationName} was marked skipped.`, 'info');
  };

  // Handle Retroactive confirmation (User took medicine without logging it)
  const handleConfirmRetroactive = (logId: string, actualTime: string) => {
    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const updated: MedicationLog = {
      ...log,
      status: 'taken',
      actualRecordedTime: actualTime,
      confirmationMethod: 'manual_later',
      updatedAt: new Date().toISOString(),
    };

    updateMedicationLog(currentUser.uid, updated);
    refreshLogs();
    showToast(
      'Manual Confirmation Recorded',
      `${log.medicationName} recorded taken at ${actualTime}.`,
      'success'
    );
  };

  const handleSnooze = (logId: string, durationMinutes = 10) => {
    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const snoozedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const updated: MedicationLog = {
      ...log,
      status: 'snoozed',
      snoozedUntil,
      updatedAt: new Date().toISOString(),
    };

    updateMedicationLog(currentUser.uid, updated);
    refreshLogs();
    setActiveReminderLog(null);
    showToast(
      'Reminder Snoozed',
      `${log.medicationName} snoozed for ${durationMinutes} minutes.`,
      'info'
    );
  };

  const handleRemindLater = (logId: string) => {
    showToast('Check-In Postponed', 'We will prompt you again shortly.', 'info');
  };

  // Save new medicine
  const handleSaveMedication = (med: Medication) => {
    saveMedication(currentUser.uid, med);
    refreshLogs();
    showToast('Medicine Scheduled', `${med.name} added to your daily plan.`);
  };

  // Progress metrics
  const confirmedCount = logs.filter((l) => {
    const s = String(l.status).toUpperCase();
    return s === 'TAKEN' || s === 'TAKEN_LATER';
  }).length;
  const totalCount = logs.length;
  const progressPercent = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;

  // Next upcoming medicine
  const nextUpcomingLog = logs.find((l) => {
    const s = String(l.status).toUpperCase();
    return s !== 'TAKEN' && s !== 'TAKEN_LATER' && s !== 'SKIPPED';
  });

  // Check if any medication is pending confirmation
  const pendingLogs = logs.filter((l) => {
    const s = String(l.status).toUpperCase();
    return s === 'PENDING_CONFIRMATION' || s === 'UNCONFIRMED';
  });

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Top Senior-Friendly Executive Greeting Card */}
      <div
        className={`p-6 rounded-3xl border shadow-2xl relative overflow-hidden transition-all ${
          isDarkMode
            ? 'bg-gradient-to-br from-[#0b1329]/95 via-[#080e1e]/95 to-[#040812] border-indigo-950/90 shadow-black/60 ring-1 ring-white/10'
            : 'bg-gradient-to-br from-white/90 via-indigo-50/70 to-rose-50/60 border-indigo-100 shadow-xl shadow-indigo-100/50 ring-1 ring-indigo-200/50'
        }`}
      >
        {/* Subtle classic Rx watermark */}
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
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-amber-400' : 'bg-amber-500'}`} />
              <span
                className={`text-xs font-serif font-bold uppercase tracking-widest ${
                  isDarkMode ? 'text-amber-300' : 'text-indigo-800'
                }`}
              >
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <h1
              className={`text-3xl sm:text-4xl font-bold tracking-wide mt-0.5 font-serif ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {getGreeting()}, {currentUser.profile.firstName}!
            </h1>
            <p
              className={`text-sm sm:text-base mt-1 font-serif ${
                isDarkMode ? 'opacity-80 text-slate-300' : 'text-slate-600'
              }`}
            >
              Clinical daily medication schedule &amp; verified intake ledger.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setShowMedicalIdModal(true)}
              className={`min-h-[44px] px-3.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm font-serif ${
                isDarkMode
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40'
                  : 'bg-rose-100/80 hover:bg-rose-200/80 text-rose-800 border border-rose-200'
              }`}
              title="Wallet Emergency Medical ID Card"
            >
              <span className="material-symbols-outlined text-[18px]">id_card</span>
              <span>Medical ID</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEmergencyGuide(true)}
              className={`min-h-[44px] px-3.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm font-serif ${
                isDarkMode
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40'
                  : 'bg-amber-100/80 hover:bg-amber-200/80 text-amber-900 border border-amber-200'
              }`}
              title="Emergency & Overdose Help"
            >
              <span className="material-symbols-outlined text-[18px]">e911_emergency</span>
              <span>Emergency Help</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="min-h-[44px] px-4 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-indigo-950/60 border border-indigo-400/30 active:scale-[0.98] font-serif"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>+ Add Medicine</span>
            </button>
          </div>
        </div>
      </div>

      {/* Voice Schedule Briefing & Accessibility Audio Bar */}
      <div
        className={`p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md transition-all ${
          isSpeakingBriefing
            ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200 ring-2 ring-indigo-500/30'
            : isDarkMode
            ? 'bg-slate-800/60 border-slate-700/80 text-slate-200'
            : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all ${
              isSpeakingBriefing
                ? 'bg-indigo-600 text-white animate-pulse'
                : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">
              {isSpeakingBriefing ? 'volume_up' : 'campaign'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-sm font-black">
                {isSpeakingBriefing ? 'Reading Today’s Schedule Aloud...' : 'Voice Schedule Briefing'}
              </strong>
              {isSpeakingBriefing && (
                <span className="flex items-center gap-1 text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Speaking
                </span>
              )}
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              Listen to a clear spoken briefing of all your scheduled medicines and meal instructions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {isSpeakingBriefing ? (
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setIsSpeakingBriefing(false);
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">stop_circle</span>
              <span>Stop Voice</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!isSpeechSupported()) {
                  showToast(
                    'Voice Unavailable',
                    'Speech synthesis is not supported in this browser.',
                    'warning'
                  );
                  return;
                }
                setIsSpeakingBriefing(true);
                speakDailyScheduleBriefing(currentUser.profile.firstName, logs, () => {
                  setIsSpeakingBriefing(false);
                });
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/25 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">volume_up</span>
              <span>Read Aloud</span>
            </button>
          )}
        </div>
      </div>

      {/* Health App Compliance & Medical Disclaimer Banner */}
      <div
        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
          isDarkMode
            ? 'bg-slate-900/60 border-slate-800 text-slate-400'
            : 'bg-white border-slate-200 text-slate-600'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-400 text-[18px] shrink-0">
            health_and_safety
          </span>
          <span>
            <strong>Medical Notice:</strong> DoseEase organizes reminders and does not replace advice from a doctor or pharmacist.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowEmergencyGuide(true)}
          className="text-indigo-400 hover:underline font-bold shrink-0 text-[11px]"
        >
          Safety Guide
        </button>
      </div>

      {/* Low Stock / Refill Alert Banner */}
      {medications.some(
        (m) =>
          typeof m.currentPillsRemaining === 'number' &&
          m.currentPillsRemaining <= (m.refillReminderThreshold ?? 5)
      ) && (
        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-amber-400 text-[20px] shrink-0">
              production_quantity_limits
            </span>
            <span className="text-xs font-semibold">
              <strong>Refill Notice:</strong> One or more of your medications is low on pills.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('medicines')}
            className="text-xs font-extrabold text-amber-300 hover:underline shrink-0"
          >
            Manage Refills →
          </button>
        </div>
      )}

      {/* Today's Progress Card */}
      <div
        className={`p-6 rounded-3xl border shadow-lg ${
          isDarkMode
            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/80 shadow-black/40'
            : 'bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/70 border-indigo-100 shadow-indigo-100/50'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-[24px] ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>task_alt</span>
            <span className={`text-xs sm:text-sm font-bold uppercase tracking-wider font-serif ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Today's Medication Progress
            </span>
          </div>
          <span className={`text-sm sm:text-base font-bold font-serif ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
            {confirmedCount} of {totalCount} confirmed
          </span>
        </div>

        {/* Big accessible Progress Bar */}
        <div className={`w-full h-4 rounded-full overflow-hidden border p-0.5 ${
          isDarkMode ? 'bg-slate-900/60 border-slate-700/60' : 'bg-indigo-100/80 border-indigo-200/60'
        }`}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className={`flex justify-between items-center mt-3 text-xs font-serif ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          <span>
            {totalCount === 0
              ? 'No medicines scheduled today.'
              : progressPercent === 100
              ? 'All medicines confirmed for today! Excellent work.'
              : `${totalCount - confirmedCount} dose(s) remaining today.`}
          </span>
          <span className={`font-bold font-serif ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>{progressPercent}% complete</span>
        </div>
      </div>

      {/* Pending Confirmation Check-In Prompt */}
      {pendingLogs.length > 0 && (
        <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg ${
          isDarkMode
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
            : 'bg-amber-50/90 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[28px] text-amber-500 shrink-0 mt-0.5">help</span>
            <div>
              <h3 className={`font-bold text-base leading-tight font-serif ${isDarkMode ? 'text-amber-300' : 'text-amber-950'}`}>
                Did you already take your scheduled medicine?
              </h3>
              <p className={`text-xs mt-0.5 font-serif ${isDarkMode ? 'text-amber-200/80' : 'text-amber-900/80'}`}>
                {pendingLogs[0].medicationName} was scheduled for {pendingLogs[0].scheduledTime}. We never assume you missed it.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedRetroactiveLog(pendingLogs[0])}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md active:scale-[0.98] font-serif"
            >
              Record Taken Time
            </button>
            <button
              type="button"
              onClick={() => handleMarkSkipped(pendingLogs[0].id)}
              className={`px-3 py-2.5 rounded-2xl border text-xs font-bold font-serif ${
                isDarkMode
                  ? 'bg-slate-900/60 text-slate-300 hover:text-white border-slate-700'
                  : 'bg-white/80 text-slate-700 hover:text-slate-900 border-amber-200'
              }`}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Next Upcoming Medicine Card */}
      {nextUpcomingLog && (
        <div
          className={`p-5 rounded-3xl border shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isDarkMode
              ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-100'
              : 'bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-pink-50/40 border-indigo-200/80 text-indigo-950 shadow-md shadow-indigo-100/40'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30">
              <span className="material-symbols-outlined text-[26px]">alarm</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider font-serif ${
                  isDarkMode ? 'text-indigo-400' : 'text-indigo-700'
                }`}>
                  Next Upcoming Dose
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-serif ${
                  isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {nextUpcomingLog.scheduledTime}
                </span>
              </div>
              <h3 className={`text-xl font-bold mt-0.5 font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {nextUpcomingLog.medicationName}
              </h3>
              <p className={`text-xs mt-0.5 font-serif ${isDarkMode ? 'text-indigo-200/80' : 'text-slate-600'}`}>
                {nextUpcomingLog.dosage}
                {nextUpcomingLog.mealTiming ? ` • ${nextUpcomingLog.mealTiming.replace('_', ' ')}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleMarkTakenOnTime(nextUpcomingLog.id)}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md flex items-center gap-1.5 active:scale-[0.98] font-serif"
            >
              <span className="material-symbols-outlined text-[18px]">check</span>
              <span>Take Now</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRetroactiveLog(nextUpcomingLog)}
              className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold font-serif ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-indigo-50 text-indigo-900 border-indigo-200 shadow-sm'
              }`}
            >
              I already took it
            </button>
          </div>
        </div>
      )}

      {/* Today's Medicines List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className={`text-lg sm:text-xl font-bold tracking-wide font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Today's Schedule
          </h2>
          <span className={`text-xs font-serif ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            {logs.length} scheduled dose{logs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {logs.length === 0 ? (
          <div
            className={`p-8 rounded-3xl border text-center ${
              isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[40px] text-slate-500 mb-2">medication</span>
            <h3 className="font-bold text-lg text-slate-200">No Prescriptions Scheduled</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Add your daily routine to start receiving timely alerts and automatic caregiver tracking.
            </p>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold"
            >
              + Add Medicine Now
            </button>
          </div>
        ) : (
          logs.map((log) => {
            const med = medications.find((m) => m.id === log.medicationId);
            const s = String(log.status).toUpperCase();
            const isTaken = s === 'TAKEN' || s === 'TAKEN_LATER';
            const isSkipped = s === 'SKIPPED';
            const isDueNow = s === 'DUE_NOW';
            const isPending = s === 'PENDING_CONFIRMATION' || s === 'UNCONFIRMED';
            const isSnoozed = s === 'SNOOZED';
            const hasInventory = typeof med?.currentPillsRemaining === 'number';
            const isLowSupply = hasInventory && (med?.currentPillsRemaining ?? 0) <= (med?.refillReminderThreshold ?? 5);

            return (
              <div
                key={log.id}
                className={`p-5 sm:p-6 rounded-3xl border transition-all duration-200 flex flex-col gap-4 ${
                  isTaken
                    ? isDarkMode
                      ? 'bg-slate-800/40 border-emerald-500/30 shadow-sm'
                      : 'bg-emerald-50/70 border-emerald-200/80 shadow-sm'
                    : isDueNow
                    ? isDarkMode
                      ? 'bg-amber-950/30 border-amber-500/50 shadow-md ring-1 ring-amber-400/20'
                      : 'bg-amber-50/90 border-amber-300 shadow-md ring-2 ring-amber-300/40'
                    : isPending
                    ? isDarkMode
                      ? 'bg-slate-800/90 border-amber-500/40 shadow-sm'
                      : 'bg-amber-50/70 border-amber-200 shadow-sm'
                    : isDarkMode
                    ? 'bg-slate-800/70 border-slate-700 shadow-md shadow-black/20'
                    : 'bg-white/90 border-indigo-100 shadow-md shadow-indigo-100/40'
                }`}
              >
                {/* Medicine Main Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    {/* Status Icon */}
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold shrink-0 border ${
                        isTaken
                          ? isDarkMode
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          : isSkipped
                          ? isDarkMode
                            ? 'bg-slate-800 text-slate-500 border-slate-700'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                          : isDueNow
                          ? isDarkMode
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                            : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                          : isPending
                          ? isDarkMode
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-amber-100/80 text-amber-800 border-amber-300'
                          : isDarkMode
                          ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                          : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[30px]">
                        {isTaken
                          ? 'check_circle'
                          : isSkipped
                          ? 'cancel'
                          : isDueNow
                          ? 'alarm'
                          : isPending
                          ? 'help'
                          : 'medication'}
                      </span>
                    </div>

                    {/* Information */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-xl sm:text-2xl font-bold leading-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {log.medicationName}
                        </h3>

                        {/* Visual Pill Badge */}
                        {med?.pillColor && (
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-400/40 shadow-sm"
                            style={{
                              backgroundColor:
                                med.pillColor === 'White'
                                  ? '#f8fafc'
                                  : med.pillColor === 'Blue'
                                  ? '#38bdf8'
                                  : med.pillColor === 'Yellow'
                                  ? '#facc15'
                                  : med.pillColor === 'Pink'
                                  ? '#f472b6'
                                  : med.pillColor === 'Red'
                                  ? '#f87171'
                                  : med.pillColor === 'Orange'
                                  ? '#fb923c'
                                  : med.pillColor === 'Green'
                                  ? '#4ade80'
                                  : '#c084fc',
                              color: med.pillColor === 'White' || med.pillColor === 'Yellow' ? '#0f172a' : '#ffffff',
                            }}
                          >
                            {med.pillColor} {med.pillShape || ''}
                          </span>
                        )}

                        {/* Status Badge */}
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border font-serif ${
                            isTaken
                              ? isDarkMode
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : isSkipped
                              ? isDarkMode
                                ? 'bg-slate-800 text-slate-400 border-slate-700'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                              : isDueNow
                              ? isDarkMode
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                              : isPending
                              ? isDarkMode
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-amber-100 text-amber-900 border-amber-200'
                              : isSnoozed
                              ? isDarkMode
                                ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                                : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                              : isDarkMode
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {s === 'TAKEN'
                            ? 'Confirmed Taken'
                            : s === 'TAKEN_LATER'
                            ? 'Taken (Later)'
                            : s === 'SKIPPED'
                            ? 'Skipped'
                            : s === 'DUE_NOW'
                            ? 'Due Now'
                            : s === 'PENDING_CONFIRMATION'
                            ? 'Pending Confirmation'
                            : s === 'UNCONFIRMED'
                            ? 'Unconfirmed'
                            : s === 'SNOOZED'
                            ? 'Snoozed'
                            : 'Upcoming'}
                        </span>
                      </div>

                      <p className={`text-sm sm:text-base font-serif font-medium mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {log.dosage}
                      </p>

                      {/* Scheduled Time, Food Timing & Inventory */}
                      <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs font-bold font-serif">
                        <span className={`px-3 py-1 rounded-xl border flex items-center gap-1.5 ${
                          isDarkMode
                            ? 'text-slate-300 bg-slate-900/80 border-slate-700'
                            : 'text-indigo-900 bg-indigo-50/90 border-indigo-200'
                        }`}>
                          <span className="material-symbols-outlined text-[16px] text-indigo-500">
                            schedule
                          </span>
                          <span>Scheduled: {log.scheduledTime}</span>
                        </span>

                        {log.mealTiming && (
                          <span className={`px-3 py-1 rounded-xl border capitalize flex items-center gap-1 ${
                            isDarkMode
                              ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                              : 'text-amber-900 bg-amber-100/70 border-amber-200'
                          }`}>
                            <span className="material-symbols-outlined text-[16px]">restaurant</span>
                            <span>{log.mealTiming.replace('_', ' ')}</span>
                          </span>
                        )}

                        {hasInventory && (
                          <span
                            className={`px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                              isLowSupply
                                ? isDarkMode
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
                                  : 'bg-amber-100 border-amber-300 text-amber-900 animate-pulse'
                                : isDarkMode
                                ? 'bg-slate-900/80 border-slate-700 text-slate-400'
                                : 'bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              {isLowSupply ? 'production_quantity_limits' : 'inventory_2'}
                            </span>
                            <span>
                              {med?.currentPillsRemaining} pills remaining{isLowSupply ? ' (Low)' : ''}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Actual Taken Details if Confirmed */}
                      {isTaken && (
                        <div className={`mt-2.5 text-xs font-bold flex items-center gap-1.5 font-serif ${
                          isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                        }`}>
                          <span className="material-symbols-outlined text-[16px]">check</span>
                          <span>
                            Taken at {log.actualRecordedTime || log.scheduledTime} (
                            {log.confirmationMethod === 'manual_later' || log.recordingMethod === 'retroactive'
                              ? 'Manual confirmation'
                              : 'Confirmed on-time'}
                            )
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Senior Action Buttons */}
                {!isTaken && !isSkipped && (
                  <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t ${
                    isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'
                  }`}>
                    <button
                      type="button"
                      onClick={() => handleMarkTakenOnTime(log.id)}
                      className="min-h-[50px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98] font-serif"
                    >
                      <span className="material-symbols-outlined text-[24px]">check</span>
                      <span>TAKEN</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRetroactiveLog(log)}
                      className={`min-h-[50px] rounded-2xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all font-serif ${
                        isDarkMode
                          ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                          : 'bg-indigo-50/90 hover:bg-indigo-100 border-indigo-200 text-indigo-900'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] text-indigo-500">edit_calendar</span>
                      <span>I already took it</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMarkSkipped(log.id)}
                      className={`min-h-[50px] rounded-2xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all font-serif ${
                        isDarkMode
                          ? 'bg-slate-900 hover:bg-slate-800 border-slate-700/60 text-slate-400 hover:text-slate-200'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                      <span>Skip Dose</span>
                    </button>
                  </div>
                )}

                {/* If already taken: allow adjust/edit */}
                {isTaken && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedRetroactiveLog(log)}
                      className="text-xs font-bold text-slate-400 hover:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      <span>Adjust recorded time</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Retroactive Dose Modal */}
      <RetroactiveDoseModal
        isOpen={!!selectedRetroactiveLog}
        log={selectedRetroactiveLog}
        onClose={() => setSelectedRetroactiveLog(null)}
        onConfirmTaken={handleConfirmRetroactive}
        onConfirmSkipped={handleMarkSkipped}
        onRemindLater={handleRemindLater}
        isDarkMode={isDarkMode}
      />

      {/* Real-time Reminder Modal */}
      <MedicationReminderModal
        isOpen={!!activeReminderLog}
        log={activeReminderLog}
        onClose={() => setActiveReminderLog(null)}
        onTaken={handleMarkTakenOnTime}
        onSnooze={handleSnooze}
        onSkip={handleMarkSkipped}
        onTookEarlier={(log) => setSelectedRetroactiveLog(log)}
        isDarkMode={isDarkMode}
      />

      {/* Add Medicine Modal */}
      <AddMedicineModal
        isOpen={isAddModalOpen}
        editingMedication={null}
        existingMedications={medications}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveMedication}
        userId={currentUser.uid}
        isDarkMode={isDarkMode}
      />

      {/* Emergency Overdose & Safety Guide Modal */}
      <EmergencyGuideModal
        isOpen={showEmergencyGuide}
        onClose={() => setShowEmergencyGuide(false)}
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
        onUpdateUser={onUpdateUser}
        isDarkMode={isDarkMode}
        showToast={showToast}
      />
    </div>
  );
};
