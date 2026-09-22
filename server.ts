import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// ----------------------------------------------------------------------
// PERSISTENT DATA STORAGE (CROSS-DEVICE DATABASE)
// ----------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'doseease_db.json');

interface ServerDB {
  users: Array<{
    uid: string;
    email: string;
    passwordHash: string;
    salt: string;
    profile: any;
  }>;
  medications: Record<string, any[]>; // userId -> Medication[]
  logs: Record<string, any[]>; // userId -> MedicationLog[]
  connections: Array<{
    id: string;
    patientUid: string;
    patientName: string;
    patientEmail: string;
    patientPhone?: string;
    caregiverUid: string;
    caregiverName: string;
    caregiverEmail: string;
    caregiverPhone?: string;
    status: 'pending' | 'active' | 'rejected' | 'revoked';
    permissions: any;
    createdAt: string;
    approvedAt?: string;
  }>;
  invites: Array<{
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
  }>;
  settings: Record<string, any>;
}

const defaultDB: ServerDB = {
  users: [],
  medications: {},
  logs: {},
  connections: [],
  invites: [],
  settings: {},
};

let db: ServerDB = { ...defaultDB };

function loadDB(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = { ...defaultDB, ...JSON.parse(data) };
    } else {
      saveDB();
    }
  } catch (err) {
    console.error('Error loading database file:', err);
    db = { ...defaultDB };
  }
}

function saveDB(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

// Initial load
loadDB();

// ----------------------------------------------------------------------
// API ROUTES
// ----------------------------------------------------------------------

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sync User from Client to Server
app.post('/api/users/sync', (req: Request, res: Response) => {
  try {
    const user = req.body;
    if (!user || !user.uid || !user.email) {
      return res.status(400).json({ error: 'Invalid user payload' });
    }
    const idx = db.users.findIndex((u) => u.uid === user.uid || u.email.toLowerCase() === user.email.toLowerCase());
    if (idx >= 0) {
      db.users[idx] = { ...db.users[idx], ...user };
    } else {
      db.users.push(user);
    }
    saveDB();
    return res.json({ success: true, count: db.users.length });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Query user by email or phone (for connection matching)
app.get('/api/users/search', (req: Request, res: Response) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  if (!query) {
    return res.json({ found: false });
  }
  const user = db.users.find(
    (u) =>
      u.email.toLowerCase() === query ||
      (u.profile?.phoneNumber && u.profile.phoneNumber.replace(/\s+/g, '').includes(query.replace(/\s+/g, '')))
  );

  if (user) {
    return res.json({
      found: true,
      user: {
        uid: user.uid,
        email: user.email,
        firstName: user.profile?.firstName,
        lastName: user.profile?.lastName,
        role: user.profile?.role,
        phoneNumber: user.profile?.phoneNumber,
      },
    });
  }
  return res.json({ found: false });
});

// ----------------------------------------------------------------------
// CAREGIVER CONNECTION & INVITATION API
// ----------------------------------------------------------------------

// 1. Create Invite Link / Direct Invite (Patient -> Caregiver)
app.post('/api/caregiver/invite', (req: Request, res: Response) => {
  try {
    const {
      patientUid,
      patientName,
      patientEmail,
      patientPhone,
      targetCaregiverEmail,
      targetCaregiverPhone,
    } = req.body;

    if (!patientUid || !patientName) {
      return res.status(400).json({ error: 'Patient information required' });
    }

    // Generate clean unique invite token
    const token = `inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const inviteId = `invite_${Date.now()}`;

    const newInvite = {
      id: inviteId,
      token,
      patientUid,
      patientName,
      patientEmail: patientEmail || '',
      patientPhone: patientPhone || '',
      targetCaregiverEmail: targetCaregiverEmail ? targetCaregiverEmail.trim().toLowerCase() : undefined,
      targetCaregiverPhone: targetCaregiverPhone ? targetCaregiverPhone.trim() : undefined,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    // Remove any older pending invites for this exact patient & target email
    db.invites = db.invites.filter(
      (inv) =>
        !(inv.patientUid === patientUid &&
          inv.targetCaregiverEmail &&
          inv.targetCaregiverEmail === newInvite.targetCaregiverEmail &&
          inv.status === 'pending')
    );
    db.invites.push(newInvite);

    // If targetCaregiverEmail is already registered on the system, also create a pending CaregiverConnection
    // so it shows up in their dashboard right away!
    if (newInvite.targetCaregiverEmail) {
      const existingCaregiver = db.users.find(
        (u) => u.email.toLowerCase() === newInvite.targetCaregiverEmail
      );
      if (existingCaregiver) {
        const existingConn = db.connections.find(
          (c) =>
            c.patientUid === patientUid &&
            c.caregiverUid === existingCaregiver.uid &&
            c.status !== 'revoked' &&
            c.status !== 'rejected'
        );
        if (!existingConn) {
          const connId = `conn_${Date.now()}`;
          db.connections.push({
            id: connId,
            patientUid,
            patientName,
            patientEmail: patientEmail || '',
            patientPhone: patientPhone || '',
            caregiverUid: existingCaregiver.uid,
            caregiverName: `${existingCaregiver.profile?.firstName || 'Caregiver'} ${existingCaregiver.profile?.lastName || ''}`.trim(),
            caregiverEmail: existingCaregiver.email,
            caregiverPhone: existingCaregiver.profile?.phoneNumber,
            status: 'pending',
            permissions: {
              viewTodayMedicines: true,
              viewMedicationStatus: true,
              receiveUnconfirmedAlerts: true,
              viewMedicationHistory: true,
              editMedicationSchedule: false,
            },
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    saveDB();
    return res.json({ success: true, invite: newInvite });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 2. Caregiver requests connection to Patient (by Patient's Email or Phone)
app.post('/api/caregiver/request-patient', (req: Request, res: Response) => {
  try {
    const { caregiverUid, caregiverName, caregiverEmail, caregiverPhone, patientEmailOrPhone } = req.body;
    if (!caregiverUid || !caregiverEmail || !patientEmailOrPhone) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const cleanTarget = patientEmailOrPhone.trim().toLowerCase();

    // Find patient in database
    const patientUser = db.users.find((u) => {
      const emailMatch = u.email.toLowerCase() === cleanTarget;
      const phoneMatch =
        u.profile?.phoneNumber &&
        u.profile.phoneNumber.replace(/\s+/g, '') === cleanTarget.replace(/\s+/g, '');
      return emailMatch || phoneMatch;
    });

    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: `No patient account found with "${patientEmailOrPhone}". Please ensure your family member is registered on DoseEase.`,
      });
    }

    if (patientUser.uid === caregiverUid) {
      return res.status(400).json({
        success: false,
        message: 'You cannot connect to your own account as a caregiver.',
      });
    }

    // Check if connection already exists
    const existing = db.connections.find(
      (c) =>
        c.patientUid === patientUser.uid &&
        c.caregiverUid === caregiverUid &&
        c.status !== 'revoked' &&
        c.status !== 'rejected'
    );

    if (existing) {
      return res.json({
        success: true,
        message: `A connection with ${patientUser.profile?.firstName || 'this patient'} is already active or awaiting approval.`,
        connection: existing,
      });
    }

    const newConn = {
      id: `conn_${Date.now()}`,
      patientUid: patientUser.uid,
      patientName: `${patientUser.profile?.firstName || 'Patient'} ${patientUser.profile?.lastName || ''}`.trim(),
      patientEmail: patientUser.email,
      patientPhone: patientUser.profile?.phoneNumber,
      caregiverUid,
      caregiverName,
      caregiverEmail,
      caregiverPhone,
      status: 'pending' as const,
      permissions: {
        viewTodayMedicines: true,
        viewMedicationStatus: true,
        receiveUnconfirmedAlerts: true,
        viewMedicationHistory: true,
        editMedicationSchedule: false,
      },
      createdAt: new Date().toISOString(),
    };

    db.connections.push(newConn);
    saveDB();

    return res.json({
      success: true,
      message: `Connection request sent to ${newConn.patientName}. They will see an approval request in their app.`,
      connection: newConn,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 3. Get Details of an Invite Token (When caregiver opens invite link or scans QR)
app.get('/api/caregiver/invite-info', (req: Request, res: Response) => {
  const token = String(req.query.token || '').trim();
  if (!token) return res.status(400).json({ error: 'Token is required' });

  const invite = db.invites.find((inv) => inv.token === token);
  if (!invite) {
    return res.status(404).json({ error: 'Invite link not found or has been revoked.' });
  }

  if (invite.expiresAt < Date.now()) {
    return res.status(410).json({ error: 'This invitation link has expired. Please ask the patient for a fresh invite link.' });
  }

  return res.json({ success: true, invite });
});

// 4. Accept Invite (One-tap connect via token or direct approval)
app.post('/api/caregiver/accept-invite', (req: Request, res: Response) => {
  try {
    const { token, inviteId, caregiverUid, caregiverName, caregiverEmail, caregiverPhone } = req.body;

    let invite = null;
    if (token) {
      invite = db.invites.find((i) => i.token === token);
    } else if (inviteId) {
      invite = db.invites.find((i) => i.id === inviteId);
    }

    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invitation record not found or expired.' });
    }

    if (invite.patientUid === caregiverUid) {
      return res.status(400).json({ success: false, message: 'You cannot connect to yourself as a caregiver.' });
    }

    // Check if connection already exists
    let existing = db.connections.find(
      (c) => c.patientUid === invite.patientUid && c.caregiverUid === caregiverUid
    );

    if (existing) {
      existing.status = 'active';
      existing.approvedAt = new Date().toISOString();
    } else {
      existing = {
        id: `conn_${Date.now()}`,
        patientUid: invite.patientUid,
        patientName: invite.patientName,
        patientEmail: invite.patientEmail,
        patientPhone: invite.patientPhone,
        caregiverUid,
        caregiverName,
        caregiverEmail,
        caregiverPhone,
        status: 'active', // Pre-authorized through the trusted link/QR
        permissions: {
          viewTodayMedicines: true,
          viewMedicationStatus: true,
          receiveUnconfirmedAlerts: true,
          viewMedicationHistory: true,
          editMedicationSchedule: false,
        },
        createdAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
      };
      db.connections.push(existing);
    }

    invite.status = 'accepted';
    saveDB();

    return res.json({
      success: true,
      message: `Successfully connected with ${invite.patientName}! You can now monitor their medications and adherence.`,
      connection: existing,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 5. Get Connections for a User (Patient or Caregiver)
app.get('/api/caregiver/connections', (req: Request, res: Response) => {
  const userId = String(req.query.userId || '').trim();
  const userEmail = String(req.query.email || '').trim().toLowerCase();

  if (!userId && !userEmail) {
    return res.json({ connections: [], pendingInvites: [] });
  }

  // Connections where user is either patient or caregiver
  const connections = db.connections.filter(
    (c) =>
      c.patientUid === userId ||
      c.caregiverUid === userId ||
      (userEmail && c.caregiverEmail.toLowerCase() === userEmail) ||
      (userEmail && c.patientEmail.toLowerCase() === userEmail)
  );

  // Incoming pending invites for this caregiver email/phone
  const pendingInvites = db.invites.filter(
    (inv) =>
      inv.status === 'pending' &&
      inv.expiresAt > Date.now() &&
      ((userEmail && inv.targetCaregiverEmail === userEmail) || inv.patientUid === userId)
  );

  return res.json({ connections, pendingInvites });
});

// 6. Update Connection Status (Approve / Reject / Revoke / Edit Permissions)
app.post('/api/caregiver/connection-status', (req: Request, res: Response) => {
  try {
    const { connectionId, userId, status, permissions } = req.body;
    const conn = db.connections.find((c) => c.id === connectionId);

    if (!conn) {
      return res.status(404).json({ error: 'Connection record not found' });
    }

    // Security check
    if (conn.patientUid !== userId && conn.caregiverUid !== userId) {
      return res.status(403).json({ error: 'Unauthorized to modify this connection' });
    }

    if (status) {
      conn.status = status;
      if (status === 'active') {
        conn.approvedAt = new Date().toISOString();
      }
    }

    if (permissions) {
      conn.permissions = { ...conn.permissions, ...permissions };
    }

    saveDB();
    return res.json({ success: true, connection: conn });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 7. Get Authorized Patient Data for Caregiver (Medications & Logs)
app.get('/api/caregiver/patient-data/:patientUid', (req: Request, res: Response) => {
  const patientUid = req.params.patientUid;
  const caregiverUid = String(req.query.caregiverUid || '').trim();

  // Verify that caregiver has active connection with patient
  const connection = db.connections.find(
    (c) => c.patientUid === patientUid && c.caregiverUid === caregiverUid && c.status === 'active'
  );

  if (!connection) {
    return res.status(403).json({ error: 'Unauthorized: No active caregiver authorization for this patient' });
  }

  const medications = db.medications[patientUid] || [];
  const logs = db.logs[patientUid] || [];

  return res.json({
    success: true,
    patientName: connection.patientName,
    permissions: connection.permissions,
    medications,
    logs,
  });
});

// ----------------------------------------------------------------------
// DATA SYNCHRONIZATION API (MEDICATIONS & LOGS)
// ----------------------------------------------------------------------

// Full sync from client to server (ensures patient medications & logs exist on server)
app.post('/api/sync', (req: Request, res: Response) => {
  try {
    const { userId, medications, logs, settings, profile } = req.body;
    if (!userId) return res.status(400).json({ error: 'UserId required' });

    if (medications && Array.isArray(medications)) {
      db.medications[userId] = medications;
    }

    if (logs && Array.isArray(logs)) {
      // Merge logs cleanly
      const existing = db.logs[userId] || [];
      const logMap = new Map<string, any>();
      existing.forEach((l) => logMap.set(l.id, l));
      logs.forEach((l) => logMap.set(l.id, l));
      db.logs[userId] = Array.from(logMap.values());
    }

    if (settings) {
      db.settings[userId] = settings;
    }

    if (profile) {
      const idx = db.users.findIndex((u) => u.uid === userId);
      if (idx >= 0) {
        db.users[idx].profile = { ...db.users[idx].profile, ...profile };
      }
    }

    saveDB();
    return res.json({
      success: true,
      medicationsCount: db.medications[userId]?.length || 0,
      logsCount: db.logs[userId]?.length || 0,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Fetch latest data for a user
app.get('/api/sync/:userId', (req: Request, res: Response) => {
  const userId = req.params.userId;
  return res.json({
    medications: db.medications[userId] || [],
    logs: db.logs[userId] || [],
    settings: db.settings[userId] || null,
  });
});

// Download Project Source ZIP archive
app.get('/api/download-zip', (_req: Request, res: Response) => {
  const zipPath = path.join(process.cwd(), 'public', 'doseease-app.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="doseease-app.zip"');
    return res.sendFile(zipPath);
  }
  return res.status(404).json({ error: 'Zip file not generated yet' });
});

// ----------------------------------------------------------------------
// VITE DEV & PRODUCTION SERVING
// ----------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DoseEase server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
