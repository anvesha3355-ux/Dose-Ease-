import React, { useState, useMemo } from 'react';
import { AuthUser, Medication, MedicationLog } from '../types';
import {
  getMedications,
  getMedicationLogs,
  formatLocalDate,
  getTodayDateString,
} from '../services/storage';

interface DoctorReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  isDarkMode: boolean;
  targetPatientName?: string;
  targetPatientUid?: string;
}

export const DoctorReportModal: React.FC<DoctorReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isDarkMode,
  targetPatientName,
  targetPatientUid,
}) => {
  const patientUid = targetPatientUid || currentUser.uid;
  const patientName =
    targetPatientName ||
    `${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}`.trim();

  const [dateRange, setDateRange] = useState<'7' | '14' | '30' | '90'>('30');
  const [copied, setCopied] = useState(false);

  // Compute start date based on selected date range
  const { startDateStr, endDateStr, dateList } = useMemo(() => {
    const days = parseInt(dateRange, 10);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));

    const dates: string[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      dates.push(formatLocalDate(curr));
      curr.setDate(curr.getDate() + 1);
    }

    return {
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      dateList: dates,
    };
  }, [dateRange]);

  // Fetch all medications and logs for the patient
  const medications = useMemo(() => {
    if (!isOpen) return [];
    return getMedications(patientUid);
  }, [isOpen, patientUid]);

  const allLogs = useMemo(() => {
    if (!isOpen) return [];
    // Collect logs across the date list
    const logs: MedicationLog[] = [];
    dateList.forEach((d) => {
      const dayLogs = getMedicationLogs(patientUid, d);
      logs.push(...dayLogs);
    });
    return logs;
  }, [isOpen, patientUid, dateList]);

  // Compute statistics
  const stats = useMemo(() => {
    const total = allLogs.length;
    let takenCount = 0;
    let takenLateCount = 0;
    let skippedCount = 0;
    let unconfirmedCount = 0;

    allLogs.forEach((log) => {
      const s = String(log.status).toLowerCase();
      if (s === 'taken') takenCount++;
      else if (s === 'taken_later') takenLateCount++;
      else if (s === 'skipped') skippedCount++;
      else unconfirmedCount++;
    });

    const successfulDoses = takenCount + takenLateCount;
    const adherenceRate = total > 0 ? Math.round((successfulDoses / total) * 100) : 100;

    return {
      total,
      takenCount,
      takenLateCount,
      skippedCount,
      unconfirmedCount,
      successfulDoses,
      adherenceRate,
    };
  }, [allLogs]);

  // Per-medication breakdown
  const medStats = useMemo(() => {
    return medications.map((med) => {
      const medLogs = allLogs.filter((l) => l.medicationId === med.id);
      const total = medLogs.length;
      const taken = medLogs.filter((l) => {
        const s = String(l.status).toLowerCase();
        return s === 'taken' || s === 'taken_later';
      }).length;
      const skipped = medLogs.filter((l) => String(l.status).toLowerCase() === 'skipped').length;
      const rate = total > 0 ? Math.round((taken / total) * 100) : 100;

      return {
        med,
        total,
        taken,
        skipped,
        rate,
      };
    });
  }, [medications, allLogs]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Scheduled Time',
      'Medication Name',
      'Dosage',
      'Meal Timing',
      'Status',
      'Actual Taken Time',
      'Notes',
    ];

    const rows = allLogs.map((log) => [
      log.date,
      log.scheduledTime,
      `"${log.medicationName.replace(/"/g, '""')}"`,
      `"${log.dosage.replace(/"/g, '""')}"`,
      log.mealTiming || '',
      log.status,
      log.actualRecordedTime || log.actualTakenAt || '',
      `"${(log.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Medication_Adherence_Report_${patientName.replace(/\s+/g, '_')}_${getTodayDateString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySummary = () => {
    const summary = `
MEDICATION ADHERENCE REPORT
Patient: ${patientName}
Date Range: ${startDateStr} to ${endDateStr} (${dateRange} Days)
Generated: ${new Date().toLocaleDateString()}

SUMMARY:
• Overall Adherence Rate: ${stats.adherenceRate}%
• Total Prescribed Doses: ${stats.total}
• Doses Taken On-Time: ${stats.takenCount}
• Doses Taken Later: ${stats.takenLateCount}
• Doses Skipped: ${stats.skippedCount}
• Missed / Unconfirmed: ${stats.unconfirmedCount}

ACTIVE MEDICATIONS (${medications.length}):
${medications
  .map(
    (m) =>
      `- ${m.name} (${m.strength}): ${m.dosageAmount} | Schedule: ${m.scheduledTimes.join(', ')} | Supply Remaining: ${
        m.currentPillsRemaining !== undefined ? m.currentPillsRemaining + ' units' : 'N/A'
      } | Rx: ${m.rxNumber || 'N/A'}`
  )
  .join('\n')}

Generated with DoseEase for Physician Review.
    `.trim();

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
      <div
        className={`w-full max-w-3xl rounded-3xl border shadow-2xl flex flex-col my-auto max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:rounded-none ${
          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Modal Action Header (Hidden on Print) */}
        <div className="p-4 sm:p-6 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg">Doctor Adherence Report</h2>
              <p className="text-xs text-slate-400">Clinical medication summary &amp; compliance records</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="flex items-center rounded-xl bg-slate-800 p-1 border border-slate-700 text-xs font-bold">
              {(['7', '14', '30', '90'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRange(r)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    dateRange === r ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r}D
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              title="Close"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Action Toolbar (Print, CSV, Copy) - Hidden on Print */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-800/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs print:hidden shrink-0">
          <span className="text-slate-400 font-medium">
            Reporting: <strong className="text-white">{startDateStr}</strong> to{' '}
            <strong className="text-white">{endDateStr}</strong> ({dateRange} days)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1 border border-slate-700"
            >
              <span className="material-symbols-outlined text-[15px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold flex items-center gap-1 border border-slate-700"
            >
              <span className="material-symbols-outlined text-[15px]">download</span>
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold flex items-center gap-1 shadow-sm"
            >
              <span className="material-symbols-outlined text-[15px]">print</span>
              <span>Print Sheet</span>
            </button>
          </div>
        </div>

        {/* Report Content Body (Scrollable in Modal, Full on Print) */}
        <div className="p-5 sm:p-8 overflow-y-auto overscroll-contain flex flex-col gap-6 flex-1 print:overflow-visible print:p-4 print:text-black">
          {/* Printable Clinic Header */}
          <div className="border-b border-slate-700 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold block">
                DOSEEASE CLINICAL ADHERENCE REPORT
              </span>
              <h1 className="text-2xl font-black tracking-tight">{patientName}</h1>
              <p className="text-xs text-slate-400">
                Evaluation Window: {startDateStr} — {endDateStr} ({dateRange} Days)
              </p>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-400 font-medium">
              <p>Generated: {new Date().toLocaleDateString()}</p>
              <p>Contact: {currentUser.profile.phoneNumber || 'Not provided'}</p>
              <p className="text-indigo-400 font-semibold">Account Role: {currentUser.profile.role}</p>
            </div>
          </div>

          {/* Adherence Score Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                Adherence Rate
              </span>
              <span className="text-2xl sm:text-3xl font-black text-indigo-400 mt-1">
                {stats.adherenceRate}%
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {stats.successfulDoses} of {stats.total} doses
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                Taken On-Time
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                {stats.takenCount}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Within schedule window</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Taken Later
              </span>
              <span className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
                {stats.takenLateCount}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Retroactive confirmations</span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                Skipped / Missed
              </span>
              <span className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">
                {stats.skippedCount + stats.unconfirmedCount}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {stats.skippedCount} skipped, {stats.unconfirmedCount} missed
              </span>
            </div>
          </div>

          {/* Active Medications Roster */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Active Prescriptions &amp; Compliance Breakdown
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-700/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-slate-300 font-bold border-b border-slate-700">
                    <th className="p-3">Medication</th>
                    <th className="p-3">Schedule</th>
                    <th className="p-3">Instructions</th>
                    <th className="p-3">Remaining Stock</th>
                    <th className="p-3">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-medium">
                  {medStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        No active medications configured.
                      </td>
                    </tr>
                  ) : (
                    medStats.map(({ med, total, taken, rate }) => (
                      <tr key={med.id} className="hover:bg-slate-800/30">
                        <td className="p-3">
                          <strong className="text-white block">{med.name}</strong>
                          <span className="text-[11px] text-slate-400">
                            {med.strength} • {med.dosageAmount} ({med.type})
                          </span>
                          {med.rxNumber && (
                            <span className="block text-[10px] text-indigo-400">Rx: {med.rxNumber}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span>{med.scheduledTimes.join(', ')}</span>
                          <span className="block text-[10px] text-slate-400 capitalize">
                            {med.frequency.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 capitalize">
                          {med.mealTiming.replace(/_/g, ' ')}
                          {med.instructions && (
                            <span className="block text-[10px] text-slate-400">
                              Note: {med.instructions}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {med.currentPillsRemaining !== undefined ? (
                            <span
                              className={`font-bold ${
                                med.currentPillsRemaining <= (med.refillReminderThreshold || 5)
                                  ? 'text-rose-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {med.currentPillsRemaining} units
                            </span>
                          ) : (
                            <span className="text-slate-500">Not tracked</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`font-extrabold px-2 py-0.5 rounded-md text-[11px] ${
                              rate >= 80
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {rate}% ({taken}/{total})
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Dose Logs Table (Last 15 records) */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Chronological Dose Log (Sampled Recent Entries)
              </h3>
              <span className="text-[11px] text-slate-400">Showing up to 20 recorded events</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-700/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-slate-300 font-bold border-b border-slate-700">
                    <th className="p-3">Date</th>
                    <th className="p-3">Sched. Time</th>
                    <th className="p-3">Medication</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Recorded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-medium">
                  {allLogs.slice(0, 20).map((log) => {
                    const s = String(log.status).toLowerCase();
                    return (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="p-3 text-slate-400 font-mono">{log.date}</td>
                        <td className="p-3 font-semibold text-white">{log.scheduledTime}</td>
                        <td className="p-3">
                          <span>{log.medicationName}</span>
                          <span className="text-[10px] text-slate-400 block">{log.dosage}</span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                              s === 'taken'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : s === 'taken_later'
                                ? 'bg-amber-500/20 text-amber-400'
                                : s === 'skipped'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {log.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {log.actualRecordedTime || log.actualTakenAt || '—'}
                          {log.notes && <span className="block text-[10px] italic">"{log.notes}"</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Printable Signature Section */}
          <div className="pt-6 border-t border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 print:flex">
            <div className="flex-1 w-full">
              <div className="border-b border-dashed border-slate-500 w-full mb-1 h-8" />
              <span className="text-[11px] text-slate-400 font-medium">
                Patient / Caregiver Signature &amp; Date
              </span>
            </div>

            <div className="flex-1 w-full">
              <div className="border-b border-dashed border-slate-500 w-full mb-1 h-8" />
              <span className="text-[11px] text-slate-400 font-medium">
                Reviewing Physician / Pharmacist Signature
              </span>
            </div>
          </div>

          {/* Disclaimer Footer */}
          <p className="text-[11px] text-slate-500 italic text-center">
            This document is an electronic medication compliance record generated via DoseEase. It is
            intended to support clinical dialogue and does not replace medical records from an
            authorized pharmacy or prescribing health authority.
          </p>
        </div>
      </div>
    </div>
  );
};
