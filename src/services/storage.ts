import {
  AuthUser,
  UserProfile,
  Medication,
  MedicationLog,
  DoseStatus,
  CaregiverConnection,
  ConnectionCode,
  CaregiverPermissions,
  NotificationSettings,
  PendingSyncItem,
  DoseEaseBackupData,
} from '../types';
import { api } from './api';

const USERS_KEY = 'doseease_users_v2';
const MEDICATIONS_KEY = 'doseease_medications_v2';
const LOGS_KEY = 'doseease_logs_v2';
const CONNECTIONS_KEY = 'doseease_connections_v2';
const CODES_KEY = 'doseease_codes_v2';
const SETTINGS_KEY = 'doseease_settings_v2';
const SESSION_KEY = 'doseease_active_session_v2';
const SYNC_QUEUE_KEY = 'doseease_sync_queue_v2';

// In-memory fallback for sandboxed iframes or environments where localStorage throws SecurityError
const memoryStore = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Storage unavailable or blocked in iframe
    }
    return memoryStore.get(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Storage unavailable or quota exceeded
    }
    memoryStore.set(key, value);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Storage unavailable
    }
    memoryStore.delete(key);
  },
};

interface StoredUser {
  uid: string;
  email: string;
  passwordHash: string;
  salt: string;
  profile: UserProfile;
}

// Helper for date string
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Default permissions for caregiver connections
export const DEFAULT_CAREGIVER_PERMISSIONS: CaregiverPermissions = {
  viewTodayMedicines: true,
  viewMedicationStatus: true,
  receiveUnconfirmedAlerts: true,
  viewMedicationHistory: true,
  editMedicationSchedule: false, // Read-only by default
};

// Initialize database schema with empty isolated data repositories
export async function initializeDatabaseIfNeeded(): Promise<void> {
  // Ensure users store exists and purge any legacy demo accounts from earlier prototypes
  if (!safeStorage.getItem(USERS_KEY)) {
    safeStorage.setItem(USERS_KEY, JSON.stringify([]));
  } else {
    try {
      const existing: StoredUser[] = JSON.parse(safeStorage.getItem(USERS_KEY) || '[]');
      const filtered = existing.filter(
        (u) => !u.email.includes('example.com') && !u.uid.includes('demo')
      );
      if (filtered.length !== existing.length) {
        safeStorage.setItem(USERS_KEY, JSON.stringify(filtered));
      }
    } catch {
      safeStorage.setItem(USERS_KEY, JSON.stringify([]));
    }
  }

  // Purge legacy active session if it belonged to mock demo accounts
  try {
    const sessionStr = safeStorage.getItem(SESSION_KEY);
    if (sessionStr) {
      const session: AuthUser = JSON.parse(sessionStr);
      if (session.email.includes('example.com') || session.uid.includes('demo')) {
        safeStorage.removeItem(SESSION_KEY);
      }
    }
  } catch {
    safeStorage.removeItem(SESSION_KEY);
  }

  if (!safeStorage.getItem(MEDICATIONS_KEY)) {
    safeStorage.setItem(MEDICATIONS_KEY, JSON.stringify({}));
  }
  if (!safeStorage.getItem(LOGS_KEY)) {
    safeStorage.setItem(LOGS_KEY, JSON.stringify({}));
  }
  if (!safeStorage.getItem(CONNECTIONS_KEY)) {
    safeStorage.setItem(CONNECTIONS_KEY, JSON.stringify([]));
  }
  if (!safeStorage.getItem(CODES_KEY)) {
    safeStorage.setItem(CODES_KEY, JSON.stringify([]));
  }
  if (!safeStorage.getItem(SETTINGS_KEY)) {
    safeStorage.setItem(SETTINGS_KEY, JSON.stringify({}));
  }
}

// ----------------------------------------------------------------------
// DATA ISOLATION REPOSITORIES
// ----------------------------------------------------------------------

// Get current session
export function getActiveSession(): AuthUser | null {
  const sessionStr = safeStorage.getItem(SESSION_KEY);
  if (!sessionStr) return null;
  try {
    return JSON.parse(sessionStr);
  } catch {
    return null;
  }
}

export function setActiveSession(user: AuthUser | null): void {
  if (!user) {
    safeStorage.removeItem(SESSION_KEY);
  } else {
    safeStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
}

// Get all users (internal repository)
export function getStoredUsers(): StoredUser[] {
  const str = safeStorage.getItem(USERS_KEY);
  return str ? JSON.parse(str) : [];
}

export function saveStoredUser(user: StoredUser): void {
  const users = getStoredUsers();
  const index = users.findIndex((u) => u.uid === user.uid);
  if (index >= 0) {
    users[index] = user;
  } else {
    users.push(user);
  }
  safeStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// STRICT DATA ACCESS: Medications by user ID
export function getMedications(userId: string): Medication[] {
  if (!userId) return [];
  const mapStr = safeStorage.getItem(MEDICATIONS_KEY);
  const map: Record<string, Medication[]> = mapStr ? JSON.parse(mapStr) : {};
  return (map[userId] || []).filter((m) => m.isActive);
}

export function saveMedication(userId: string, medication: Medication): void {
  if (!userId || medication.userId !== userId) {
    throw new Error('Access denied: Unauthorized medication modification');
  }
  const mapStr = safeStorage.getItem(MEDICATIONS_KEY);
  const map: Record<string, Medication[]> = mapStr ? JSON.parse(mapStr) : {};
  const userMeds = map[userId] || [];

  const index = userMeds.findIndex((m) => m.id === medication.id);
  if (index >= 0) {
    userMeds[index] = { ...medication, updatedAt: new Date().toISOString() };
  } else {
    userMeds.push({
      ...medication,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  map[userId] = userMeds;
  safeStorage.setItem(MEDICATIONS_KEY, JSON.stringify(map));

  // Also ensure today's schedule logs reflect this change
  refreshTodayLogsForMedication(userId, medication);
  enqueueSync('update_med', medication);
}

export function deleteMedication(userId: string, medicationId: string): void {
  if (!userId) throw new Error('Access denied');
  const mapStr = safeStorage.getItem(MEDICATIONS_KEY);
  const map: Record<string, Medication[]> = mapStr ? JSON.parse(mapStr) : {};
  const userMeds = map[userId] || [];

  map[userId] = userMeds.filter((m) => m.id !== medicationId);
  safeStorage.setItem(MEDICATIONS_KEY, JSON.stringify(map));

  // Also remove upcoming logs
  const logsMapStr = safeStorage.getItem(LOGS_KEY);
  const logsMap: Record<string, MedicationLog[]> = logsMapStr ? JSON.parse(logsMapStr) : {};
  if (logsMap[userId]) {
    logsMap[userId] = logsMap[userId].filter(
      (log) => !(log.medicationId === medicationId && log.status === 'upcoming')
    );
    safeStorage.setItem(LOGS_KEY, JSON.stringify(logsMap));
  }

  enqueueSync('delete_med', { userId, medicationId });
}

export function refillMedication(userId: string, medicationId: string, addedCount: number): Medication | null {
  if (!userId || addedCount <= 0) return null;
  const mapStr = safeStorage.getItem(MEDICATIONS_KEY);
  const map: Record<string, Medication[]> = mapStr ? JSON.parse(mapStr) : {};
  const userMeds = map[userId] || [];

  const index = userMeds.findIndex((m) => m.id === medicationId);
  if (index === -1) return null;

  const current = userMeds[index].currentPillsRemaining || 0;
  userMeds[index] = {
    ...userMeds[index],
    currentPillsRemaining: current + addedCount,
    updatedAt: new Date().toISOString(),
  };

  map[userId] = userMeds;
  safeStorage.setItem(MEDICATIONS_KEY, JSON.stringify(map));
  enqueueSync('update_med', userMeds[index]);
  return userMeds[index];
}

export function decrementPillsRemaining(userId: string, medicationId: string, count = 1): void {
  if (!userId || count <= 0) return;
  const mapStr = safeStorage.getItem(MEDICATIONS_KEY);
  const map: Record<string, Medication[]> = mapStr ? JSON.parse(mapStr) : {};
  const userMeds = map[userId] || [];

  const index = userMeds.findIndex((m) => m.id === medicationId);
  if (index === -1) return;

  const current = userMeds[index].currentPillsRemaining;
  if (typeof current !== 'number') return; // Not tracked for this med

  const newCount = Math.max(0, current - count);
  userMeds[index] = {
    ...userMeds[index],
    currentPillsRemaining: newCount,
    updatedAt: new Date().toISOString(),
  };

  map[userId] = userMeds;
  safeStorage.setItem(MEDICATIONS_KEY, JSON.stringify(map));
  enqueueSync('update_med', userMeds[index]);
}

export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');
  const numericPart = clean.replace(/[^\d:]/g, '');
  const [hStr, mStr] = numericPart.split(':');
  let hours = parseInt(hStr || '0', 10);
  const minutes = parseInt(mStr || '0', 10);

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function isMedicationScheduledOnDate(med: Medication, dateStr: string): boolean {
  if (!med.isActive) return false;

  // Check start date boundary
  if (med.startDate && dateStr < med.startDate) {
    return false;
  }
  // Check end date boundary
  if (med.endDate && dateStr > med.endDate) {
    return false;
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  const dayOfWeek = targetDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // 1=Mon, ..., 7=Sun

  if (med.frequency === 'every_day') {
    return true;
  }

  if (med.frequency === 'specific_days') {
    if (!med.specificDays || med.specificDays.length === 0) {
      return false;
    }
    // Supports 1-7 (Mon-Sun) or 0-6 (Sun-Sat)
    return med.specificDays.includes(dayOfWeek) || med.specificDays.includes(isoDayOfWeek);
  }

  if (med.frequency === 'every_x_days') {
    const interval = med.intervalDays || 2;
    if (interval <= 0) return true;
    const [sy, sm, sd] = (med.startDate || dateStr).split('-').map(Number);
    const utcTarget = Date.UTC(y, m - 1, d);
    const utcStart = Date.UTC(sy, sm - 1, sd);
    const diffDays = Math.round((utcTarget - utcStart) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return false;
    return diffDays % interval === 0;
  }

  if (med.frequency === 'once') {
    const targetOnce = med.onceDate || med.startDate;
    return dateStr === targetOnce;
  }

  if (med.frequency === 'custom') {
    return false; // As-needed
  }

  return true;
}

export function computeLiveDoseStatus(log: MedicationLog): DoseStatus {
  const s = String(log.status).toUpperCase();
  if (s === 'TAKEN' || s === 'TAKEN_LATER' || s === 'SKIPPED') {
    return s as DoseStatus;
  }
  if (s === 'SNOOZED') {
    if (log.snoozedUntil && new Date(log.snoozedUntil) > new Date()) {
      return 'SNOOZED';
    }
  }

  const todayStr = getTodayDateString();
  if (log.date > todayStr) {
    return 'UPCOMING';
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const scheduledMinutes = parseTimeToMinutes(log.scheduledTime);

  if (log.date < todayStr) {
    return 'UNCONFIRMED';
  }

  // Target date is today
  const diffMinutes = currentMinutes - scheduledMinutes;
  if (diffMinutes < -15) {
    return 'UPCOMING';
  } else if (diffMinutes >= -15 && diffMinutes <= 30) {
    return 'DUE_NOW';
  } else if (diffMinutes > 30 && diffMinutes <= 120) {
    return 'PENDING_CONFIRMATION';
  } else {
    return 'UNCONFIRMED';
  }
}

// STRICT DATA ACCESS: Medication Logs
export function getMedicationLogs(userId: string, targetDate?: string): MedicationLog[] {
  if (!userId) return [];
  const logsMapStr = safeStorage.getItem(LOGS_KEY);
  const logsMap: Record<string, MedicationLog[]> = logsMapStr ? JSON.parse(logsMapStr) : {};
  let userLogs = logsMap[userId] || [];

  const date = targetDate || getTodayDateString();

  // Check if logs for target date exist
  const dateLogs = userLogs.filter((l) => l.date === date);

  if (dateLogs.length === 0) {
    // Generate scheduled dose instances for target date
    const meds = getMedications(userId);
    const generated: MedicationLog[] = [];
    meds.forEach((m) => {
      if (isMedicationScheduledOnDate(m, date)) {
        m.scheduledTimes.forEach((timeStr, idx) => {
          const newLog: MedicationLog = {
            id: `log_${userId}_${m.id}_${idx}_${date.replace(/-/g, '')}`,
            userId,
            medicationId: m.id,
            medicationName: m.name,
            dosage: `${m.strength} • ${m.dosageAmount}`,
            date,
            scheduledTime: timeStr,
            mealTiming: m.mealTiming,
            status: 'UPCOMING',
            scheduledAt: `${date}T${timeStr}`,
            recordedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          newLog.status = computeLiveDoseStatus(newLog);
          generated.push(newLog);
        });
      }
    });

    if (generated.length > 0) {
      userLogs = [...userLogs, ...generated];
      logsMap[userId] = userLogs;
      safeStorage.setItem(LOGS_KEY, JSON.stringify(logsMap));
      return generated;
    }
  } else {
    // Dynamically refresh live status on unconfirmed logs
    dateLogs.forEach((log) => {
      const currentStatus = String(log.status).toUpperCase();
      if (
        currentStatus !== 'TAKEN' &&
        currentStatus !== 'TAKEN_LATER' &&
        currentStatus !== 'SKIPPED'
      ) {
        log.status = computeLiveDoseStatus(log);
      }
    });
  }

  return targetDate ? dateLogs : userLogs;
}

export function updateMedicationLog(userId: string, updatedLog: MedicationLog): void {
  if (!userId || updatedLog.userId !== userId) {
    throw new Error('Access denied: Unauthorized log update');
  }
  const logsMapStr = safeStorage.getItem(LOGS_KEY);
  const logsMap: Record<string, MedicationLog[]> = logsMapStr ? JSON.parse(logsMapStr) : {};
  const userLogs = logsMap[userId] || [];

  const index = userLogs.findIndex((l) => l.id === updatedLog.id);
  const previousStatus = index >= 0 ? userLogs[index].status : null;

  if (index >= 0) {
    userLogs[index] = { ...updatedLog, updatedAt: new Date().toISOString() };
  } else {
    userLogs.push(updatedLog);
  }
  logsMap[userId] = userLogs;
  safeStorage.setItem(LOGS_KEY, JSON.stringify(logsMap));

  // If newly marked taken, decrement inventory count
  const newS = String(updatedLog.status).toLowerCase();
  const prevS = previousStatus ? String(previousStatus).toLowerCase() : '';
  if (
    (newS === 'taken' || newS === 'taken_later') &&
    prevS !== 'taken' &&
    prevS !== 'taken_later'
  ) {
    decrementPillsRemaining(userId, updatedLog.medicationId, 1);
  }

  enqueueSync('update_log', updatedLog);
}

function refreshTodayLogsForMedication(userId: string, med: Medication): void {
  const today = getTodayDateString();
  const logsMapStr = safeStorage.getItem(LOGS_KEY);
  const logsMap: Record<string, MedicationLog[]> = logsMapStr ? JSON.parse(logsMapStr) : {};
  const userLogs = logsMap[userId] || [];

  // Update existing upcoming logs with new name/dosage/schedule
  let changed = false;
  userLogs.forEach((l) => {
    if (l.medicationId === med.id && l.date === today && l.status === 'upcoming') {
      l.medicationName = med.name;
      l.dosage = `${med.strength} • ${med.dosageAmount}`;
      l.mealTiming = med.mealTiming;
      changed = true;
    }
  });
  if (changed) {
    logsMap[userId] = userLogs;
    safeStorage.setItem(LOGS_KEY, JSON.stringify(logsMap));
  }
}

// ----------------------------------------------------------------------
// CAREGIVER CONNECTIONS & 6-DIGIT CODE REPOSITORY
// ----------------------------------------------------------------------

export function getCaregiverConnections(): CaregiverConnection[] {
  const str = safeStorage.getItem(CONNECTIONS_KEY);
  return str ? JSON.parse(str) : [];
}

export function saveCaregiverConnection(conn: CaregiverConnection): void {
  const conns = getCaregiverConnections();
  const index = conns.findIndex((c) => c.id === conn.id);
  if (index >= 0) {
    conns[index] = conn;
  } else {
    conns.push(conn);
  }
  safeStorage.setItem(CONNECTIONS_KEY, JSON.stringify(conns));
}

// Temporary 6-digit connection codes
export function getActiveCodes(): ConnectionCode[] {
  const str = safeStorage.getItem(CODES_KEY);
  const now = Date.now();
  const codes: ConnectionCode[] = str ? JSON.parse(str) : [];
  // Purge expired
  const valid = codes.filter((c) => c.expiresAt > now);
  if (valid.length !== codes.length) {
    safeStorage.setItem(CODES_KEY, JSON.stringify(valid));
  }
  return valid;
}

export function createConnectionCode(
  patientUid: string,
  patientName: string,
  patientEmail: string
): string {
  // Generate 6-digit PIN
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const codeObj: ConnectionCode = {
    code: pin,
    patientUid,
    patientName,
    patientEmail,
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins expiry
  };
  const codes = getActiveCodes().filter((c) => c.patientUid !== patientUid);
  codes.push(codeObj);
  safeStorage.setItem(CODES_KEY, JSON.stringify(codes));
  return pin;
}

// Caregiver enters 6-digit code -> creates pending request
export function submitConnectionCode(
  caregiver: AuthUser,
  code: string
): { success: boolean; message: string } {
  const activeCodes = getActiveCodes();
  const match = activeCodes.find((c) => c.code.trim() === code.trim());

  if (!match) {
    return {
      success: false,
      message: 'This connection code is invalid or has expired. Please ask the patient for a new 6-digit code.',
    };
  }

  if (match.patientUid === caregiver.uid) {
    return {
      success: false,
      message: 'You cannot connect to your own account as a caregiver.',
    };
  }

  const conns = getCaregiverConnections();
  const existing = conns.find(
    (c) =>
      c.patientUid === match.patientUid &&
      c.caregiverUid === caregiver.uid &&
      c.status !== 'revoked' &&
      c.status !== 'rejected'
  );

  if (existing) {
    return {
      success: false,
      message: 'A connection or request already exists between you and this patient.',
    };
  }

  const newConn: CaregiverConnection = {
    id: `conn_${Date.now()}`,
    patientUid: match.patientUid,
    patientName: match.patientName,
    patientEmail: match.patientEmail,
    caregiverUid: caregiver.uid,
    caregiverName: `${caregiver.profile.firstName} ${caregiver.profile.lastName || ''}`.trim(),
    caregiverEmail: caregiver.email,
    status: 'pending',
    permissions: { ...DEFAULT_CAREGIVER_PERMISSIONS },
    createdAt: new Date().toISOString(),
  };

  conns.push(newConn);
  safeStorage.setItem(CONNECTIONS_KEY, JSON.stringify(conns));

  // Invalidate used code
  const filtered = activeCodes.filter((c) => c.code !== code);
  safeStorage.setItem(CODES_KEY, JSON.stringify(filtered));

  return {
    success: true,
    message: `Connection request sent to ${match.patientName}. They must approve it before you can view their data.`,
  };
}

// Patient approves or rejects request
export function setConnectionStatus(
  patientUid: string,
  connectionId: string,
  status: 'active' | 'rejected' | 'revoked',
  updatedPermissions?: CaregiverPermissions
): void {
  const conns = getCaregiverConnections();
  const conn = conns.find((c) => c.id === connectionId);
  if (!conn) throw new Error('Connection record not found');

  // Verify access
  if (conn.patientUid !== patientUid && conn.caregiverUid !== patientUid) {
    throw new Error('Access denied: Unauthorized caregiver relationship operation');
  }

  conn.status = status;
  if (status === 'active') {
    conn.approvedAt = new Date().toISOString();
  }
  if (updatedPermissions) {
    conn.permissions = updatedPermissions;
  }
  safeStorage.setItem(CONNECTIONS_KEY, JSON.stringify(conns));
}

// Get connections for a specific patient
export function getPatientConnections(patientUid: string): CaregiverConnection[] {
  return getCaregiverConnections().filter(
    (c) => c.patientUid === patientUid && c.status !== 'revoked'
  );
}

// Get approved patients for a specific caregiver
export function getCaregiverActivePatients(caregiverUid: string): CaregiverConnection[] {
  return getCaregiverConnections().filter(
    (c) => c.caregiverUid === caregiverUid && c.status === 'active'
  );
}

// ----------------------------------------------------------------------
// NOTIFICATION SETTINGS
// ----------------------------------------------------------------------

export function getUserSettings(userId: string): NotificationSettings {
  const str = safeStorage.getItem(SETTINGS_KEY);
  const map: Record<string, NotificationSettings> = str ? JSON.parse(str) : {};
  if (map[userId]) return map[userId];

  // Default settings
  const def: NotificationSettings = {
    userId,
    remindersEnabled: true,
    snoozeDurationMinutes: 10,
    gracePeriodMinutes: 30,
    caregiverAlertsEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    highVolumeVoice: false,
  };
  map[userId] = def;
  safeStorage.setItem(SETTINGS_KEY, JSON.stringify(map));
  return def;
}

export function saveUserSettings(userId: string, settings: NotificationSettings): void {
  const str = safeStorage.getItem(SETTINGS_KEY);
  const map: Record<string, NotificationSettings> = str ? JSON.parse(str) : {};
  map[userId] = { ...settings, userId };
  safeStorage.setItem(SETTINGS_KEY, JSON.stringify(map));
}

// ----------------------------------------------------------------------
// OFFLINE SYNC QUEUE
// ----------------------------------------------------------------------

export function getSyncQueue(): PendingSyncItem[] {
  const str = safeStorage.getItem(SYNC_QUEUE_KEY);
  return str ? JSON.parse(str) : [];
}

export function triggerBackgroundServerSync(targetUserId?: string): void {
  const session = getActiveSession();
  const userId = targetUserId || session?.uid;
  if (!userId) return;

  const meds = getMedications(userId);
  const logs = getMedicationLogs(userId);
  const settings = getUserSettings(userId);

  api.syncDataToServer({
    userId,
    medications: meds,
    logs,
    settings,
    profile: session?.profile,
  });
}

export function enqueueSync(action: PendingSyncItem['action'], payload: any): void {
  const queue = getSyncQueue();
  queue.push({
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action,
    payload,
    timestamp: Date.now(),
  });
  safeStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

  // Trigger real-time push to server so other phones update
  triggerBackgroundServerSync();
}

export function clearSyncQueue(): void {
  safeStorage.removeItem(SYNC_QUEUE_KEY);
}

export async function syncLocalQueueAndFetchLatest(userId: string): Promise<{
  success: boolean;
  syncedCount: number;
  message: string;
}> {
  const queue = getSyncQueue();
  const queuedCount = queue.length;
  const meds = getMedications(userId);
  const logs = getMedicationLogs(userId);
  const settings = getUserSettings(userId);
  const session = getActiveSession();

  try {
    // 1. Push all pending local data and state to server
    const syncRes = await api.syncDataToServer({
      userId,
      medications: meds,
      logs,
      settings,
      profile: session?.profile,
    });

    if (syncRes) {
      // Clear the local sync queue since server now has all latest changes
      clearSyncQueue();

      // 2. Fetch latest server state (in case caregiver or another device made modifications)
      const serverData = await api.fetchDataFromServer(userId);
      if (serverData) {
        // Merge medications if server has more or newer
        if (serverData.medications && Array.isArray(serverData.medications)) {
          const medsMapStr = safeStorage.getItem(MEDICATIONS_KEY);
          const medsMap: Record<string, Medication[]> = medsMapStr ? JSON.parse(medsMapStr) : {};
          const existingMeds = medsMap[userId] || [];
          const medMap = new Map<string, Medication>();
          serverData.medications.forEach((m) => medMap.set(m.id, m));
          existingMeds.forEach((m) => {
            const sMed = medMap.get(m.id);
            if (!sMed || new Date(m.updatedAt).getTime() >= new Date(sMed.updatedAt).getTime()) {
              medMap.set(m.id, m);
            }
          });
          medsMap[userId] = Array.from(medMap.values());
          safeStorage.setItem(MEDICATIONS_KEY, JSON.stringify(medsMap));
        }

        // Merge logs
        if (serverData.logs && Array.isArray(serverData.logs)) {
          const logsMapStr = safeStorage.getItem(LOGS_KEY);
          const logsMap: Record<string, MedicationLog[]> = logsMapStr ? JSON.parse(logsMapStr) : {};
          const existingLogs = logsMap[userId] || [];
          const logMap = new Map<string, MedicationLog>();
          existingLogs.forEach((l) => logMap.set(l.id, l));
          serverData.logs.forEach((l) => logMap.set(l.id, l));
          logsMap[userId] = Array.from(logMap.values());
          safeStorage.setItem(LOGS_KEY, JSON.stringify(logsMap));
        }
      }

      return {
        success: true,
        syncedCount: queuedCount,
        message:
          queuedCount > 0
            ? `Synced ${queuedCount} pending offline action${queuedCount > 1 ? 's' : ''} to server.`
            : 'Data sync queue verified. Everything is up to date.',
      };
    } else {
      // Offline / server unreachable
      return {
        success: false,
        syncedCount: queuedCount,
        message:
          queuedCount > 0
            ? `Offline mode: ${queuedCount} pending change${queuedCount > 1 ? 's' : ''} preserved in queue.`
            : 'Offline mode: Using cached local medical records.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      syncedCount: queuedCount,
      message: `Sync delayed: ${err?.message || 'Will retry automatically.'}`,
    };
  }
}

// ----------------------------------------------------------------------
// DATA PORTABILITY: BACKUP EXPORT & RESTORE
// ----------------------------------------------------------------------

export function exportDoseEaseBackup(userId: string): DoseEaseBackupData {
  const user = getActiveSession();
  const medications = getMedications(userId);
  const logs = getMedicationLogs(userId);
  const settings = getUserSettings(userId);

  return {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    user: {
      uid: userId,
      email: user?.email || 'patient@doseease.app',
      profile: user?.profile || {
        uid: userId,
        email: user?.email || '',
        firstName: 'DoseEase Patient',
        role: 'patient',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    medications,
    logs,
    settings,
  };
}

export function importDoseEaseBackup(
  userId: string,
  backup: DoseEaseBackupData
): { success: boolean; message: string } {
  if (!backup || !backup.medications || !Array.isArray(backup.medications)) {
    return { success: false, message: 'Invalid backup file format. Missing medications list.' };
  }

  try {
    // 1. Restore medications mapped to target userId
    const medsMapStr = safeStorage.getItem(MEDICATIONS_KEY);
    const medsMap: Record<string, Medication[]> = medsMapStr ? JSON.parse(medsMapStr) : {};
    const sanitizedMeds: Medication[] = backup.medications.map((m) => ({
      ...m,
      userId,
      updatedAt: new Date().toISOString(),
    }));
    medsMap[userId] = sanitizedMeds;
    safeStorage.setItem(MEDICATIONS_KEY, JSON.stringify(medsMap));

    // 2. Restore logs if present
    if (backup.logs && Array.isArray(backup.logs)) {
      const logsMapStr = safeStorage.getItem(LOGS_KEY);
      const logsMap: Record<string, MedicationLog[]> = logsMapStr ? JSON.parse(logsMapStr) : {};
      const sanitizedLogs: MedicationLog[] = backup.logs.map((l) => ({
        ...l,
        userId,
        updatedAt: new Date().toISOString(),
      }));
      logsMap[userId] = sanitizedLogs;
      safeStorage.setItem(LOGS_KEY, JSON.stringify(logsMap));
    }

    // 3. Restore settings if present
    if (backup.settings) {
      saveUserSettings(userId, { ...backup.settings, userId });
    }

    return {
      success: true,
      message: `Restored ${sanitizedMeds.length} medications and past history logs successfully.`,
    };
  } catch (err: any) {
    return { success: false, message: `Failed to restore data: ${err?.message || 'Unknown error'}` };
  }
}
