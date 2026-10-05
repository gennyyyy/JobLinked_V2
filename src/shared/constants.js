export const ROLES = { SUPER_ADMIN: 'super-admin', EMPLOYER: 'employer', JOB_SEEKER: 'job-seeker' };

export const EMPLOYMENT_STATUSES = ['Employed', 'Unemployed', 'Underemployed', 'Fresh Graduate'];

export const JOB_TAGS = [
  'Urgent Hiring',
  'Fresh Grad Friendly',
  'No Experience Needed',
  'Training Provided',
  'Career Growth',
  'Flexible Schedule',
  'Day Shift',
];

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
