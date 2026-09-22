import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  AuthUser,
  CaregiverConnection,
  CaregiverInvite,
  CaregiverPermissions,
  MedicationLog,
  Medication,
} from '../types';
import {
  getPatientConnections,
  getCaregiverActivePatients,
  setConnectionStatus,
  getMedicationLogs,
  getMedications,
  saveMedication,
  deleteMedication,
  saveCaregiverConnection,
} from '../services/storage';
import { api } from '../services/api';
import { AddMedicineModal } from './AddMedicineModal';
import { DoctorReportModal } from './DoctorReportModal';
import { DrugInteractionsModal } from './DrugInteractionsModal';
import { evaluateDrugInteractions } from '../services/drugInteractions';

interface CaregiverScreenProps {
  currentUser: AuthUser;
  isDarkMode: boolean;
  showToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const CaregiverScreen: React.FC<CaregiverScreenProps> = ({
  currentUser,
  isDarkMode,
  showToast,
}) => {
  const isPatient = currentUser.profile.role === 'patient';

  // Server state
  const [serverConnections, setServerConnections] = useState<CaregiverConnection[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<CaregiverInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Patient Invite Modal States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteTab, setInviteTab] = useState<'qr' | 'email' | 'share'>('qr');
  const [targetEmail, setTargetEmail] = useState('');
  const [targetPhone, setTargetPhone] = useState('');
  const [currentInvite, setCurrentInvite] = useState<CaregiverInvite | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Caregiver Connect Modal States
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [patientInput, setPatientInput] = useState('');
  const [isSubmittingConnect, setIsSubmittingConnect] = useState(false);

  // Other Caregiver states
  const [editingPermissionsConn, setEditingPermissionsConn] = useState<CaregiverConnection | null>(null);
  const [selectedPatientUid, setSelectedPatientUid] = useState<string | null>(null);
  const [viewingPrescriptionUrl, setViewingPrescriptionUrl] = useState<string | null>(null);
  const [editingMedicationForPatient, setEditingMedicationForPatient] = useState<Medication | null | 'new'>(null);
  const [showDoctorReport, setShowDoctorReport] = useState(false);
  const [showInteractionsModal, setShowInteractionsModal] = useState(false);

  // Live Patient data fetched from server for caregiver
  const [livePatientMeds, setLivePatientMeds] = useState<Medication[]>([]);
  const [livePatientLogs, setLivePatientLogs] = useState<MedicationLog[]>([]);
  const [isLoadingPatientData, setIsLoadingPatientData] = useState(false);

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // --------------------------------------------------------------------------
  // Fetch Connections & Pending Invites from Server
  // --------------------------------------------------------------------------
  const loadConnections = async () => {
    setIsLoading(true);
    try {
      const data = await api.getConnections(currentUser.uid, currentUser.email);
      setServerConnections(data.connections);
      setIncomingInvites(data.pendingInvites);

      // Cache connections locally
      data.connections.forEach((conn) => {
        saveCaregiverConnection(conn);
      });
    } catch {
      // Fallback to local storage
      const local = isPatient
        ? getPatientConnections(currentUser.uid)
        : getCaregiverActivePatients(currentUser.uid);
      setServerConnections(local);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, [currentUser.uid, currentUser.email, refreshKey]);

  // Check URL params for invite token (e.g. user clicked link on another phone)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('caregiver_invite') || params.get('invite_token');
    if (inviteToken && !isPatient) {
      handleAcceptUrlInvite(inviteToken);
    }
  }, []);

  const handleAcceptUrlInvite = async (token: string) => {
    showToast('Processing Invite', 'Connecting with your family member...', 'info');
    const res = await api.acceptInvite({
      token,
      caregiverUid: currentUser.uid,
      caregiverName: `${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}`.trim(),
      caregiverEmail: currentUser.email,
      caregiverPhone: currentUser.profile.phoneNumber,
    });

    if (res.success) {
      showToast('Connected Successfully!', res.message, 'success');
      // Clean query param
      window.history.replaceState({}, document.title, window.location.pathname);
      setRefreshKey((k) => k + 1);
    } else {
      showToast('Connection Notice', res.message, 'warning');
    }
  };

  // Filter connections
  const patientConnections = isPatient
    ? serverConnections.filter((c) => c.patientUid === currentUser.uid && c.status !== 'revoked')
    : [];

  const caregiverActivePatients = !isPatient
    ? serverConnections.filter(
        (c) =>
          (c.caregiverUid === currentUser.uid || c.caregiverEmail.toLowerCase() === currentUser.email.toLowerCase()) &&
          c.status === 'active'
      )
    : [];

  // Default select first patient for caregiver
  const currentPatientConn =
    caregiverActivePatients.find((p) => p.patientUid === selectedPatientUid) ||
    caregiverActivePatients[0] ||
    null;

  // --------------------------------------------------------------------------
  // Fetch Authorized Patient Data from Server for Caregiver
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isPatient && currentPatientConn) {
      let isMounted = true;
      setIsLoadingPatientData(true);

      api
        .getAuthorizedPatientData(currentPatientConn.patientUid, currentUser.uid)
        .then((res) => {
          if (!isMounted) return;
          if (res.success && res.medications.length > 0) {
            setLivePatientMeds(res.medications);
            setLivePatientLogs(res.logs);
          } else {
            // Fallback to locally stored patient logs/meds if any
            const localMeds = getMedications(currentPatientConn.patientUid);
            const localLogs = getMedicationLogs(currentPatientConn.patientUid);
            setLivePatientMeds(localMeds);
            setLivePatientLogs(localLogs);
          }
        })
        .catch(() => {
          if (!isMounted) return;
          const localMeds = getMedications(currentPatientConn.patientUid);
          const localLogs = getMedicationLogs(currentPatientConn.patientUid);
          setLivePatientMeds(localMeds);
          setLivePatientLogs(localLogs);
        })
        .finally(() => {
          if (isMounted) setIsLoadingPatientData(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isPatient, currentPatientConn?.patientUid, refreshKey]);

  // Resolved patient meds & logs
  const patientLogs: MedicationLog[] = livePatientLogs.length > 0
    ? livePatientLogs
    : currentPatientConn
    ? getMedicationLogs(currentPatientConn.patientUid)
    : [];

  const patientMeds: Medication[] = livePatientMeds.length > 0
    ? livePatientMeds
    : currentPatientConn
    ? getMedications(currentPatientConn.patientUid)
    : [];

  const patientInteractionAlerts = evaluateDrugInteractions(patientMeds);

  // --------------------------------------------------------------------------
  // Patient Invite Generation (QR, Direct Email, Link)
  // --------------------------------------------------------------------------
  const handleOpenInviteModal = async () => {
    setShowInviteModal(true);
    setIsCreatingInvite(true);
    try {
      const res = await api.createCaregiverInvite({
        patientUid: currentUser.uid,
        patientName: `${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}`.trim(),
        patientEmail: currentUser.email,
        patientPhone: currentUser.profile.phoneNumber,
      });

      if (res.success && res.invite) {
        setCurrentInvite(res.invite);
        const inviteUrl = `${window.location.origin}/?caregiver_invite=${res.invite.token}`;
        const qrUrl = await QRCode.toDataURL(inviteUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: '#1e1b4b',
            light: '#ffffff',
          },
        });
        setQrCodeDataUrl(qrUrl);
      }
    } catch {
      showToast('Error', 'Failed to generate invitation link. Please try again.', 'error');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleSendDirectEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim() && !targetPhone.trim()) {
      showToast('Input Required', 'Please enter your caregiver email or phone number.', 'warning');
      return;
    }

    setIsCreatingInvite(true);
    try {
      const res = await api.createCaregiverInvite({
        patientUid: currentUser.uid,
        patientName: `${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}`.trim(),
        patientEmail: currentUser.email,
        patientPhone: currentUser.profile.phoneNumber,
        targetCaregiverEmail: targetEmail.trim() || undefined,
        targetCaregiverPhone: targetPhone.trim() || undefined,
      });

      if (res.success && res.invite) {
        setCurrentInvite(res.invite);
        showToast(
          'Invitation Sent!',
          `Invite sent to ${targetEmail || targetPhone}. When they open DoseEase, they can accept with one tap.`,
          'success'
        );
        setRefreshKey((k) => k + 1);
        setShowInviteModal(false);
        setTargetEmail('');
        setTargetPhone('');
      } else {
        showToast('Invite Error', res.error || 'Could not send invitation.', 'error');
      }
    } catch (e: any) {
      showToast('Invite Error', e.message || 'Network error sending invite.', 'error');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const getShareableUrl = () => {
    if (!currentInvite) return window.location.origin;
    return `${window.location.origin}/?caregiver_invite=${currentInvite.token}`;
  };

  const handleCopyLink = () => {
    const url = getShareableUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      showToast('Link Copied', 'Caregiver invitation link copied to clipboard.', 'success');
      setTimeout(() => setCopySuccess(false), 3000);
    });
  };

  const handleShareWhatsApp = () => {
    const url = getShareableUrl();
    const patientName = `${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}`.trim();
    const message = encodeURIComponent(
      `Hi! I use DoseEase for my daily medicine schedule. Tap this link to connect as my caregiver and monitor my schedule:\n\n${url}`
    );
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
  };

  const handleShareSMS = () => {
    const url = getShareableUrl();
    const message = encodeURIComponent(
      `Hi! Connect with me on DoseEase to view my medicine schedule: ${url}`
    );
    window.open(`sms:?&body=${message}`, '_blank');
  };

  // --------------------------------------------------------------------------
  // Caregiver Connect by Patient's Email / Phone or Link
  // --------------------------------------------------------------------------
  const handleCaregiverConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = patientInput.trim();
    if (!query) {
      showToast('Required', 'Please enter the patient email, phone, or paste an invite link.', 'warning');
      return;
    }

    setIsSubmittingConnect(true);

    try {
      // Check if user pasted a link or token
      if (query.includes('caregiver_invite=') || query.startsWith('inv_')) {
        let token = query;
        if (query.includes('caregiver_invite=')) {
          const urlObj = new URL(query);
          token = urlObj.searchParams.get('caregiver_invite') || '';
        }

        const res = await api.acceptInvite({
          token,
          caregiverUid: currentUser.uid,
          caregiverName: `${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}`.trim(),
          caregiverEmail: currentUser.email,
          caregiverPhone: currentUser.profile.phoneNumber,
        });

        if (res.success) {
          showToast('Connected!', res.message, 'success');
          setShowConnectModal(false);
          setPatientInput('');
          setRefreshKey((k) => k + 1);
        } else {
          showToast('Connection Failed', res.message, 'error');
        }
      } else {
        // Connect by Patient's Email or Phone
        const res = await api.requestPatientConnection({
          caregiverUid: currentUser.uid,
          caregiverName: `${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}`.trim(),
          caregiverEmail: currentUser.email,
          caregiverPhone: currentUser.profile.phoneNumber,
          patientEmailOrPhone: query,
        });

        if (res.success) {
          showToast('Request Submitted', res.message, 'success');
          setShowConnectModal(false);
          setPatientInput('');
          setRefreshKey((k) => k + 1);
        } else {
          showToast('Notice', res.message, 'warning');
        }
      }
    } catch (e: any) {
      showToast('Error', e.message || 'Failed to connect to patient.', 'error');
    } finally {
      setIsSubmittingConnect(false);
    }
  };

  // --------------------------------------------------------------------------
  // Accept Incoming Invite (Caregiver)
  // --------------------------------------------------------------------------
  const handleAcceptIncomingInvite = async (invite: CaregiverInvite) => {
    try {
      const res = await api.acceptInvite({
        token: invite.token,
        inviteId: invite.id,
        caregiverUid: currentUser.uid,
        caregiverName: `${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}`.trim(),
        caregiverEmail: currentUser.email,
        caregiverPhone: currentUser.profile.phoneNumber,
      });

      if (res.success) {
        showToast('Connected!', res.message, 'success');
        setRefreshKey((k) => k + 1);
      } else {
        showToast('Error', res.message, 'error');
      }
    } catch {
      showToast('Error', 'Failed to accept invitation.', 'error');
    }
  };

  // --------------------------------------------------------------------------
  // Approve / Reject / Revoke Connection (Patient or Caregiver)
  // --------------------------------------------------------------------------
  const handleApprove = async (connId: string) => {
    try {
      await api.updateConnectionStatus({
        connectionId: connId,
        userId: currentUser.uid,
        status: 'active',
      });
      setConnectionStatus(currentUser.uid, connId, 'active');
      setRefreshKey((k) => k + 1);
      showToast('Caregiver Approved', 'Your caregiver can now view your medication status.', 'success');
    } catch {
      setConnectionStatus(currentUser.uid, connId, 'active');
      setRefreshKey((k) => k + 1);
      showToast('Caregiver Approved', 'Approved locally.', 'success');
    }
  };

  const handleReject = async (connId: string) => {
    try {
      await api.updateConnectionStatus({
        connectionId: connId,
        userId: currentUser.uid,
        status: 'rejected',
      });
      setConnectionStatus(currentUser.uid, connId, 'rejected');
      setRefreshKey((k) => k + 1);
      showToast('Request Declined', 'Caregiver connection request declined.', 'info');
    } catch {
      setConnectionStatus(currentUser.uid, connId, 'rejected');
      setRefreshKey((k) => k + 1);
    }
  };

  const handleRevoke = async (connId: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove caregiver access for ${name}? They will immediately lose access to your data.`)) {
      try {
        await api.updateConnectionStatus({
          connectionId: connId,
          userId: currentUser.uid,
          status: 'revoked',
        });
      } catch {
        // ignore
      }
      setConnectionStatus(currentUser.uid, connId, 'revoked');
      setRefreshKey((k) => k + 1);
      showToast('Access Revoked', `Removed caregiver access for ${name}.`, 'warning');
    }
  };

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermissionsConn) return;

    try {
      await api.updateConnectionStatus({
        connectionId: editingPermissionsConn.id,
        userId: currentUser.uid,
        permissions: editingPermissionsConn.permissions,
      });
    } catch {
      // ignore
    }

    setConnectionStatus(
      currentUser.uid,
      editingPermissionsConn.id,
      'active',
      editingPermissionsConn.permissions
    );
    setEditingPermissionsConn(null);
    setRefreshKey((k) => k + 1);
    showToast('Permissions Updated', 'Caregiver permissions saved.');
  };

  // Helper stats for Caregiver Dashboard
  const confirmedCount = patientLogs.filter((l) => l.status === 'taken').length;
  const unconfirmedCount = patientLogs.filter(
    (l) => l.status === 'pending_confirmation' || l.status === 'missed'
  ).length;
  const totalCount = patientLogs.length;
  const adherenceRate = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 100;

  return (
    <div className="flex flex-col gap-5 pb-24" key={refreshKey}>
      {/* Executive Header Banner */}
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
            <span
              className={`text-xs font-serif font-bold uppercase tracking-widest block mb-1 ${
                isDarkMode ? 'text-amber-300' : 'text-indigo-800'
              }`}
            >
              {isPatient ? 'Family & Caregiver Circle' : 'Caregiver Oversight Portal'}
            </span>
            <h2
              className={`text-2xl sm:text-3xl font-bold tracking-wide font-serif ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {isPatient ? 'My Caregivers' : 'Patient Monitoring'}
            </h2>
            <p
              className={`text-xs sm:text-sm mt-0.5 font-serif ${
                isDarkMode ? 'text-slate-300/80' : 'text-slate-600'
              }`}
            >
              {isPatient
                ? 'Invite family members or doctors to check your medication status in real time.'
                : 'Real-time adherence verification and remote safety ledger across devices.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className={`p-2.5 rounded-2xl border transition-all ${
                isDarkMode
                  ? 'border-slate-800 bg-slate-900/60 text-slate-300 hover:text-white'
                  : 'border-indigo-100 bg-white/80 text-slate-700 hover:bg-white'
              }`}
              title="Refresh connection data"
            >
              <span className={`material-symbols-outlined text-[20px] ${isLoading ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>

            {isPatient ? (
              <button
                type="button"
                onClick={handleOpenInviteModal}
                className="min-h-[42px] px-4 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-indigo-950/60 border border-indigo-400/30 active:scale-[0.98] font-serif"
              >
                <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                <span>+ Invite Caregiver</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConnectModal(true)}
                className="min-h-[42px] px-4 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-indigo-950/60 border border-indigo-400/30 active:scale-[0.98] font-serif"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>+ Connect Patient</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* INCOMING INVITES BANNER (FOR CAREGIVERS) */}
      {/* ========================================================== */}
      {!isPatient && incomingInvites.length > 0 && (
        <div className="flex flex-col gap-3 font-serif">
          {incomingInvites.map((inv) => (
            <div
              key={inv.id}
              className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${
                isDarkMode
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 text-[26px] mt-0.5">
                  forward_to_inbox
                </span>
                <div>
                  <h4 className="font-bold text-base">
                    Patient Invitation: {inv.patientName}
                  </h4>
                  <p className="text-xs opacity-90">
                    {inv.patientEmail || inv.patientPhone || 'Your family member'} has invited you to monitor their daily medicine schedule.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleAcceptIncomingInvite(inv)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Accept & View Schedule</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================== */}
      {/* PERSPECTIVE A: PATIENT VIEW */}
      {/* ========================================================== */}
      {isPatient && (
        <div className="flex flex-col gap-4 font-serif">
          {/* Security explanation banner */}
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 ${
              isDarkMode
                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200'
                : 'bg-indigo-50/90 border-indigo-100 text-indigo-950 shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-indigo-500 text-[22px] shrink-0 mt-0.5">
              verified_user
            </span>
            <div className="text-xs">
              <span className="font-bold block text-sm mb-0.5">
                Privacy & Control First
              </span>
              Caregivers can only see your medicines after you invite or explicitly approve them. You can invite via QR code, direct email, or WhatsApp link, and revoke access anytime.
            </div>
          </div>

          {/* Pending Approval Requests */}
          {patientConnections.filter((c) => c.status === 'pending').length > 0 && (
            <div className="flex flex-col gap-2.5">
              <h3
                className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDarkMode ? 'text-amber-400' : 'text-amber-700'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                <span>Connection Requests Awaiting Your Approval</span>
              </h3>

              {patientConnections
                .filter((c) => c.status === 'pending')
                .map((conn) => (
                  <div
                    key={conn.id}
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isDarkMode
                        ? 'bg-slate-800/90 border-amber-500/40'
                        : 'bg-amber-50/80 border-amber-200 shadow-sm'
                    }`}
                  >
                    <div>
                      <h4 className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {conn.caregiverName}
                      </h4>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {conn.caregiverEmail || conn.caregiverPhone || 'Caregiver Contact'}
                      </p>
                      <span
                        className={`text-[11px] font-semibold mt-1 block ${
                          isDarkMode ? 'text-amber-400' : 'text-amber-800'
                        }`}
                      >
                        Requested permission to view your medication status
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReject(conn.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${
                          isDarkMode
                            ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(conn.id)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-md"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Approve Access</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Active Caregivers List */}
          <div className="flex flex-col gap-3">
            <h3
              className={`text-xs font-bold uppercase tracking-wider ${
                isDarkMode ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Active Caregivers ({patientConnections.filter((c) => c.status === 'active').length})
            </h3>

            {patientConnections.filter((c) => c.status === 'active').length === 0 ? (
              <div
                className={`p-8 rounded-3xl border text-center ${
                  isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-white/90 border-indigo-100 shadow-sm'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                    isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-indigo-50 text-indigo-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-[28px]">group_off</span>
                </div>
                <h4 className={`font-bold text-base ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  No Caregivers Connected Yet
                </h4>
                <p
                  className={`text-xs max-w-sm mx-auto mt-1 mb-4 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Invite your son, daughter, spouse, or doctor. They can scan your on-screen QR code or receive a direct invite to view your schedule.
                </p>
                <button
                  type="button"
                  onClick={handleOpenInviteModal}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                  <span>Invite via QR or Email</span>
                </button>
              </div>
            ) : (
              patientConnections
                .filter((c) => c.status === 'active')
                .map((conn) => (
                  <div
                    key={conn.id}
                    className={`p-5 rounded-2xl border flex flex-col gap-3.5 ${
                      isDarkMode
                        ? 'bg-slate-800/60 border-slate-700'
                        : 'bg-white/90 border-indigo-100 shadow-md shadow-indigo-100/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg border ${
                            isDarkMode
                              ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                              : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                          }`}
                        >
                          {conn.caregiverName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4
                              className={`font-bold text-base ${
                                isDarkMode ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {conn.caregiverName}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              Connected
                            </span>
                          </div>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {conn.caregiverEmail || conn.caregiverPhone || 'Authorized Family Contact'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevoke(conn.id, conn.caregiverName)}
                        className="text-xs font-bold text-rose-500 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-xl border border-rose-500/20"
                      >
                        Remove Access
                      </button>
                    </div>

                    {/* Permissions summary */}
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        isDarkMode
                          ? 'bg-slate-900/60 border-slate-700/60'
                          : 'bg-indigo-50/60 border-indigo-100'
                      }`}
                    >
                      <div>
                        <span
                          className={`block text-[10px] uppercase font-bold ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          Permissions Granted:
                        </span>
                        <span
                          className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}
                        >
                          {conn.permissions.viewTodayMedicines ? "Today's Doses • " : ''}
                          {conn.permissions.receiveUnconfirmedAlerts ? 'Missed Dose Alerts • ' : ''}
                          {conn.permissions.editMedicationSchedule ? 'Can Edit Medicines' : 'Read-Only Ledger'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPermissionsConn(conn)}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline shrink-0 ml-2"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* PERSPECTIVE B: CAREGIVER DASHBOARD */}
      {/* ========================================================== */}
      {!isPatient && (
        <div className="flex flex-col gap-5 font-serif">
          {/* Patient Selector Tabs if multiple patients */}
          {caregiverActivePatients.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className={`text-xs font-bold shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Monitoring:
              </span>
              {caregiverActivePatients.map((p) => (
                <button
                  key={p.patientUid}
                  type="button"
                  onClick={() => setSelectedPatientUid(p.patientUid)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
                    (selectedPatientUid || caregiverActivePatients[0].patientUid) === p.patientUid
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                      : 'bg-white border-indigo-100 text-slate-700 hover:bg-indigo-50/50'
                  }`}
                >
                  {p.patientName}
                </button>
              ))}
            </div>
          )}

          {!currentPatientConn ? (
            <div
              className={`p-8 rounded-3xl border text-center ${
                isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-white/90 border-indigo-100 shadow-sm'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                  isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-indigo-50 text-indigo-500'
                }`}
              >
                <span className="material-symbols-outlined text-[30px]">person_search</span>
              </div>
              <h4 className={`font-bold text-lg ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                No Connected Patients
              </h4>
              <p
                className={`text-xs max-w-sm mx-auto mt-1 mb-4 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Connect with your family member by entering their email, phone number, or scanning their QR code.
              </p>
              <button
                type="button"
                onClick={() => setShowConnectModal(true)}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>Connect with Patient</span>
              </button>
            </div>
          ) : (
            <>
              {/* Patient Banner & Doctor Report Button */}
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border ${
                  isDarkMode
                    ? 'bg-indigo-950/30 border-indigo-500/20'
                    : 'bg-indigo-50/80 border-indigo-100 shadow-sm'
                }`}
              >
                <div>
                  <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {currentPatientConn.patientName}
                  </h3>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Connected Patient •{' '}
                    {currentPatientConn.permissions.editMedicationSchedule
                      ? 'Authorized to Edit Schedule'
                      : 'Read-Only Adherence Monitor'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDoctorReport(true)}
                    className={`min-h-[40px] px-3.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                      isDarkMode
                        ? 'bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border-teal-500/40'
                        : 'bg-teal-50 hover:bg-teal-100/70 text-teal-800 border-teal-200'
                    }`}
                    title="Generate or Print Doctor's Adherence Report for Patient"
                  >
                    <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                    <span>Doctor's Report</span>
                  </button>

                  {currentPatientConn.permissions.editMedicationSchedule && (
                    <button
                      type="button"
                      onClick={() => setEditingMedicationForPatient('new')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      <span>Add Medicine</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Caregiver Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div
                  className={`p-4 rounded-2xl border ${
                    isDarkMode
                      ? 'bg-slate-800/70 border-slate-700'
                      : 'bg-white/90 border-indigo-100 shadow-md shadow-indigo-100/30'
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider block ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Today's Progress
                  </span>
                  <div className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    {confirmedCount} / {totalCount}
                  </div>
                  <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Doses confirmed taken
                  </span>
                </div>

                <div
                  className={`p-4 rounded-2xl border ${
                    isDarkMode
                      ? 'bg-slate-800/70 border-slate-700'
                      : 'bg-white/90 border-indigo-100 shadow-md shadow-indigo-100/30'
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider block ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Adherence Rate
                  </span>
                  <div
                    className={`text-2xl font-bold mt-1 ${
                      adherenceRate >= 80
                        ? isDarkMode
                          ? 'text-emerald-400'
                          : 'text-emerald-700'
                        : isDarkMode
                        ? 'text-amber-400'
                        : 'text-amber-700'
                    }`}
                  >
                    {adherenceRate}%
                  </div>
                  <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {adherenceRate >= 80 ? 'On Track' : 'Needs Follow-up'}
                  </span>
                </div>

                <div
                  className={`col-span-2 sm:col-span-1 p-4 rounded-2xl border ${
                    unconfirmedCount > 0
                      ? isDarkMode
                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                      : isDarkMode
                      ? 'bg-slate-800/70 border-slate-700'
                      : 'bg-white/90 border-indigo-100 shadow-md shadow-indigo-100/30'
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider block ${
                      unconfirmedCount > 0
                        ? 'text-rose-500 font-bold'
                        : isDarkMode
                        ? 'text-slate-400'
                        : 'text-slate-600'
                    }`}
                  >
                    Unconfirmed Alerts
                  </span>
                  <div
                    className={`text-2xl font-bold mt-1 ${
                      unconfirmedCount > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : isDarkMode
                        ? 'text-slate-300'
                        : 'text-slate-700'
                    }`}
                  >
                    {unconfirmedCount}
                  </div>
                  <span
                    className={`text-[11px] ${
                      unconfirmedCount > 0
                        ? 'text-rose-700 dark:text-rose-300 font-semibold'
                        : isDarkMode
                        ? 'text-slate-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {unconfirmedCount > 0 ? 'Missed or past grace period' : 'All clear for today'}
                  </span>
                </div>
              </div>

              {/* DRUG INTERACTIONS WARNING BANNER IF PRESENT */}
              {patientInteractionAlerts.length > 0 && (
                <div
                  className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                    isDarkMode
                      ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-rose-500 text-[26px]">
                      warning
                    </span>
                    <div>
                      <h4 className="font-bold text-sm">
                        {patientInteractionAlerts.length} Clinical Drug Interaction Alert(s) Detected
                      </h4>
                      <p className="text-xs opacity-90">
                        {patientInteractionAlerts[0].title} between{' '}
                        {patientInteractionAlerts[0].drugsInvolved.join(' & ')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInteractionsModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0"
                  >
                    View Details
                  </button>
                </div>
              )}

              {/* Today's Schedule Timeline for Patient */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Today's Medication Timeline ({patientLogs.length} Doses)
                  </h3>
                  {isLoadingPatientData && (
                    <span className="text-[11px] text-indigo-500 animate-pulse">
                      Syncing live data...
                    </span>
                  )}
                </div>

                {patientLogs.length === 0 ? (
                  <div
                    className={`p-6 rounded-2xl border text-center ${
                      isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-white/80 border-indigo-100'
                    }`}
                  >
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      No doses scheduled for today for this patient.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {patientLogs.map((log) => {
                      const isTaken = log.status === 'taken';
                      const isUnconfirmed =
                        log.status === 'pending_confirmation' || log.status === 'missed';

                      return (
                        <div
                          key={log.id}
                          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                            isTaken
                              ? isDarkMode
                                ? 'bg-emerald-950/20 border-emerald-500/30'
                                : 'bg-emerald-50/60 border-emerald-200'
                              : isUnconfirmed
                              ? isDarkMode
                                ? 'bg-rose-950/30 border-rose-500/40'
                                : 'bg-rose-50/90 border-rose-300'
                              : isDarkMode
                              ? 'bg-slate-800/60 border-slate-700'
                              : 'bg-white border-indigo-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                isTaken
                                  ? 'bg-emerald-500/20 text-emerald-500'
                                  : isUnconfirmed
                                  ? 'bg-rose-500/20 text-rose-500'
                                  : 'bg-indigo-500/20 text-indigo-500'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {isTaken ? 'check_circle' : isUnconfirmed ? 'alarm_off' : 'schedule'}
                              </span>
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h4
                                  className={`font-bold text-sm sm:text-base ${
                                    isDarkMode ? 'text-white' : 'text-slate-900'
                                  }`}
                                >
                                  {log.medicationName}
                                </h4>
                                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {log.dosage}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className={`text-xs font-semibold ${
                                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                                  }`}
                                >
                                  Scheduled: {log.scheduledTime}
                                </span>
                                {log.actualRecordedTime && (
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    • Confirmed at {log.actualRecordedTime}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                                isTaken
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : isUnconfirmed
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse'
                                  : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
                              }`}
                            >
                              {isTaken ? 'Taken' : isUnconfirmed ? 'Unconfirmed Alert' : 'Due Later'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Patient's Prescribed Medications List */}
              <div className="flex flex-col gap-3">
                <h3
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  All Prescribed Medications ({patientMeds.length})
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {patientMeds.map((med) => (
                    <div
                      key={med.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                        isDarkMode
                          ? 'bg-slate-800/60 border-slate-700'
                          : 'bg-white border-indigo-100 shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`font-bold text-base ${
                              isDarkMode ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {med.name}
                          </h4>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                            {med.dosageAmount || med.strength}
                          </span>
                        </div>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Times: {(med.scheduledTimes || []).join(', ')} • {med.mealTiming.replace(/_/g, ' ')}
                        </p>
                        {med.instructions && (
                          <p className={`text-[11px] italic mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            "{med.instructions}"
                          </p>
                        )}
                        {typeof med.currentPillsRemaining === 'number' && (
                          <div className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            Inventory: {med.currentPillsRemaining} pills left
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                        {med.prescriptionPhotoUrl ? (
                          <button
                            type="button"
                            onClick={() => setViewingPrescriptionUrl(med.prescriptionPhotoUrl || null)}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                            <span>Prescription Label</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">No label photo</span>
                        )}

                        {currentPatientConn.permissions.editMedicationSchedule && (
                          <button
                            type="button"
                            onClick={() => setEditingMedicationForPatient(med)}
                            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-500 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 1: PATIENT INVITE CAREGIVER (QR CODE / EMAIL / SHARE) */}
      {/* ========================================================== */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-serif">
          <div
            className={`w-full max-w-md rounded-3xl shadow-2xl border flex flex-col my-auto max-h-[90vh] overflow-hidden ${
              isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-indigo-100 text-slate-900'
            }`}
          >
            {/* Pinned Header */}
            <div className={`p-5 sm:p-6 border-b shrink-0 flex items-center justify-between ${
              isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-indigo-100 bg-white/90'
            }`}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </div>
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Invite Caregiver
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className={isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex flex-col gap-4 flex-1">
            {/* Sub-tabs: QR Code, Direct Email, Share Link */}
            <div className={`grid grid-cols-3 p-1 rounded-2xl border text-xs font-bold ${
              isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setInviteTab('qr')}
                className={`py-2 rounded-xl transition-all ${
                  inviteTab === 'qr'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isDarkMode
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                In-Person QR
              </button>
              <button
                type="button"
                onClick={() => setInviteTab('email')}
                className={`py-2 rounded-xl transition-all ${
                  inviteTab === 'email'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isDarkMode
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Email / Phone
              </button>
              <button
                type="button"
                onClick={() => setInviteTab('share')}
                className={`py-2 rounded-xl transition-all ${
                  inviteTab === 'share'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isDarkMode
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                WhatsApp / Link
              </button>
            </div>

            {/* TAB 1: QR CODE */}
            {inviteTab === 'qr' && (
              <div className="flex flex-col items-center text-center gap-3">
                <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Have your caregiver point their phone camera at this QR code. It will open DoseEase and connect automatically!
                </p>

                <div className="p-3 bg-white rounded-2xl border-4 border-indigo-500/30 shadow-lg my-1">
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="Caregiver Connection QR Code"
                      className="w-56 h-56 object-contain"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center text-slate-500 animate-pulse">
                      Generating QR Code...
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      copySuccess
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : isDarkMode
                        ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                        : 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {copySuccess ? 'check' : 'content_copy'}
                    </span>
                    <span>{copySuccess ? 'Copied Link!' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">share</span>
                    <span>Send on WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: DIRECT EMAIL OR PHONE */}
            {inviteTab === 'email' && (
              <form onSubmit={handleSendDirectEmailInvite} className="flex flex-col gap-3.5">
                <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Enter your family member's email or mobile phone. When they open DoseEase, they will see a notification to accept.
                </p>

                <div>
                  <label
                    className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    Caregiver Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. daughter@gmail.com"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    className={`w-full py-2.5 px-3.5 rounded-xl border text-xs sm:text-sm outline-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                        : 'bg-white border-indigo-200 text-slate-900 focus:border-indigo-600'
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    Or Caregiver Mobile Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 555-0199 or 9876543210"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    className={`w-full py-2.5 px-3.5 rounded-xl border text-xs sm:text-sm outline-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                        : 'bg-white border-indigo-200 text-slate-900 focus:border-indigo-600'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingInvite}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md mt-1 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span>{isCreatingInvite ? 'Sending...' : 'Send Caregiver Invitation'}</span>
                </button>
              </form>
            )}

            {/* TAB 3: SHAREABLE LINK / WHATSAPP / SMS */}
            {inviteTab === 'share' && (
              <div className="flex flex-col gap-3">
                <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Share this secure connection link with your family member via messaging apps:
                </p>

                <div
                  className={`p-3 rounded-xl border text-xs break-all font-mono select-all ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  }`}
                >
                  {getShareableUrl()}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      copySuccess
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : isDarkMode
                        ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                        : 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {copySuccess ? 'check' : 'content_copy'}
                    </span>
                    <span>{copySuccess ? 'Copied!' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                    <span>WhatsApp</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleShareSMS}
                  className={`w-full py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">sms</span>
                  <span>Share via Text Message (SMS)</span>
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 2: CAREGIVER CONNECT TO PATIENT BY EMAIL / PHONE / LINK */}
      {/* ========================================================== */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-serif">
          <div
            className={`w-full max-w-md rounded-3xl shadow-2xl border flex flex-col my-auto max-h-[90vh] overflow-hidden ${
              isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-indigo-100 text-slate-900'
            }`}
          >
            {/* Pinned Header */}
            <div className={`p-5 sm:p-6 border-b shrink-0 flex items-center justify-between ${
              isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-indigo-100 bg-white/90'
            }`}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </div>
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Connect to Patient
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className={isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex flex-col gap-4 flex-1">
              <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Enter the registered email or phone number of your family member, or paste the invitation link they shared with you.
              </p>

              <form onSubmit={handleCaregiverConnect} className="flex flex-col gap-4">
                <div>
                  <label
                    className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Patient's Email, Phone, or Invite Link
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ramesh@example.com, 9876543210, or paste link"
                    value={patientInput}
                    onChange={(e) => setPatientInput(e.target.value)}
                    className={`w-full text-sm font-medium py-3 px-4 rounded-2xl border outline-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                        : 'bg-white border-indigo-200 text-slate-900 focus:border-indigo-600'
                    }`}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConnectModal(false)}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs ${
                      isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingConnect}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    <span>{isSubmittingConnect ? 'Connecting...' : 'Connect to Patient'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 3: EDIT PERMISSIONS (FOR PATIENT) */}
      {/* ========================================================== */}
      {editingPermissionsConn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-serif">
          <div
            className={`w-full max-w-md rounded-3xl shadow-2xl border flex flex-col my-auto max-h-[90vh] overflow-hidden ${
              isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-indigo-100 text-slate-900'
            }`}
          >
            {/* Pinned Header */}
            <div className={`p-5 sm:p-6 border-b shrink-0 flex items-center justify-between ${
              isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-indigo-100 bg-white/90'
            }`}>
              <div>
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Caregiver Permissions
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  For {editingPermissionsConn.caregiverName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPermissionsConn(null)}
                className={isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSavePermissions} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex flex-col gap-3 flex-1">
                {[
                  {
                    key: 'viewTodayMedicines',
                    title: "View Today's Medicines",
                    desc: 'Can see medicine names and scheduled times',
                  },
                  {
                    key: 'viewMedicationStatus',
                    title: 'View Medication Status',
                    desc: 'Can see whether doses are taken, skipped, or pending',
                  },
                  {
                    key: 'receiveUnconfirmedAlerts',
                    title: 'Receive Unconfirmed Alerts',
                    desc: 'Caregiver alerted if medicine is unconfirmed past grace period',
                  },
                  {
                    key: 'viewMedicationHistory',
                    title: 'View Past Medication History',
                    desc: 'Can view past 7-day and 30-day logs',
                  },
                  {
                    key: 'editMedicationSchedule',
                    title: 'Edit Medication Schedule',
                    desc: 'Allow caregiver to add/edit medicines (default is off)',
                  },
                ].map((perm) => (
                  <label
                    key={perm.key}
                    className={`flex items-start justify-between p-3 rounded-2xl border cursor-pointer gap-3 ${
                      isDarkMode
                        ? 'bg-slate-800/80 border-slate-700'
                        : 'bg-indigo-50/50 border-indigo-100 hover:bg-indigo-50/80'
                    }`}
                  >
                    <div>
                      <span className={`font-bold text-xs sm:text-sm block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {perm.title}
                      </span>
                      <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {perm.desc}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editingPermissionsConn.permissions[perm.key as keyof CaregiverPermissions]}
                      onChange={(e) => {
                        setEditingPermissionsConn({
                          ...editingPermissionsConn,
                          permissions: {
                            ...editingPermissionsConn.permissions,
                            [perm.key]: e.target.checked,
                          },
                        });
                      }}
                      className="w-5 h-5 accent-indigo-600 rounded mt-0.5"
                    />
                  </label>
                ))}
              </div>

              {/* Pinned Action Buttons */}
              <div className={`p-4 sm:p-5 border-t shrink-0 flex gap-2 ${
                isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-indigo-100 bg-white/90'
              }`}>
                <button
                  type="button"
                  onClick={() => setEditingPermissionsConn(null)}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs ${
                    isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md"
                >
                  Save Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 4: FULL-SIZE PRESCRIPTION VIEWER */}
      {/* ========================================================== */}
      {viewingPrescriptionUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-serif">
          <div
            className={`p-4 rounded-3xl max-w-lg w-full flex flex-col gap-3 shadow-2xl border my-auto max-h-[90vh] overflow-hidden ${
              isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-indigo-100 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isDarkMode ? 'text-indigo-400' : 'text-indigo-700'
                }`}
              >
                Doctor Prescription Slip / Bottle Label
              </span>
              <button
                type="button"
                onClick={() => setViewingPrescriptionUrl(null)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  isDarkMode
                    ? 'bg-slate-800 text-slate-300 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                ✕
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-black flex items-center justify-center max-h-[70vh]">
              <img
                src={viewingPrescriptionUrl}
                alt="Prescription label preview"
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setViewingPrescriptionUrl(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 5: CAREGIVER EDIT/ADD MEDICINE FOR PATIENT */}
      {/* ========================================================== */}
      {currentPatientConn && editingMedicationForPatient && (
        <AddMedicineModal
          isOpen={!!editingMedicationForPatient}
          editingMedication={editingMedicationForPatient === 'new' ? null : editingMedicationForPatient}
          existingMedications={patientMeds}
          onClose={() => setEditingMedicationForPatient(null)}
          userId={currentPatientConn.patientUid}
          isDarkMode={isDarkMode}
          onSave={(med) => {
            saveMedication(currentPatientConn.patientUid, med);
            setEditingMedicationForPatient(null);
            setRefreshKey((k) => k + 1);
            showToast('Medicine Updated', `${med.name} saved for ${currentPatientConn.patientName}.`, 'success');
          }}
          onDelete={(medId) => {
            deleteMedication(currentPatientConn.patientUid, medId);
            setEditingMedicationForPatient(null);
            setRefreshKey((k) => k + 1);
            showToast('Medicine Deleted', `Removed from ${currentPatientConn.patientName}'s plan.`, 'info');
          }}
        />
      )}

      {/* ========================================================== */}
      {/* MODAL 6: CLINICAL ADHERENCE REPORT FOR PATIENT */}
      {/* ========================================================== */}
      {currentPatientConn && (
        <DoctorReportModal
          isOpen={showDoctorReport}
          onClose={() => setShowDoctorReport(false)}
          currentUser={currentUser}
          isDarkMode={isDarkMode}
          targetPatientName={currentPatientConn.patientName}
          targetPatientUid={currentPatientConn.patientUid}
        />
      )}

      {/* ========================================================== */}
      {/* MODAL 7: DRUG INTERACTIONS SAFETY CHECKER FOR PATIENT */}
      {/* ========================================================== */}
      {currentPatientConn && showInteractionsModal && (
        <DrugInteractionsModal
          alerts={patientInteractionAlerts}
          medications={patientMeds}
          onClose={() => setShowInteractionsModal(false)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};
