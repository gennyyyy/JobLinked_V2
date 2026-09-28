export const ROLES = { SUPER_ADMIN: 'super-admin', EMPLOYER: 'employer', JOB_SEEKER: 'job-seeker' };

export const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'];

export const EMPLOYMENT_STATUSES = ['Employed', 'Unemployed', 'Underemployed', 'Fresh Graduate'];

export const JOB_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'published', 'closed', 'archived'];

export const JOB_TAGS = [
  'Urgent Hiring',
  'Fresh Grad Friendly',
  'No Experience Needed',
  'Training Provided',
  'Career Growth',
  'Flexible Schedule',
  'Day Shift',
];

export const APPLICATION_STATUSES = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Accepted', 'Rejected', 'Placed', 'Terminated'];

export const ACCREDITATION_STATUSES = ['none', 'pending', 'approved', 'rejected', 'resubmission'];

export const DOCUMENT_STATUSES = ['pending', 'verified', 'rejected', 'missing'];

export const FB_POST_STATUSES = ['pending', 'posting', 'posted', 'failed', 'retry'];

export const DOC_TYPES = [
  'Letter of Intent',
  'Company Profile',
  'Business Permit',
  'DTI Certificate',
  'Job Orders',
  'PhilJobNet Accreditation',
  'Pag-IBIG Registration',
  'PhilHealth Registration',
  'Fire Safety Inspection Certificate',
];

export const NOTIFICATION_TYPES = {
  APPLICATION: 'application',
  JOB: 'job',
  ACCREDITATION: 'accreditation',
  DOCUMENT: 'document',
  SYSTEM: 'system',
};

export const PORTALS = [
  { key: ROLES.SUPER_ADMIN, name: 'PESO Super Admin', path: '/super-admin/login', homePath: '/super-admin' },
  { key: ROLES.EMPLOYER, name: 'Employer Portal', path: '/employer/login', homePath: '/employer' },
  { key: ROLES.JOB_SEEKER, name: 'Job Seeker Portal', path: '/job-seeker/login', homePath: '/job-seeker' },
];
