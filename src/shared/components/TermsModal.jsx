import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useDialog from "../hooks/useDialog";

const TERMS_PLACEHOLDER = `JOBLINKED EMPLOYEE / JOB SEEKER SIGN-UP
Municipal Data Collection Terms and PESO Privacy Policy
JobLinked collects and processes information you provide to create your account and support job matching, employment applications, and application tracking through the Public Employment Service Office (PESO).

1. Information Collected
We collect your name, residential address or barangay, contact details, educational background, skills, qualifications, certifications, employment history, employment status, and job preferences. We also process résumés, supporting documents, application records, referrals, and recruitment status updates you submit or generate through the platform.
Only information necessary for the requested service will be collected. Required and optional fields will be identified. Additional sensitive information will be requested only when necessary, with its purpose and legal basis explained before collection.

2. Use of Information
Your information will be used to:
• Create and manage your JobLinked account and applicant profile;
• Match your qualifications and preferences with job vacancies;
• Process applications and facilitate PESO employment assistance;
• Display and update your application status;
• Send relevant account, application, and service notifications; and
• Prepare authorized municipal employment reports, using aggregated or anonymized information for public reporting.

3. Access and Sharing
Authorized PESO personnel may access information necessary to provide employment services and prepare authorized reports. Technical personnel and service providers may process information only as necessary to operate and secure JobLinked, subject to confidentiality and security obligations.
When you apply for a job, the application screen will identify the receiving employer and the information and documents to be shared before you confirm submission.
Sharing your profile with other prospective employers for additional PESO referrals requires a separate legal basis, including your optional consent where applicable. Your profile will not be sold or published as a public applicant directory.

4. Protection and Retention
Appropriate safeguards will be applied to protect your information and restrict access to authorized users.
Records will be retained only while necessary for the stated services or applicable legal and government records requirements. When retention is no longer necessary or legally required, information will be securely deleted, disposed of, or anonymized.
Closing your account does not automatically erase records that must lawfully be retained.

5. Privacy Rights and Withdrawal
Subject to applicable legal requirements, you may request access to or correction of your records, object to processing, withdraw consent, or request deletion or blocking of information.
You may submit requests to the PESO office handling your registration for referral to the Municipality's designated Data Protection Officer. You may also raise a complaint with the National Privacy Commission.
Withdrawal applies to future processing based on consent and does not invalidate earlier lawful processing or override legal retention requirements.

6. User Responsibilities and Service Limitations
You agree to provide accurate information, submit documents you are authorized to provide, update relevant profile details, and keep your login credentials confidential.
Registration, job matching, and referrals do not guarantee employment. Employers remain responsible for their hiring decisions. JobLinked does not process payroll, salary payouts, or monetary transactions between employers and employees.
Participation in research or system evaluation requires a separate explanation and consent where applicable.

7. Legal Basis and Policy Updates
Information will be processed in accordance with Republic Act No. 10173, or the Data Privacy Act of 2012, its implementing rules, applicable PESO legislation, and relevant municipal requirements.
Processing required for government functions or legal obligations will be identified accordingly. Specific consent will be requested where consent is the applicable legal basis.
Material policy changes will be communicated through JobLinked. New purposes requiring consent will be presented separately.`;

function TermsModal({ open, onClose, onRead, title = "Data Collection Terms & Privacy Policy", body = TERMS_PLACEHOLDER }) {
  const bodyRef = useRef(null);
  const readRef = useRef(false);
  const [read, setRead] = useState(false);

  const markRead = useCallback(() => {
    if (readRef.current) return;
    readRef.current = true;
    setRead(true);
    onRead?.();
  }, [onRead]);

  // Read = scrolled to the bottom (24px grace). Short content that
  // doesn't scroll counts as read as soon as it's shown.
  function handleScroll(e) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) markRead();
  }

  const panelRef = useDialog(onClose, open);

  useEffect(() => {
    if (!open) return;
    const el = bodyRef.current;
    if (el && el.scrollHeight - el.clientHeight < 24) markRead();
  }, [open, markRead]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        className="bg-white border border-primary rounded-lg p-5 max-w-lg w-[calc(100%-2rem)] max-h-[80vh] flex flex-col shadow-2xl"
      >
        <h2 id="terms-title" className="text-base font-bold text-dark-blue mb-3">
          {title}
        </h2>
        <div ref={bodyRef} onScroll={handleScroll} tabIndex={0} role="document" aria-labelledby="terms-title" className="text-sm text-gray-700 whitespace-pre-line overflow-y-auto flex-1 mb-6">
          {body}
        </div>
        <div className="flex gap-3 items-center justify-end">
          {onRead && !read && (
            <span className="mr-auto text-xs text-gray-500">Scroll to the bottom to enable agreement.</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white rounded-xl bg-primary hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default TermsModal;
