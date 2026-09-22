import React, { useState, useEffect } from 'react';
import { Medication, MedicationType, Frequency, MealTiming } from '../types';
import { checkNewMedicationSafety } from '../services/drugInteractions';

interface AddMedicineModalProps {
  isOpen: boolean;
  editingMedication: Medication | null;
  existingMedications?: Medication[];
  onClose: () => void;
  onSave: (medication: Medication) => void;
  onDelete?: (medicationId: string) => void;
  userId: string;
  isDarkMode: boolean;
}

export const AddMedicineModal: React.FC<AddMedicineModalProps> = ({
  isOpen,
  editingMedication,
  existingMedications = [],
  onClose,
  onSave,
  onDelete,
  userId,
  isDarkMode,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [type, setType] = useState<MedicationType>('Tablet');
  const [dosageAmount, setDosageAmount] = useState('1 tablet');
  const [scheduledTimes, setScheduledTimes] = useState<string[]>(['08:30 AM']);
  const [frequency, setFrequency] = useState<Frequency>('every_day');
  const [specificDays, setSpecificDays] = useState<number[]>([1, 3, 5]); // Default: Mon, Wed, Fri
  const [intervalDays, setIntervalDays] = useState<number>(2);
  const [onceDate, setOnceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [mealTiming, setMealTiming] = useState<MealTiming>('after_food');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [prescriptionPhotoUrl, setPrescriptionPhotoUrl] = useState<string | null>(null);
  const [prescriptionFileName, setPrescriptionFileName] = useState<string | null>(null);
  const [verifiedBySenior, setVerifiedBySenior] = useState(true);

  // Pill Appearance Visualizer
  const [pillColor, setPillColor] = useState<string>('White');
  const [pillShape, setPillShape] = useState<string>('round');

  // Inventory & Refills
  const [currentPillsRemaining, setCurrentPillsRemaining] = useState<string>('30');
  const [refillReminderThreshold, setRefillReminderThreshold] = useState<string>('5');
  const [rxNumber, setRxNumber] = useState('');
  const [prescribingDoctor, setPrescribingDoctor] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacyPhone, setPharmacyPhone] = useState('');

  const DAYS_LIST = [
    { id: 1, full: 'Monday', short: 'Mon' },
    { id: 2, full: 'Tuesday', short: 'Tue' },
    { id: 3, full: 'Wednesday', short: 'Wed' },
    { id: 4, full: 'Thursday', short: 'Thu' },
    { id: 5, full: 'Friday', short: 'Fri' },
    { id: 6, full: 'Saturday', short: 'Sat' },
    { id: 7, full: 'Sunday', short: 'Sun' },
  ];

  // Prefill when editing
  useEffect(() => {
    if (editingMedication) {
      setName(editingMedication.name);
      setStrength(editingMedication.strength);
      setType(editingMedication.type);
      setDosageAmount(editingMedication.dosageAmount);
      setScheduledTimes(editingMedication.scheduledTimes.length ? editingMedication.scheduledTimes : ['08:30 AM']);
      setFrequency(editingMedication.frequency);
      setSpecificDays(editingMedication.specificDays && editingMedication.specificDays.length > 0 ? editingMedication.specificDays : [1, 3, 5]);
      setIntervalDays(editingMedication.intervalDays || 2);
      setOnceDate(editingMedication.onceDate || editingMedication.startDate || new Date().toISOString().split('T')[0]);
      setMealTiming(editingMedication.mealTiming);
      setStartDate(editingMedication.startDate || new Date().toISOString().split('T')[0]);
      setEndDate(editingMedication.endDate || '');
      setInstructions(editingMedication.instructions || '');
      setPrescriptionPhotoUrl(editingMedication.prescriptionPhotoUrl || null);
      setPrescriptionFileName(editingMedication.prescriptionFileName || null);
      setVerifiedBySenior(editingMedication.verifiedBySenior !== false);
      setPillColor(editingMedication.pillColor || 'White');
      setPillShape(editingMedication.pillShape || 'round');
      setCurrentPillsRemaining(
        editingMedication.currentPillsRemaining !== undefined
          ? String(editingMedication.currentPillsRemaining)
          : '30'
      );
      setRefillReminderThreshold(
        editingMedication.refillReminderThreshold !== undefined
          ? String(editingMedication.refillReminderThreshold)
          : '5'
      );
      setRxNumber(editingMedication.rxNumber || '');
      setPrescribingDoctor(editingMedication.prescribingDoctor || '');
      setPharmacyName(editingMedication.pharmacyName || '');
      setPharmacyPhone(editingMedication.pharmacyPhone || '');
      setStep(1);
    } else {
      setName('');
      setStrength('');
      setType('Tablet');
      setDosageAmount('1 tablet');
      setScheduledTimes(['08:30 AM']);
      setFrequency('every_day');
      setSpecificDays([1, 3, 5]);
      setIntervalDays(2);
      setOnceDate(new Date().toISOString().split('T')[0]);
      setMealTiming('after_food');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setInstructions('');
      setPrescriptionPhotoUrl(null);
      setPrescriptionFileName(null);
      setVerifiedBySenior(true);
      setPillColor('White');
      setPillShape('round');
      setCurrentPillsRemaining('30');
      setRefillReminderThreshold('5');
      setRxNumber('');
      setPrescribingDoctor('');
      setPharmacyName('');
      setPharmacyPhone('');
      setStep(1);
    }
    setErrorMsg(null);
    setShowDeleteConfirm(false);
  }, [editingMedication, isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Prescription image must be under 5MB.');
      return;
    }

    setPrescriptionFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPrescriptionPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const toggleDay = (dayId: number) => {
    if (specificDays.includes(dayId)) {
      setSpecificDays(specificDays.filter((d) => d !== dayId));
    } else {
      setSpecificDays([...specificDays, dayId].sort((a, b) => a - b));
    }
  };

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!name.trim()) {
        setErrorMsg('Please enter the medicine name.');
        return;
      }
      if (!strength.trim()) {
        setErrorMsg('Please enter strength (e.g. 500 mg).');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!dosageAmount.trim()) {
        setErrorMsg('Please specify dosage (e.g. 1 tablet).');
        return;
      }
      if (frequency === 'specific_days' && specificDays.length === 0) {
        setErrorMsg('Please select at least one day for Specific Days (e.g. Monday + Wednesday + Friday).');
        return;
      }
      if (frequency === 'every_x_days' && (!intervalDays || intervalDays < 1)) {
        setErrorMsg('Please enter a valid interval in days (e.g. 2).');
        return;
      }
      if (frequency === 'once' && !onceDate) {
        setErrorMsg('Please select a date for this one-time medicine.');
        return;
      }
      if (scheduledTimes.length === 0 || !scheduledTimes[0].trim()) {
        setErrorMsg('Please enter at least one scheduled time.');
        return;
      }
      setStep(3);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      setErrorMsg('Please select a start date.');
      return;
    }

    const med: Medication = {
      id: editingMedication?.id || `med_${Date.now()}`,
      userId,
      name: name.trim(),
      strength: strength.trim(),
      dosageAmount: dosageAmount.trim(),
      type,
      scheduledTimes: scheduledTimes.filter((t) => t.trim().length > 0),
      frequency,
      specificDays: frequency === 'specific_days' ? specificDays : undefined,
      intervalDays: frequency === 'every_x_days' ? Number(intervalDays) : undefined,
      onceDate: frequency === 'once' ? (onceDate || startDate) : undefined,
      mealTiming,
      startDate: frequency === 'once' ? (onceDate || startDate) : startDate,
      endDate: frequency === 'once' ? (onceDate || startDate) : (endDate.trim() || undefined),
      instructions: instructions.trim() || undefined,
      prescriptionPhotoUrl: prescriptionPhotoUrl || undefined,
      prescriptionFileName: prescriptionFileName || undefined,
      verifiedBySenior,
      currentPillsRemaining: currentPillsRemaining.trim()
        ? parseInt(currentPillsRemaining, 10)
        : undefined,
      refillReminderThreshold: refillReminderThreshold.trim()
        ? parseInt(refillReminderThreshold, 10)
        : 5,
      pillColor,
      pillShape,
      rxNumber: rxNumber.trim() || undefined,
      prescribingDoctor: prescribingDoctor.trim() || undefined,
      pharmacyName: pharmacyName.trim() || undefined,
      pharmacyPhone: pharmacyPhone.trim() || undefined,
      color: editingMedication?.color || '#4f46e5',
      icon: editingMedication?.icon || 'pill',
      isActive: true,
      createdAt: editingMedication?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(med);
    onClose();
  };

  const addTimeSlot = () => {
    if (scheduledTimes.length < 4) {
      setScheduledTimes([...scheduledTimes, '08:00 PM']);
    }
  };

  const updateTimeSlot = (index: number, val: string) => {
    const updated = [...scheduledTimes];
    updated[index] = val;
    setScheduledTimes(updated);
  };

  const removeTimeSlot = (index: number) => {
    if (scheduledTimes.length > 1) {
      setScheduledTimes(scheduledTimes.filter((_, i) => i !== index));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200 font-serif"
    >
      <div
        className={`w-full max-w-lg rounded-3xl shadow-2xl flex flex-col border my-auto max-h-[90vh] overflow-hidden ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.8)]'
            : 'bg-white border-indigo-100 text-slate-900 shadow-2xl shadow-indigo-100/60'
        }`}
      >
        {/* Pinned Header */}
        <div className={`p-5 sm:p-6 border-b shrink-0 flex flex-col gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-indigo-100 bg-white/90'}`}>
          <div className="flex items-start justify-between">
            <div>
              <span className={`text-xs font-bold uppercase tracking-widest block ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                Step {step} of 3
              </span>
              <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {editingMedication ? 'Edit Medicine' : 'Add New Medicine'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`p-1 rounded-xl ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>

          {/* Step Progress Bar */}
          <div className="flex items-center gap-2">
            <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`} />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Form Body based on Step - Pinned footer and scrollable fields */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-5 sm:p-6 flex-1 overflow-y-auto overscroll-contain flex flex-col gap-4">
          {step === 1 && (
            <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  1. Medicine Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metformin, Amlodipine"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-4 py-3 rounded-2xl border text-base font-bold outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                  }`}
                />

                {/* Real-time Polypharmacy & Drug Interaction Checker */}
                {name.trim().length >= 3 &&
                  checkNewMedicationSafety(
                    name,
                    existingMedications.filter((m) => m.id !== editingMedication?.id)
                  ).length > 0 && (
                    <div className="mt-2.5 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                      <span className="material-symbols-outlined text-[20px] text-amber-500 shrink-0 mt-0.5">
                        warning
                      </span>
                      <div>
                        <strong className="block font-bold">
                          Interaction Warning:{' '}
                          {
                            checkNewMedicationSafety(
                              name,
                              existingMedications.filter((m) => m.id !== editingMedication?.id)
                            )[0].category
                          }
                        </strong>
                        <span className="mt-0.5 block opacity-90">
                          {
                            checkNewMedicationSafety(
                              name,
                              existingMedications.filter((m) => m.id !== editingMedication?.id)
                            )[0].description
                          }
                        </span>
                        <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold block mt-1">
                          Doctor's Note:{' '}
                          {
                            checkNewMedicationSafety(
                              name,
                              existingMedications.filter((m) => m.id !== editingMedication?.id)
                            )[0].clinicalAdvice
                          }
                        </span>
                      </div>
                    </div>
                  )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    2. Strength / Dose *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500 mg, 5 mg"
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    className={`w-full px-4 py-3 rounded-2xl border text-base font-bold outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Medicine Form
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as MedicationType)}
                    className={`w-full px-3 py-3 rounded-2xl border text-base font-bold outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                    }`}
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Drops">Drops</option>
                    <option value="Injection">Injection</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Pill Appearance Visualizer (Shape & Color) for Senior Safety */}
              <div className={`p-3.5 rounded-2xl border flex flex-col gap-3 ${
                isDarkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-indigo-50/50 border-indigo-100'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                    Pill Visual Appearance (Optional)
                  </span>
                  <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Helps seniors match bottle pills</span>
                </div>

                {/* Pill Shape & Color selectors */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Pill Shape
                    </label>
                    <select
                      value={pillShape}
                      onChange={(e) => setPillShape(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'
                      }`}
                    >
                      <option value="round">Round Tablet</option>
                      <option value="oval">Oval / Oblong</option>
                      <option value="capsule">Two-Tone Capsule</option>
                      <option value="drop">Drop / Liquid</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Pill Color
                    </label>
                    <select
                      value={pillColor}
                      onChange={(e) => setPillColor(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'
                      }`}
                    >
                      <option value="White">White</option>
                      <option value="Blue">Blue</option>
                      <option value="Yellow">Yellow</option>
                      <option value="Pink">Pink</option>
                      <option value="Red">Red</option>
                      <option value="Orange">Orange</option>
                      <option value="Green">Green</option>
                      <option value="Purple">Purple</option>
                    </select>
                  </div>
                </div>

                {/* Live Visual Pill Preview Chip */}
                <div className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                  isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-indigo-100'
                }`}>
                  <div
                    className={`w-10 h-10 flex items-center justify-center font-bold text-xs shadow-inner ${
                      pillShape === 'capsule'
                        ? 'rounded-full border-2 border-slate-400'
                        : pillShape === 'oval'
                        ? 'rounded-2xl border-2 border-slate-400'
                        : pillShape === 'drop'
                        ? 'rounded-b-full rounded-t-lg border-2 border-slate-400'
                        : 'rounded-full border-2 border-slate-400'
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
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {pillShape === 'capsule'
                        ? 'pill'
                        : pillShape === 'drop'
                        ? 'opacity'
                        : 'circle'}
                    </span>
                  </div>

                  <div className="text-xs">
                    <span className={`font-bold block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {pillColor} {pillShape}
                    </span>
                    <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Visual badge shown on active schedule card
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  3. Dosage Quantity *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1 tablet, 2 puffs, 5 ml"
                  value={dosageAmount}
                  onChange={(e) => setDosageAmount(e.target.value)}
                  className={`w-full px-4 py-3 rounded-2xl border text-base font-bold outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  4. Frequency *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'every_day', label: 'Every Day', icon: 'today' },
                    { id: 'specific_days', label: 'Specific Days', icon: 'calendar_month' },
                    { id: 'every_x_days', label: 'Every X Days', icon: 'event_repeat' },
                    { id: 'once', label: 'Once', icon: 'event' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFrequency(f.id as Frequency)}
                      className={`py-3 px-2 rounded-2xl text-xs sm:text-sm font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                        frequency === f.id
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20'
                          : isDarkMode
                          ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                          : 'bg-indigo-50/50 border-indigo-100 text-slate-700 hover:text-slate-900 hover:border-indigo-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{f.icon}</span>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>

                {/* Specific Days Selector */}
                {frequency === 'specific_days' && (
                  <div className={`mt-3.5 p-4 rounded-2xl border ${
                    isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-indigo-50/50 border-indigo-100'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                        Select Days of the Week
                      </span>
                      <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {specificDays.length} day{specificDays.length !== 1 ? 's' : ''} selected
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {DAYS_LIST.map((day) => {
                        const isSelected = specificDays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                                : isDarkMode
                                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                : 'bg-white border-indigo-200 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <span>{day.full}</span>
                            <span className="material-symbols-outlined text-[18px]">
                              {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className={`mt-3 text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      <span className="material-symbols-outlined text-indigo-500 text-[16px]">info</span>
                      <span>
                        {specificDays.length === 0
                          ? 'Please select at least one day (e.g. Monday + Wednesday + Friday).'
                          : `Scheduled on: ${specificDays
                              .map((id) => DAYS_LIST.find((d) => d.id === id)?.full)
                              .filter(Boolean)
                              .join(', ')}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Every X Days Selector */}
                {frequency === 'every_x_days' && (
                  <div className={`mt-3.5 p-4 rounded-2xl border ${
                    isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-indigo-50/50 border-indigo-100'
                  }`}>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                      Repeat Interval (Every X Days)
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIntervalDays(Math.max(1, intervalDays - 1))}
                        className={`w-10 h-10 rounded-xl font-bold text-lg ${
                          isDarkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200'
                        }`}
                      >
                        -
                      </button>
                      <div className={`flex-1 text-center font-bold text-lg ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                        Every {intervalDays} day{intervalDays > 1 ? 's' : ''}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIntervalDays(intervalDays + 1)}
                        className={`w-10 h-10 rounded-xl font-bold text-lg ${
                          isDarkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200'
                        }`}
                      >
                        +
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mt-3">
                      {[2, 3, 4, 7].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setIntervalDays(num)}
                          className={`py-1.5 text-xs font-bold rounded-lg border ${
                            intervalDays === num
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-slate-400'
                              : 'bg-white border-indigo-200 text-slate-700'
                          }`}
                        >
                          Every {num}d
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Once Selector */}
                {frequency === 'once' && (
                  <div className={`mt-3.5 p-4 rounded-2xl border ${
                    isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-indigo-50/50 border-indigo-100'
                  }`}>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                      Select Date (Single Dose)
                    </label>
                    <input
                      type="date"
                      required
                      value={onceDate}
                      onChange={(e) => {
                        setOnceDate(e.target.value);
                        setStartDate(e.target.value);
                      }}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'
                      }`}
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`block text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    5. Scheduled Times *
                  </label>
                  {scheduledTimes.length < 4 && (
                    <button
                      type="button"
                      onClick={addTimeSlot}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add another time</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {scheduledTimes.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={time}
                        onChange={(e) => updateTimeSlot(idx, e.target.value)}
                        placeholder="e.g. 08:30 AM"
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-mono font-bold outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                        }`}
                      />
                      {scheduledTimes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  6. Food Timing
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'after_food', label: 'After Food' },
                    { id: 'before_food', label: 'Before Food' },
                    { id: 'with_food', label: 'With Food' },
                    { id: 'any_time', label: 'Any Time' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMealTiming(m.id as MealTiming)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                        mealTiming === m.id
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : isDarkMode
                          ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                          : 'bg-indigo-50/50 border-indigo-100 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    7. Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-bold outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    8. End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-bold outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Refill & Supply Tracker (Optional) */}
              <div className={`p-3.5 rounded-2xl border flex flex-col gap-3 ${
                isDarkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-indigo-50/50 border-indigo-100'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                    9. Supply & Refill Tracking (Optional)
                  </span>
                  <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Automatic pill count & alerts</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Pills in Bottle Currently
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      placeholder="e.g. 30"
                      value={currentPillsRemaining}
                      onChange={(e) => setCurrentPillsRemaining(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Refill Alert Threshold
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="e.g. 5"
                      value={refillReminderThreshold}
                      onChange={(e) => setRefillReminderThreshold(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Prescription Rx #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. RX-849201"
                      value={rxNumber}
                      onChange={(e) => setRxNumber(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Prescribing Doctor
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Sarah Adams"
                      value={prescribingDoctor}
                      onChange={(e) => setPrescribingDoctor(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Pharmacy Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CVS Pharmacy"
                      value={pharmacyName}
                      onChange={(e) => setPharmacyName(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Pharmacy Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 1-800-555-0199"
                      value={pharmacyPhone}
                      onChange={(e) => setPharmacyPhone(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  10. Optional Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Drink full glass of water, do not crush"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium outline-none resize-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'
                  }`}
                />
              </div>

              {/* Prescription / Pill Bottle Label Upload */}
              <div className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${
                isDarkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-indigo-50/50 border-indigo-100'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`block text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                      11. Prescription or Label Photo (Optional)
                    </span>
                    <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Attach photo of bottle label or doctor slip for safe verification
                    </span>
                  </div>
                  <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shrink-0">
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    <span>{prescriptionPhotoUrl ? 'Change' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {prescriptionPhotoUrl && (
                  <div className={`flex items-center gap-3 p-2 rounded-xl border ${
                    isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-indigo-100'
                  }`}>
                    <img
                      src={prescriptionPhotoUrl}
                      alt="Prescription label"
                      className="w-14 h-14 object-cover rounded-lg border border-slate-300 dark:border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {prescriptionFileName || 'Prescription image attached'}
                      </p>
                      <span className="text-[10px] text-emerald-500 font-semibold block">
                        Attached for schedule verification
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPrescriptionPhotoUrl(null);
                        setPrescriptionFileName(null);
                      }}
                      className="text-xs font-bold text-rose-500 hover:text-rose-600 p-1"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Senior Verification Checkbox */}
              <div className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${
                isDarkMode ? 'bg-indigo-950/30 border-indigo-500/30' : 'bg-indigo-50/70 border-indigo-200'
              }`}>
                <input
                  type="checkbox"
                  id="seniorVerification"
                  checked={verifiedBySenior}
                  onChange={(e) => setVerifiedBySenior(e.target.checked)}
                  className="w-5 h-5 accent-indigo-600 rounded mt-0.5 cursor-pointer shrink-0"
                />
                <label htmlFor="seniorVerification" className={`text-xs cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  <strong className={`block font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Safety Verification Confirmed:</strong>
                  I confirm that I have reviewed the medicine name, dosage, and schedule against the doctor's prescription label.
                </label>
              </div>
            </div>
          )}

          </div>

          {/* Pinned Dialog Footers */}
          <div className={`flex items-center justify-between p-4 sm:p-5 border-t shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-indigo-100 bg-white/90'}`}>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : 1))}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm ${
                  isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Back
              </button>
            ) : editingMedication && onDelete ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Delete</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm ${
                  isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="min-h-[44px] px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-1.5 shadow-md active:scale-[0.98]"
              >
                <span>Continue</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            ) : (
              <button
                type="submit"
                className="min-h-[46px] px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base flex items-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[20px]">save</span>
                <span>Save Medicine</span>
              </button>
            )}
          </div>
        </form>

        {/* Delete Confirmation Sub-modal */}
        {showDeleteConfirm && editingMedication && onDelete && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className={`p-6 rounded-3xl max-w-sm w-full text-center border font-serif ${
              isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-indigo-100'
            }`}>
              <span className="material-symbols-outlined text-rose-500 text-[40px] mb-2">warning</span>
              <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Delete {editingMedication.name}?</h3>
              <p className={`text-xs mt-1 mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Are you sure you want to remove this medication and its upcoming reminders? Past logs will remain in your history.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${
                    isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(editingMedication.id);
                    onClose();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
