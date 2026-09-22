import {
  AuthUser,
  CaregiverConnection,
  CaregiverInvite,
  CaregiverPermissions,
  Medication,
  MedicationLog,
} from '../types';

export const api = {
  // Sync a user profile to server
  syncUser: async (user: any): Promise<boolean> => {
    try {
      const res = await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Search user by email or phone
  searchUser: async (query: string): Promise<any | null> => {
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.found ? data.user : null;
    } catch {
      return null;
    }
  },

  // Patient creates an invite (for direct email or shareable link/QR)
  createCaregiverInvite: async (params: {
    patientUid: string;
    patientName: string;
    patientEmail: string;
    patientPhone?: string;
    targetCaregiverEmail?: string;
    targetCaregiverPhone?: string;
  }): Promise<{ success: boolean; invite?: CaregiverInvite; error?: string }> => {
    try {
      const res = await fetch('/api/caregiver/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to create invite' };
      return { success: true, invite: data.invite };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error' };
    }
  },

  // Caregiver requests connection to patient by entering Patient's Email or Phone
  requestPatientConnection: async (params: {
    caregiverUid: string;
    caregiverName: string;
    caregiverEmail: string;
    caregiverPhone?: string;
    patientEmailOrPhone: string;
  }): Promise<{ success: boolean; message: string; connection?: CaregiverConnection }> => {
    try {
      const res = await fetch('/api/caregiver/request-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.message || data.error || 'Patient not found' };
      return { success: true, message: data.message, connection: data.connection };
    } catch (e: any) {
      return { success: false, message: e.message || 'Network error connecting to patient.' };
    }
  },

  // Get details of an invite token
  getInviteInfo: async (token: string): Promise<CaregiverInvite | null> => {
    try {
      const res = await fetch(`/api/caregiver/invite-info?token=${encodeURIComponent(token)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.invite || null;
    } catch {
      return null;
    }
  },

  // Caregiver accepts invite
  acceptInvite: async (params: {
    token?: string;
    inviteId?: string;
    caregiverUid: string;
    caregiverName: string;
    caregiverEmail: string;
    caregiverPhone?: string;
  }): Promise<{ success: boolean; message: string; connection?: CaregiverConnection }> => {
    try {
      const res = await fetch('/api/caregiver/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.message || 'Failed to accept invitation' };
      return { success: true, message: data.message, connection: data.connection };
    } catch (e: any) {
      return { success: false, message: e.message || 'Network error accepting invite.' };
    }
  },

  // Fetch connections and pending invites for user
  getConnections: async (
    userId: string,
    email?: string
  ): Promise<{ connections: CaregiverConnection[]; pendingInvites: CaregiverInvite[] }> => {
    try {
      const q = new URLSearchParams({ userId, email: email || '' });
      const res = await fetch(`/api/caregiver/connections?${q.toString()}`);
      if (!res.ok) return { connections: [], pendingInvites: [] };
      const data = await res.json();
      return {
        connections: data.connections || [],
        pendingInvites: data.pendingInvites || [],
      };
    } catch {
      return { connections: [], pendingInvites: [] };
    }
  },

  // Update connection status (approve, reject, revoke, permissions)
  updateConnectionStatus: async (params: {
    connectionId: string;
    userId: string;
    status?: 'active' | 'rejected' | 'revoked';
    permissions?: Partial<CaregiverPermissions>;
  }): Promise<{ success: boolean; connection?: CaregiverConnection; error?: string }> => {
    try {
      const res = await fetch('/api/caregiver/connection-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to update connection' };
      return { success: true, connection: data.connection };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error updating connection' };
    }
  },

  // Caregiver fetches live medications and logs for an authorized patient
  getAuthorizedPatientData: async (
    patientUid: string,
    caregiverUid: string
  ): Promise<{
    success: boolean;
    patientName?: string;
    permissions?: CaregiverPermissions;
    medications: Medication[];
    logs: MedicationLog[];
    error?: string;
  }> => {
    try {
      const res = await fetch(
        `/api/caregiver/patient-data/${encodeURIComponent(patientUid)}?caregiverUid=${encodeURIComponent(caregiverUid)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, medications: [], logs: [], error: data.error || 'Access denied' };
      }
      const data = await res.json();
      return {
        success: true,
        patientName: data.patientName,
        permissions: data.permissions,
        medications: data.medications || [],
        logs: data.logs || [],
      };
    } catch (e: any) {
      return { success: false, medications: [], logs: [], error: e.message || 'Network error' };
    }
  },

  // Sync local data to server
  syncDataToServer: async (payload: {
    userId: string;
    medications?: Medication[];
    logs?: MedicationLog[];
    settings?: any;
    profile?: any;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Fetch latest data from server for a user
  fetchDataFromServer: async (
    userId: string
  ): Promise<{ medications: Medication[]; logs: MedicationLog[]; settings: any } | null> => {
    try {
      const res = await fetch(`/api/sync/${encodeURIComponent(userId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
};
