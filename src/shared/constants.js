export const ROLES = { SUPER_ADMIN: 'super-admin', EMPLOYER: 'employer', JOB_SEEKER: 'job-seeker' };

export const EMPLOYMENT_STATUSES = ['Employed', 'Unemployed', 'Underemployed', 'Fresh Graduate', 'Student'];

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

// Interview instruction presets (ADR-014) — composed into
// job_applications.interview_instructions at send time.
export const INTERVIEW_ATTIRE = ['Business Attire', 'Formal / Corporate', 'Office Attire', 'Casual'];
export const INTERVIEW_BRING = ['Updated Resume / CV', 'Valid Government ID', '2×2 ID Picture', 'NBI Clearance', 'Application Letter', 'Ballpen', 'Certificate of Employment', 'Transcript of Records'];

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



export const FAQS = [
  {
    question: "Who can use JobLinked?",
    answer:
      "This frontend demonstration is designed for job seekers in Santa Maria, Bulacan’s 24 barangays, local employers, and PESO personnel. All accounts and listings in this environment are fictional samples.",
  },
  {
    question: "Is there a fee to find or apply for a job?",
    answer:
      "There is no payment feature in this demo. You can explore sample vacancies, save jobs, and test the application journey without a fee. Never send money to a recruiter claiming to represent this prototype.",
  },
  {
    question: "How are employers verified?",
    answer:
      "Employers submit example accreditation requirements for PESO review. In this demo, a PESO administrator can approve, reject with feedback, or request resubmission. A verified badge represents a sample approval, not actual municipal accreditation.",
  },
  {
    question: "How can I track my application?",
    answer:
      "Open My Applications in the Job Seeker portal to see your application’s timeline, from submission through review, shortlisting, interviews, and the employer’s final decision. Rejection is shown as an outcome, not a required step.",
  },
  {
    question: "Can I apply without a resume?",
    answer:
      "The demo application flow requires a completed profile and a selected resume metadata record. Upload a sample PDF, DOC, or DOCX up to 5 MB. No file contents are uploaded or stored.",
  },
  {
    question: "Are PESO programs processed online?",
    answer:
      "Program pages are informational. Eligibility, schedules, and actual processing must be confirmed with the appropriate PESO office through verified official channels. This prototype does not process SPES, GIP, or government transactions.",
  },
];
