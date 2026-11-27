import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  Handshake,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';

export const ROLES = { SUPER_ADMIN: 'super-admin', EMPLOYER: 'employer', JOB_SEEKER: 'job-seeker' };

export const ROLE_LABELS = {
  'super-admin': 'PESO Admin',
  employer: 'Employer',
  'job-seeker': 'Job Seeker',
};

// Mirrors the reference design's PORTAL_NAV, mapped onto this app's routes.
export const PORTAL_NAV = {
  'job-seeker': [
    { label: 'Overview', path: '/job-seeker', icon: LayoutDashboard, end: true },
    { label: 'My profile', path: '/job-seeker/profile', icon: UserRound },
    { label: 'Browse Jobs', path: '/job-seeker/jobs', icon: Search },
    { label: 'Saved jobs', path: '/job-seeker/saved', icon: Bookmark },
    { label: 'My applications', path: '/job-seeker/applications', icon: ClipboardList },
    { label: 'Employment Tracking', path: '/job-seeker/employment', icon: BriefcaseBusiness },
    { label: 'Notifications', path: '/job-seeker/notifications', icon: Bell },
  ],
  employer: [
    { label: 'Overview', path: '/employer', icon: LayoutDashboard, end: true },
    { label: 'Accreditation', path: '/employer/accreditation', icon: ShieldCheck },
    { label: 'Company profile', path: '/employer/company', icon: Building2 },
    { label: 'Job management', path: '/employer/job-posts', icon: BriefcaseBusiness },
    { label: 'Applicants', path: '/employer/applicants', icon: Users },
    { label: 'Employees Tracking', path: '/employer/employees', icon: BriefcaseBusiness },
    { label: 'Notifications', path: '/employer/notifications', icon: Bell },
  ],
  'super-admin': [
    { label: 'Overview', path: '/super-admin', icon: LayoutDashboard, end: true },
    { label: 'My profile', path: '/super-admin/profile', icon: UserRound },
    { label: 'Employer accreditation', path: '/super-admin/accreditation', icon: ShieldCheck, permission: 'accreditation.manage' },
    { label: 'User management', path: '/super-admin/users', icon: Users, permissions: ['users.manage', 'roles.manage'] },
    { label: 'Employment oversight', path: '/super-admin/employment-tracking', icon: Handshake },
    { label: 'Job vacancy oversight', path: '/super-admin/job-posts', icon: BriefcaseBusiness, permission: 'jobs.manage' },
    { label: 'Applications & placements', path: '/super-admin/applications', icon: Handshake },
    { label: 'Reports & insights', path: '/super-admin/reports', icon: ChartNoAxesCombined, permission: 'reports.view' },
    { label: 'Announcements', path: '/super-admin/broadcast', icon: Megaphone, permission: 'notifications.send' },
    { label: 'Audit log', path: '/super-admin/logs', icon: ScrollText, permission: 'logs.view' },
    { label: 'Notifications', path: '/super-admin/notifications', icon: Bell },
    { label: 'System settings', path: '/super-admin/settings', icon: Settings, permission: 'settings.manage' },
  ],
};

export const EMPLOYMENT_STATUSES = ['Employed', 'Unemployed', 'Underemployed', 'Fresh Graduate', 'Student'];

// Curated nationality options; the server still stores free text.
export const NATIONALITIES = [
  'Filipino', 'American', 'Australian', 'Brazilian', 'British', 'Canadian', 'Chinese',
  'Dutch', 'Emirati', 'French', 'German', 'Indian', 'Indonesian', 'Italian', 'Japanese',
  'Korean', 'Malaysian', 'Nigerian', 'Pakistani', 'Saudi Arabian', 'Singaporean',
  'Spanish', 'Taiwanese', 'Thai', 'Vietnamese', 'Other',
];

// Official 24 barangays of Santa Maria, Bulacan — used for location filters.
export const SANTA_MARIA_BARANGAYS = [
  'Bagbaguin',
  'Balasing',
  'Buenavista',
  'Bulac',
  'Camangyanan',
  'Catmon',
  'Cay Pombo',
  'Caysio',
  'Guyong',
  'Lalakhan',
  'Mag-asawang Sapa',
  'Mahabang Parang',
  'Manggahan',
  'Parada',
  'Poblacion',
  'Pulong Buhangin',
  'San Gabriel',
  'San Jose Patag',
  'San Vicente',
  'Santa Clara',
  'Santa Cruz',
  'Silangan',
  'Tabing Bakod',
  'Tumana',
];

// All 24 Bulacan LGUs — options for the City / Municipality dropdown.
export const BULACAN_MUNICIPALITIES = [
  'Angat',
  'Balagtas',
  'Baliwag',
  'Bocaue',
  'Bulakan',
  'Bustos',
  'Calumpit',
  'Doña Remedios Trinidad',
  'Guiguinto',
  'Hagonoy',
  'Malolos',
  'Marilao',
  'Meycauayan',
  'Norzagaray',
  'Obando',
  'Pandi',
  'Paombong',
  'Plaridel',
  'Pulilan',
  'San Ildefonso',
  'San Jose del Monte',
  'San Miguel',
  'San Rafael',
  'Santa Maria',
];

// PESO service scope: this portal only serves Bulacan.
export const BULACAN_PROVINCES = ['Bulacan'];

// Fixed service scope: the portal serves Santa Maria, Bulacan only (ADR-062).
export const FIXED_PROVINCE = 'Bulacan';
export const FIXED_MUNICIPALITY = 'Santa Maria';
export const FIXED_POSTAL_CODE = '3022';

export const INDUSTRIES = [
  'Agriculture',
  'Banking & Finance',
  'Construction',
  'Education',
  'Food & Beverage',
  'Healthcare',
  'Hospitality / Tourism',
  'Information Technology',
  'IT',
  'Logistics / Transport',
  'Manufacturing',
  'Retail',
  'Security Services',
  'Utilities',
  'Other',
];

export const JOB_TAGS = [
  'Urgent Hiring',
  'Fresh Grad Friendly',
  'No Experience Needed',
  'Training Provided',
  'Career Growth',
  'Flexible Schedule',
  'Day Shift',
];

// Education requirement options for job postings; stored as a line in job_vacancies.requirements (no column).
export const JOB_EDUCATION_LEVELS = [
  'No Formal Education Required',
  'Elementary Graduate',
  'High School Graduate',
  'Senior High School Graduate',
  'Vocational / TESDA Graduate',
  'College Level',
  'College Graduate',
  'Post-Graduate',
];

// Work-experience presets for job postings; 0 = no experience required.
// Employers can pick "Custom…" to type any number of years.
export const JOB_EXPERIENCE_PRESETS = [0, 1, 2, 3, 5];

// Common PH statutory/in-house benefits; employers toggle the applicable ones.
export const JOB_BENEFITS = [
  'SSS',
  'PhilHealth',
  'Pag-IBIG',
  '13th Month Pay',
  'Overtime Pay',
  'Holiday Pay',
  'Service Incentive Leave',
  'Meal Allowance',
  'Transportation Allowance',
  'HMO / Health Insurance',
  'Bonuses',
  'Free Uniform',
  'Retirement Plan',
  'Training & Development',
];

export const DOC_TYPES = [
  'Letter of Intent',
  'Company Profile',
  'Business Permit',
  'DOLE Certificate',
  'Job Orders',
  'PhilJobNet Accreditation',
  'Pag-IBIG Registration',
  'PhilHealth Registration',
  'Fire Safety Inspection Certificate',
];

// Single sign-in entry for every role: the portal is resolved from the account,
// so there is no portal chooser and no per-portal login page.
export const PORTALS = [
  { key: ROLES.SUPER_ADMIN, name: 'PESO Super Admin', homePath: '/super-admin' },
  { key: ROLES.EMPLOYER, name: 'Employer Portal', homePath: '/employer' },
  { key: ROLES.JOB_SEEKER, name: 'Job Seeker Portal', homePath: '/job-seeker' },
];



export const FAQS = [
  {
    question: "Who can use JobLinked?",
    answer:
      "JobLinked is designed for job seekers in Santa Maria, Bulacan’s 24 barangays, local employers, and PESO personnel. All accounts and listings in this environment are fictional samples.",
  },
  {
    question: "Is there a fee to find or apply for a job?",
    answer:
      "There is no payment feature on JobLinked. You can explore sample vacancies, save jobs, and test the application journey without a fee. Never send money to a recruiter claiming to represent JobLinked.",
  },
  {
    question: "How are employers verified?",
    answer:
      "Employers submit accreditation requirements for PESO review. A PESO administrator can approve, reject with feedback, or request resubmission. Accreditation takes about 3 business days. A verified badge represents a sample approval, not actual municipal accreditation.",
  },
  {
    question: "What documents do I need for employer accreditation?",
    answer:
      "Upload one file for each of the nine requirements in the Employer portal: Letter of Intent, Company Profile, Business Permit, DOLE Certificate, Job Orders, PhilJobNet Accreditation, Pag-IBIG Registration, PhilHealth Registration, and Fire Safety Inspection Certificate. Accepted files are PDF up to 2 MB, or DOC, DOCX, PNG, or JPG up to 5 MB. In this sample environment, the uploads are fictional.",
  },
  {
    question: "How long does employer accreditation take?",
    answer:
      "PESO aims to review a complete accreditation application within about 3 business days. The count starts after all required documents are submitted and the company email is verified. Review times can vary; the current status is always shown on the Employer portal’s Accreditation page.",
  },
  {
    question: "Can I post jobs before my accreditation is approved?",
    answer:
      "You can create and save job drafts at any time, but publishing is blocked until PESO approves your accreditation. Once approved, publish directly from Job Management. Posts that mention fees or payments may be held for PESO clearance before they appear publicly.",
  },
  {
    question: "What happens if my accreditation is rejected?",
    answer:
      "The reviewer’s remarks appear on your Accreditation page and in the review history. Update or replace the flagged documents there, then wait for PESO to review again. Drafts stay available, but publishing remains blocked until the accreditation is approved.",
  },
  {
    question: "How can I track my application?",
    answer:
      "Open My Applications in the Job Seeker portal to see your application’s timeline, from submission through review, shortlisting, interviews, and the employer’s final decision. Rejection is shown as an outcome, not a required step.",
  },
  {
    question: "Can I apply without a resume?",
    answer:
      "You can apply without attaching a resume — your application sends your JobLinked profile. If you attach one, upload a PDF up to 2 MB or a DOC or DOCX up to 5 MB, then choose it before submitting.",
  },
  {
    question: "How is my data used on JobLinked?",
    answer:
      "Profile and application details are used to create and manage your account, match you with vacancies, process applications, send service notifications, and prepare authorized PESO employment reports. Employers receive only the information for applications submitted to their own vacancies, and only for recruitment. Your profile is not sold or published as a public applicant directory. See the Privacy notice for retention rules and your rights.",
  },
  {
    question: "Are PESO programs processed online?",
    answer:
      "Job matching and applications run on JobLinked. The other PESO services listed — community job fairs, career guidance, and skills and livelihood training — are informational here: confirm schedules, eligibility, and requirements with the PESO office. JobLinked does not process SPES, GIP, or other government transactions.",
  },
];

export const PESO_SERVICES = [
  {
    title: 'Job matching & placement',
    description: 'Connect with opportunities that fit.',
    what:
      'PESO matches registered job seekers with vacancies from accredited local employers and refers suitable applicants for interview.',
    who:
      'Job seekers looking for local employment, including fresh graduates, first-time applicants, and workers returning to the workforce.',
    how:
      'Create a JobLinked account, complete your profile, and apply to posted vacancies. You can also visit the PESO office for referral assistance.',
  },
  {
    title: 'Community job fairs',
    description: 'Meet employers. Open new doors.',
    what:
      'PESO brings accredited employers together in one venue so applicants can learn about openings, submit resumes, and interview without travelling to each company.',
    who:
      'Job seekers who want to meet employers in person, and employers with current hiring needs.',
    how:
      'Watch for job-fair announcements on JobLinked and official PESO channels, prepare copies of your resume, and attend on the scheduled date.',
  },
  {
    title: 'Career guidance',
    description: 'Navigate your future with support.',
    what:
      'PESO provides career planning advice, resume and interview coaching, and guidance on training or employment paths suited to your goals.',
    who:
      'Students, fresh graduates, job seekers considering a change, and workers planning their next career step.',
    how:
      'Ask for a career guidance session at the PESO office, or call or email to arrange an appointment. Bring a draft resume and your questions.',
  },
  {
    title: 'Skills & livelihood training',
    description: 'Learn more. Grow your possibilities.',
    what:
      'PESO shares announcements and referrals for skills training and livelihood programs run with TESDA and other partner agencies.',
    who:
      'Unemployed and underemployed residents, displaced workers, youth, and anyone who wants to learn a trade or start a small livelihood.',
    how:
      'Check the training schedules announced by PESO, then register at the office with a valid ID. Slots, requirements, and schedules depend on the partner provider.',
  },
];
