import React, { useState, useMemo } from 'react';
import { AuthUser, MedicationLog, Medication, DoseStatus } from '../types';
import {
  getMedicationLogs,
  updateMedicationLog,
  getMedications,
  getTodayDateString,
  formatLocalDate,
  isMedicationScheduledOnDate,
} from '../services/storage';
import { RetroactiveDoseModal } from './RetroactiveDoseModal';
import { DoctorReportModal } from './DoctorReportModal';

interface HistoryScreenProps {
  currentUser: AuthUser;
  isDarkMode: boolean;
  showToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  currentUser,
  isDarkMode,
  showToast,
}) => {
  const today = getTodayDateString();

  // Helper for yesterday
  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatLocalDate(d);
  };

  const yesterday = getYesterdayString();

  // Navigation tab for history view
  const [activeTab, setActiveTab] = useState<'calendar' | 'today' | 'yesterday' | '7days' | '30days'>('calendar');

  // Calendar State (year and month 0-indexed in local time)
  const initialDate = new Date();
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0 = Jan, 8 = Sep
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Correction & Retroactive Modal states
  const [editingLog, setEditingLog] = useState<MedicationLog | null>(null);
  const [newStatus, setNewStatus] = useState<'taken' | 'skipped'>('taken');
  const [newTime, setNewTime] = useState('');
  const [retroactiveLog, setRetroactiveLog] = useState<MedicationLog | null>(null);
  const [isDoctorReportOpen, setIsDoctorReportOpen] = useState(false);

  // Force re-render state trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch all user medications
  const userMedications = useMemo(() => {
    return getMedications(currentUser.uid);
  }, [currentUser.uid, refreshKey]);

  // Calendar month days calculation (handles leap years, year transitions, month lengths)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate(); // Leap-year safe!

    // Sunday is 0, Monday is 1, ..., Saturday is 6
    // Shift so Monday is index 0 (0=Mon, 1=Tue, ..., 6=Sun)
    let startDayOffset = firstDayOfMonth.getDay() - 1;
    if (startDayOffset < 0) startDayOffset = 6;

    const days = [];
    // Leading empty padding days
    for (let i = 0; i < startDayOffset; i++) {
      days.push(null);
    }
    // Actual days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonth, d);
      const dateStr = formatLocalDate(dateObj);

      // Count scheduled medications for this day
      let scheduledCount = 0;
      userMedications.forEach((med) => {
        if (isMedicationScheduledOnDate(med, dateStr)) {
          scheduledCount += (med.scheduledTimes?.length || 1);
        }
      });

      days.push({
        dayNumber: d,
        dateStr,
        scheduledCount,
        isToday: dateStr === today,
        isSelected: dateStr === selectedDate,
      });
    }

    return days;
  }, [currentYear, currentMonth, selectedDate, userMedications, today]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(today);
  };

  // Selected Date Schedule & Logs
  const selectedDateLogs = useMemo(() => {
    return getMedicationLogs(currentUser.uid, selectedDate);
  }, [currentUser.uid, selectedDate, refreshKey]);

  // Multi-day filtered logs for 7days and 30days
  const allLogs = useMemo(() => {
    return getMedicationLogs(currentUser.uid);
  }, [currentUser.uid, refreshKey]);

  const rangeFilteredLogs = useMemo(() => {
    if (activeTab === 'today') {
      return getMedicationLogs(currentUser.uid, today);
    }
    if (activeTab === 'yesterday') {
      return getMedicationLogs(currentUser.uid, yesterday);
    }
    if (activeTab === '7days') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      return allLogs.filter((l) => new Date(l.date) >= past7);
    }
    if (activeTab === '30days') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      return allLogs.filter((l) => new Date(l.date) >= past30);
    }
    return [];
  }, [activeTab, allLogs, currentUser.uid, today, yesterday]);

  // Mark Dose Taken On-Time
  const handleMarkTaken = (log: MedicationLog) => {
    const d = new Date();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const nowTime = `${hours}:${minutes} ${ampm}`;

    const updated: MedicationLog = {
      ...log,
      status: 'TAKEN',
      actualRecordedTime: nowTime,
      actualTakenAt: new Date().toISOString(),
      confirmationMethod: 'on_time_button',
      recordingMethod: 'on_time',
      updatedAt: new Date().toISOString(),
    };

    updateMedicationLog(currentUser.uid, updated);
    setRefreshKey((k) => k + 1);
    showToast('Dose Confirmed', `${log.medicationName} confirmed taken at ${nowTime}!`, 'success');
  };

  // Mark Dose Skipped
  const handleMarkSkipped = (log: MedicationLog) => {
    const updated: MedicationLog = {
      ...log,
      status: 'SKIPPED',
      confirmationMethod: 'on_time_button',
      updatedAt: new Date().toISOString(),
    };

    updateMedicationLog(currentUser.uid, updated);
    setRefreshKey((k) => k + 1);
    showToast('Dose Skipped', `${log.medicationName} marked skipped.`, 'info');
  };

  // Handle Retroactive Confirmation ("I already took it")
  const handleConfirmRetroactive = (logId: string, actualTime: string) => {
    const log = selectedDateLogs.find((l) => l.id === logId) || allLogs.find((l) => l.id === logId);
    if (!log) return;

    const updated: MedicationLog = {
      ...log,
      status: 'TAKEN_LATER',
      actualRecordedTime: actualTime,
      actualTakenAt: new Date().toISOString(),
      confirmationMethod: 'manual_later',
      recordingMethod: 'retroactive',
      updatedAt: new Date().toISOString(),
    };

    updateMedicationLog(currentUser.uid, updated);
    setRefreshKey((k) => k + 1);
    showToast('Record Updated', `${log.medicationName} recorded taken at ${actualTime}.`, 'success');
  };

  // Open Edit/Correction Modal
  const handleOpenCorrection = (log: MedicationLog) => {
    setEditingLog(log);
    const s = String(log.status).toUpperCase();
    setNewStatus(s === 'SKIPPED' ? 'skipped' : 'taken');
    setNewTime(log.actualRecordedTime || log.scheduledTime);
  };

  // Save manual correction
  const handleSaveCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    const updated: MedicationLog = {
      ...editingLog,
      status: newStatus === 'taken' ? 'TAKEN' : 'SKIPPED',
      actualRecordedTime: newStatus === 'taken' ? newTime : undefined,
      confirmationMethod: 'manual_later',
      recordingMethod: 'manual',
      updatedAt: new Date().toISOString(),
    };

    updateMedicationLog(currentUser.uid, updated);
    setEditingLog(null);
    setRefreshKey((k) => k + 1);
    showToast('Log Corrected', `Updated entry for ${updated.medicationName}.`, 'success');
  };

  // CSV Export handler
  const handleExportCSV = () => {
    try {
      const logsToExport =
        activeTab === 'calendar' || activeTab === 'today' || activeTab === 'yesterday'
          ? selectedDateLogs
          : rangeFilteredLogs;
      const targetLogs = logsToExport.length > 0 ? logsToExport : allLogs;

      if (targetLogs.length === 0) {
        showToast('No Data', 'No medication logs available to export.', 'info');
        return;
      }

      const headers = [
        'Date',
        'Scheduled Time',
        'Medication Name',
        'Dosage',
        'Status',
        'Actual Time Taken',
        'Confirmation Type',
      ];
      const rows = targetLogs.map((log) => [
        `"${log.date}"`,
        `"${log.scheduledTime}"`,
        `"${log.medicationName.replace(/"/g, '""')}"`,
        `"${log.dosage.replace(/"/g, '""')}"`,
        `"${String(log.status).toUpperCase()}"`,
        `"${log.actualRecordedTime || ''}"`,
        `"${log.confirmationMethod || 'on-time'}"`,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `doseease_history_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();

      showToast('CSV Exported', `Downloaded ${targetLogs.length} medication log entries.`, 'success');
    } catch {
      showToast('Export Error', 'Failed to export history CSV.', 'error');
    }
  };

  // Month Display Name
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Formatted Selected Date String
  const formattedSelectedDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDate]);

  // Helper for Status Badge
  const getStatusBadge = (status: DoseStatus) => {
    const s = String(status).toUpperCase();
    switch (s) {
      case 'TAKEN':
        return {
          label: 'TAKEN',
          bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          icon: 'check_circle',
        };
      case 'TAKEN_LATER':
        return {
          label: 'TAKEN (LATER)',
          bg: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
          icon: 'check',
        };
      case 'DUE_NOW':
        return {
          label: 'DUE NOW',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
          icon: 'alarm',
        };
      case 'PENDING_CONFIRMATION':
        return {
          label: 'PENDING CONFIRMATION',
          bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          icon: 'help',
        };
      case 'UNCONFIRMED':
        return {
          label: 'UNCONFIRMED',
          bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
          icon: 'contact_support',
        };
      case 'SNOOZED':
        return {
          label: 'SNOOZED',
          bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
          icon: 'snooze',
        };
      case 'SKIPPED':
        return {
          label: 'SKIPPED',
          bg: 'bg-slate-800 text-slate-400 border-slate-700',
          icon: 'cancel',
        };
      case 'UPCOMING':
      default:
        return {
          label: 'UPCOMING',
          bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          icon: 'schedule',
        };
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Top Executive Header Banner */}
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
              Medication Adherence &amp; Clinical Ledger
            </span>
            <h1 className={`text-2xl sm:text-3xl font-bold tracking-wide font-serif ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Calendar &amp; History
            </h1>
            <p className={`text-xs sm:text-sm mt-1 font-serif ${
              isDarkMode ? 'text-slate-300/80' : 'text-slate-600'
            }`}>
              Inspect scheduled doses, review past confirmations, or record doses you already took.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              className={`min-h-[42px] px-3.5 rounded-2xl border font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm font-serif ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-white'
                  : 'bg-indigo-50/90 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
              }`}
              title="Download structured CSV spreadsheet"
            >
              <span className="material-symbols-outlined text-[18px]">file_download</span>
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDoctorReportOpen(true)}
              className={`min-h-[42px] px-3.5 rounded-2xl border font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm font-serif ${
                isDarkMode
                  ? 'bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border-teal-500/40'
                  : 'bg-teal-100/80 hover:bg-teal-200/80 text-teal-800 border-teal-200'
              }`}
              title="Export or Print Clinical Adherence Report"
            >
              <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
              <span>Doctor's Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Range & View Tabs */}
      <div className={`flex items-center gap-1.5 p-1.5 rounded-2xl border overflow-x-auto ${
        isDarkMode ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/80 border-indigo-100 shadow-sm'
      }`}>
        {[
          { id: 'calendar', label: 'Calendar View' },
          { id: 'today', label: 'Today' },
          { id: 'yesterday', label: 'Yesterday' },
          { id: '7days', label: 'Last 7 Days' },
          { id: '30days', label: 'Last 30 Days' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'today') {
                handleJumpToToday();
              } else if (tab.id === 'yesterday') {
                setSelectedDate(yesterday);
              }
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap font-serif ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md'
                : isDarkMode
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-indigo-900 hover:bg-indigo-50/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: CALENDAR VIEW */}
      {(activeTab === 'calendar' || activeTab === 'today' || activeTab === 'yesterday') && (
        <div className="flex flex-col gap-6">
          {/* Interactive Monthly Calendar Card */}
          <div
            className={`p-5 sm:p-6 rounded-3xl border shadow-xl ${
              isDarkMode
                ? 'bg-slate-900/90 border-slate-800 shadow-black/40'
                : 'bg-white/90 border-indigo-100 shadow-lg shadow-indigo-100/40'
            }`}
          >
            {/* Calendar Controls Bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                    isDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                      : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900'
                  }`}
                  title="Previous month"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <h2 className={`text-base sm:text-lg font-bold px-2 font-serif ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  {monthName}
                </h2>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                    isDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                      : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900'
                  }`}
                  title="Next month"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleJumpToToday}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all font-serif ${
                  isDarkMode
                    ? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border-indigo-500/30'
                    : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-200'
                }`}
              >
                Today
              </button>
            </div>

            {/* Weekday Labels (Mon - Sun) */}
            <div className={`grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-bold uppercase tracking-wider font-serif ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarDays.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty_${idx}`} className="h-14 sm:h-16 rounded-2xl opacity-0" />;
                }

                const isSelected = cell.dateStr === selectedDate;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`h-14 sm:h-16 rounded-2xl flex flex-col items-center justify-between p-1.5 transition-all border relative font-serif ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 scale-[1.02] z-10'
                        : cell.isToday
                        ? isDarkMode
                          ? 'bg-slate-800/90 border-indigo-500 text-indigo-300 hover:bg-slate-700'
                          : 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
                        : isDarkMode
                        ? 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                        : 'bg-indigo-50/50 border-indigo-100/80 text-slate-800 hover:bg-indigo-100/60'
                    }`}
                  >
                    <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-white' : ''}`}>
                      {cell.dayNumber}
                    </span>

                    {/* Medication Occurrence Indicator */}
                    {cell.scheduledCount > 0 ? (
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-white text-indigo-700'
                            : isDarkMode
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                            : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                        }`}
                      >
                        {cell.scheduledCount} med{cell.scheduledCount > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 opacity-60">none</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Schedule Breakdown */}
          <div className="flex flex-col gap-4">
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-2xl border ${
              isDarkMode
                ? 'bg-slate-800/60 border-slate-700/80'
                : 'bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-rose-50/80 border-indigo-100 shadow-sm'
            }`}>
              <div>
                <span className={`text-[11px] font-bold uppercase tracking-wider block font-serif ${
                  isDarkMode ? 'text-indigo-400' : 'text-indigo-800'
                }`}>
                  Selected Date Schedule
                </span>
                <h3 className={`text-lg sm:text-xl font-bold font-serif ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  {formattedSelectedDate}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-serif ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-indigo-200 text-indigo-900 shadow-sm'
                }`}>
                  {selectedDateLogs.length} scheduled medicine{selectedDateLogs.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* List of Medications on Selected Date */}
            {selectedDateLogs.length === 0 ? (
              <div
                className={`p-8 rounded-3xl border text-center ${
                  isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-white/90 border-indigo-100 shadow-sm'
                }`}
              >
                <span className="material-symbols-outlined text-[40px] text-slate-400 mb-2">event_busy</span>
                <h4 className={`font-bold text-base font-serif ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  0 Scheduled Medicines
                </h4>
                <p className={`text-xs max-w-sm mx-auto mt-1 font-serif ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  No medications are scheduled for this date according to your frequency settings.
                </p>
              </div>
            ) : (
              selectedDateLogs.map((log) => {
                const s = String(log.status).toUpperCase();
                const isTaken = s === 'TAKEN' || s === 'TAKEN_LATER';
                const isSkipped = s === 'SKIPPED';
                const badge = getStatusBadge(log.status);

                return (
                  <div
                    key={log.id}
                    className={`p-5 rounded-3xl border transition-all flex flex-col gap-3.5 ${
                      isTaken
                        ? isDarkMode
                          ? 'bg-slate-800/40 border-emerald-500/30'
                          : 'bg-emerald-50/70 border-emerald-200 shadow-sm'
                        : isDarkMode
                        ? 'bg-slate-800/70 border-slate-700'
                        : 'bg-white/90 border-indigo-100 shadow-md shadow-indigo-100/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className={`text-lg sm:text-xl font-bold font-serif ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}>
                            {log.medicationName}
                          </h4>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 font-serif ${badge.bg}`}
                          >
                            <span className="material-symbols-outlined text-[14px]">{badge.icon}</span>
                            <span>{badge.label}</span>
                          </span>
                        </div>

                        <p className={`text-xs sm:text-sm font-medium mt-1 font-serif ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-600'
                        }`}>
                          {log.dosage}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-serif">
                          <span className={`px-2.5 py-1 rounded-lg border font-bold ${
                            isDarkMode
                              ? 'bg-slate-900 border-slate-700 text-slate-300'
                              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                          }`}>
                            Scheduled: {log.scheduledTime}
                          </span>

                          {log.actualRecordedTime && (
                            <span className={`px-2.5 py-1 rounded-lg border font-semibold ${
                              isDarkMode
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                : 'bg-emerald-100 border-emerald-200 text-emerald-900'
                            }`}>
                              Taken at {log.actualRecordedTime}
                            </span>
                          )}

                          {log.mealTiming && (
                            <span className={`px-2.5 py-1 rounded-lg border capitalize ${
                              isDarkMode
                                ? 'bg-slate-900 border-slate-700 text-slate-400'
                                : 'bg-slate-100 border-slate-200 text-slate-700'
                            }`}>
                              {log.mealTiming.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className={`flex flex-wrap items-center gap-2 pt-2 border-t font-serif ${
                      isDarkMode ? 'border-slate-700/60' : 'border-indigo-100'
                    }`}>
                      {!isTaken && !isSkipped && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMarkTaken(log)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">check</span>
                            <span>Mark Taken</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRetroactiveLog(log)}
                            className={`px-3.5 py-2 rounded-xl border font-bold text-xs flex items-center gap-1 ${
                              isDarkMode
                                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                                : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px] text-indigo-500">edit_calendar</span>
                            <span>I already took it</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMarkSkipped(log)}
                            className={`px-3 py-2 rounded-xl border font-bold text-xs ${
                              isDarkMode
                                ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                            }`}
                          >
                            Skip
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenCorrection(log)}
                        className={`ml-auto text-xs font-bold hover:underline px-2 py-1 flex items-center gap-1 ${
                          isDarkMode ? 'text-slate-400 hover:text-indigo-400' : 'text-slate-600 hover:text-indigo-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                        <span>Edit / Correct</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2 & 3: RANGE LIST VIEWS (7 Days, 30 Days) */}
      {(activeTab === '7days' || activeTab === '30days') && (
        <div className="flex flex-col gap-4 font-serif">
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            isDarkMode
              ? 'bg-slate-800/60 border-slate-700/80'
              : 'bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-rose-50/80 border-indigo-100 shadow-sm'
          }`}>
            <h3 className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {activeTab === '7days' ? 'Last 7 Days Activity' : 'Last 30 Days Activity'}
            </h3>
            <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-indigo-900'}`}>
              {rangeFilteredLogs.length} total logged doses
            </span>
          </div>

          {rangeFilteredLogs.length === 0 ? (
            <div
              className={`p-8 rounded-3xl border text-center ${
                isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-white/90 border-indigo-100 shadow-sm'
              }`}
            >
              <span className="material-symbols-outlined text-[36px] text-slate-400 mb-2">history</span>
              <h4 className={`font-bold text-base ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                No logs for this period
              </h4>
            </div>
          ) : (
            rangeFilteredLogs.map((log) => {
              const badge = getStatusBadge(log.status);
              return (
                <div
                  key={log.id}
                  className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isDarkMode
                      ? 'bg-slate-800/70 border-slate-700'
                      : 'bg-white/90 border-indigo-100 shadow-md shadow-indigo-100/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{log.medicationName}</h4>
                      <span className="text-xs font-mono text-slate-400">({log.date})</span>
                    </div>
                    <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{log.dosage}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                      <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                        Scheduled: <strong>{log.scheduledTime}</strong>
                      </span>
                      {log.actualRecordedTime && (
                        <span className="text-emerald-500 font-semibold">
                          • Taken: <strong>{log.actualRecordedTime}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenCorrection(log)}
                      className={`text-xs font-bold hover:underline px-2 py-1 ${
                        isDarkMode ? 'text-slate-400 hover:text-indigo-400' : 'text-slate-600 hover:text-indigo-700'
                      }`}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Retroactive Dose Modal ("I already took it") */}
      <RetroactiveDoseModal
        isOpen={!!retroactiveLog}
        log={retroactiveLog}
        onClose={() => setRetroactiveLog(null)}
        onConfirmTaken={handleConfirmRetroactive}
        onConfirmSkipped={(id) => {
          const log = allLogs.find((l) => l.id === id);
          if (log) handleMarkSkipped(log);
        }}
        onRemindLater={() => {
          showToast('Reminder Set', 'We will prompt you again later.', 'info');
        }}
        isDarkMode={isDarkMode}
      />

      {/* Manual Correction Modal */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border p-6 rounded-3xl max-w-md w-full flex flex-col gap-4 shadow-2xl font-serif ${
            isDarkMode
              ? 'bg-slate-900 border-slate-700 text-white'
              : 'bg-white/95 border-indigo-100 text-slate-900 shadow-indigo-100/50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Correct Medication Entry</h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  {editingLog.medicationName} ({editingLog.date})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className={`p-1.5 rounded-full transition-all ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-indigo-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="flex flex-col gap-3">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStatus('taken')}
                    className={`py-2.5 rounded-xl font-bold text-xs border transition-all ${
                      newStatus === 'taken'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    Taken
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStatus('skipped')}
                    className={`py-2.5 rounded-xl font-bold text-xs border transition-all ${
                      newStatus === 'skipped'
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    Skipped
                  </button>
                </div>
              </div>

              {newStatus === 'taken' && (
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Actual Time Taken
                  </label>
                  <input
                    type="text"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="e.g. 08:45 AM"
                    className={`w-full px-4 py-2.5 rounded-xl border font-mono text-sm outline-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                        : 'bg-indigo-50/50 border-indigo-200 text-slate-900 focus:border-indigo-500'
                    }`}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${
                    isDarkMode
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md"
                >
                  Save Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor's Clinical Adherence Report Modal */}
      <DoctorReportModal
        isOpen={isDoctorReportOpen}
        onClose={() => setIsDoctorReportOpen(false)}
        currentUser={currentUser}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
