export type NavTab = 'home' | 'medicines' | 'history' | 'caregiver' | 'profile';

export type UserRole = 'patient' | 'caregiver';

export interface PharmacyDetails {
  name: string; // e.g. "CVS Pharmacy #412" or "Walgreens Community Pharmacy"
  phone: string; // e.g. "(800) 555-0199"
  address?: string; // e.g. "1244 Medical Center Blvd"
  storeNumber?: string; // e.g. "Store #412"
  pharmacistName?: string;
  notes?: string; // e.g. "Drive-thru pickup available, refills ready in 2 hours"
}

export interface UserProfile {
  uid: string; // Unique internal ID - NEVER displayed to user
  email: string;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  bloodType?: string; // e.g. "O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"
  organDonor?: boolean;
  allergies?: string[]; // e.g. ["Penicillin (Anaphylaxis)", "Sulfa Drugs"]
  chronicConditions?: string[]; // e.g. ["Type 2 Diabetes", "Hypertension", "Atrial Fibrillation"]
  primaryPhysician?: {
    name: string;
    phone: string;
    clinic?: string;
  };
  preferredPharmacy?: PharmacyDetails;
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  profile: UserProfile;
}

export type MealTiming = 'before_food' | 'after_food' | 'with_food' | 'any_time';
export type Frequency = 'every_day' | 'specific_days' | 'every_x_days' | 'once' | 'custom';
export type MedicationType = 'Tablet' | 'Capsule' | 'Syrup' | 'Drops' | 'Injection' | 'Other';

export interface Medication {
  id: string;
  userId: string; // Isolated to patient UID
  name: string;
  strength: string; // e.g. "500 mg"
  dosageAmount: string; // e.g. "1 tablet"
  type: MedicationType;
  scheduledTimes: string[]; // e.g. ["08:30 AM", "08:30 PM"]
  frequency: Frequency;
  specificDays?: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun (or 0=Sun)
  intervalDays?: number; // e.g. Every 2 days, Every 3 days
  onceDate?: string; // YYYY-MM-DD for single-day medications
  mealTiming: MealTiming;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  instructions?: string;
  prescriptionPhotoUrl?: string; // Uploaded prescription label or doctor slip
  prescriptionFileName?: string;
  verifiedBySenior?: boolean; // Explicit verification before schedule is locked
  verificationNote?: string;
  // Refill Tracking & Inventory
  currentPillsRemaining?: number;
  refillReminderThreshold?: number; // Alert threshold e.g. <= 5 pills
  rxNumber?: string; // Pharmacy Rx number e.g. "RX-849201"
  prescribingDoctor?: string; // e.g. "Dr. Sarah Adams, MD"
  pharmacyName?: string; // e.g. "CVS Pharmacy #412"
  pharmacyPhone?: string; // e.g. "+1-800-555-0199"
  // Visual Pill Identification for Seniors
  pillColor?: string; // e.g. "White", "Blue", "Yellow", "Pink", "Red", "Green", "Orange", "Purple"
  pillShape?: string; // e.g. "round", "oval", "capsule", "drop", "liquid"
  color: string;
  icon: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DoseStatus =
  | 'UPCOMING'
  | 'DUE_NOW'
  | 'TAKEN'
  | 'TAKEN_LATER'
  | 'SNOOZED'
  | 'SKIPPED'
  | 'PENDING_CONFIRMATION'
  | 'UNCONFIRMED'
  | 'upcoming'
  | 'due_now'
  | 'taken'
  | 'taken_later'
  | 'snoozed'
  | 'skipped'
  | 'pending_confirmation'
  | 'unconfirmed'
  | 'missed';

export type ConfirmationMethod = 'on_time_button' | 'manual_later' | 'caregiver_logged';
export type RecordingMethod = 'on_time' | 'manual' | 'retroactive' | 'caregiver' | 'snoozed';

export interface MedicationLog {
  id: string;
  userId: string; // Patient UID
  medicationId: string;
  medicationName: string;
  dosage: string;
  date: string; // YYYY-MM-DD
  scheduledTime: string; // e.g. "09:00 AM"
  scheduledAt?: string; // ISO timestamp or localized datetime
  mealTiming?: MealTiming;
  status: DoseStatus;
  actualRecordedTime?: string; // Display string, e.g. "08:45 AM"
  actualTakenAt?: string; // ISO timestamp
  recordedAt?: string; // ISO timestamp
  confirmationMethod?: ConfirmationMethod;
  recordingMethod?: RecordingMethod;
  snoozedUntil?: string; // ISO timestamp if snoozed
  notes?: string;
  updatedAt: string;
}

export interface CaregiverPermissions {
  viewTodayMedicines: boolean;
  viewMedicationStatus: boolean;
  receiveUnconfirmedAlerts: boolean;
  viewMedicationHistory: boolean;
  editMedicationSchedule: boolean;
}

export type ConnectionStatus = 'pending' | 'active' | 'rejected' | 'revoked';

export interface CaregiverConnection {
  id: string;
  patientUid: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  caregiverUid: string;
  caregiverName: string;
  caregiverEmail: string;
  caregiverPhone?: string;
  status: ConnectionStatus;
  permissions: CaregiverPermissions;
  createdAt: string;
  approvedAt?: string;
}

export interface CaregiverInvite {
  id: string;
  token: string;
  patientUid: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  targetCaregiverEmail?: string;
  targetCaregiverPhone?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: number;
}

export interface ConnectionCode {
  code: string; // Legacy fallback
  patientUid: string;
  patientName: string;
  patientEmail: string;
  expiresAt: number; // timestamp in ms
}

export interface NotificationSettings {
  userId: string;
  remindersEnabled: boolean;
  snoozeDurationMinutes: number; // 5, 10, 15, 30
  gracePeriodMinutes: number; // 15, 30, 45, 60
  caregiverAlertsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  highVolumeVoice: boolean;
  seniorVisionMode?: boolean; // Large text, high-contrast borders, extra touch-target padding
}

export interface DrugInteractionAlert {
  id: string;
  severity: 'high' | 'moderate' | 'mild';
  category: string; // e.g. "Bleeding Risk", "Hypotension Risk", "Triple Whammy", "Duplicate Therapy", "Sedation & Fall Risk"
  drugsInvolved: string[];
  title: string;
  description: string;
  clinicalAdvice: string;
}

export interface DoseEaseBackupData {
  version: string;
  exportedAt: string;
  user: {
    uid: string;
    email: string;
    profile: UserProfile;
  };
  medications: Medication[];
  logs: MedicationLog[];
  settings: NotificationSettings;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

export interface PendingSyncItem {
  id: string;
  action: 'create_log' | 'update_log' | 'create_med' | 'update_med' | 'delete_med';
  payload: any;
  timestamp: number;
}
