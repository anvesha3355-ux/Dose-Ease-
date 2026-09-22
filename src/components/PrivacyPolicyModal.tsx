import React from 'react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
  isDarkMode,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        className={`w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh] border my-auto ${
          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">policy</span>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black">Privacy Policy</h2>
              <p className="text-xs text-slate-400">Effective: September 2026 • Version 2.0</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Scrollable Policy Content */}
        <div className="flex-1 overflow-y-auto py-5 pr-2 flex flex-col gap-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Summary Box */}
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs">
            <strong>Key Summary:</strong> DoseEase is designed with strict data isolation and privacy protection. We never sell your health data, we do not show third-party ads, and your medication logs are only accessible to caregivers you explicitly authorize via a 6-digit code.
          </div>

          {/* Section 1 */}
          <div>
            <h3 className="text-base font-extrabold text-white mb-1.5">1. Information We Collect</h3>
            <p>
              To provide personalized medication reminders and adherence management, DoseEase collects and securely processes the following categories of information:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Account Credentials:</strong> Name, email address, password hash, and optional emergency contact phone number.</li>
              <li><strong>Medication &amp; Schedule Details:</strong> Prescription medication names, strengths (e.g., 500 mg), dosages (e.g., 1 tablet), frequencies, time slots, meal timing instructions, and uploaded prescription label photos.</li>
              <li><strong>Adherence Logs &amp; Timestamps:</strong> Exact times doses are confirmed taken, snoozed, skipped, or retroactively recorded.</li>
              <li><strong>Caregiver Connections:</strong> Authorized caregiver emails, role definitions, and granted permission levels.</li>
            </ul>
          </div>

          {/* Section 2 */}
          <div>
            <h3 className="text-base font-extrabold text-white mb-1.5">2. How We Use Your Information</h3>
            <p>
              Your data is used strictly to deliver essential health management features:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Triggering timely medication reminders and senior-friendly audio alarms.</li>
              <li>Generating daily and monthly adherence calendars and progress history.</li>
              <li>Escalating unconfirmed dose alerts to your authorized caregivers if you enable caregiver oversight.</li>
              <li>Syncing offline changes securely when your device reconnects to the network.</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div>
            <h3 className="text-base font-extrabold text-white mb-1.5">3. Caregiver Access &amp; Permissions</h3>
            <p>
              Caregivers can <strong>never</strong> access your health records without your explicit permission:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Connection requires a single-use 6-digit authorization code generated on your device.</li>
              <li>All connections default to read-only access.</li>
              <li>You can modify granular permissions (view today, view history, receive unconfirmed alerts, edit schedule) or permanently revoke access at any time.</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div>
            <h3 className="text-base font-extrabold text-white mb-1.5">4. Data Storage, Security &amp; Isolation</h3>
            <p>
              All transmission is encrypted via TLS/HTTPS. Stored records are partitioned by unique user account identifiers with zero cross-tenant access. We do not use third-party analytics trackers or advertising SDKs.
            </p>
          </div>

          {/* Section 5 */}
          <div>
            <h3 className="text-base font-extrabold text-white mb-1.5">5. Data Retention &amp; Permanent Account Deletion</h3>
            <p>
              In compliance with Google Play Store policies and global privacy laws, you have the absolute right to delete your account and all associated data at any time:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>In-App Deletion:</strong> Navigate to Profile &gt; Settings &gt; "Delete Account" to immediately and irreversibly purge all your medication schedules, adherence logs, caregiver links, and profile details.</li>
              <li><strong>Web Deletion Request:</strong> You can also submit an external deletion request at our dedicated portal: <span className="font-mono text-indigo-400">/account-deletion.html</span> or by emailing support@doseease.app.</li>
            </ul>
          </div>

          {/* Section 6 */}
          <div>
            <h3 className="text-base font-extrabold text-white mb-1.5">6. Medical &amp; Health Disclaimer</h3>
            <p>
              DoseEase is an organization and reminder aid. It is <strong>not</strong> a medical device and does not provide medical advice, diagnosis, or treatment. Always consult your prescribing physician, pharmacist, or healthcare professional regarding medication instructions.
            </p>
          </div>

          {/* Section 7 */}
          <div>
            <h3 className="text-base font-extrabold text-white mb-1.5">7. Contact &amp; Privacy Officer</h3>
            <p>
              If you have any questions or data requests regarding this Privacy Policy, please contact our Data Protection Team:
            </p>
            <p className="mt-1 font-mono text-indigo-400">
              Email: privacy@doseease.app • support@doseease.app
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-700/60 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-md"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
