import type { ApplicationStatus, Role } from "@/types";

export const BARANGAYS = [
  "Bagbaguin",
  "Balasing",
  "Buenavista",
  "Bulac",
  "Camangyanan",
  "Catmon",
  "Cay Pombo",
  "Caysio",
  "Guyong",
  "Lalakhan",
  "Mag-asawang Sapa",
  "Mahabang Parang",
  "Manggahan",
  "Parada",
  "Poblacion",
  "Pulong Buhangin",
  "San Gabriel",
  "San Jose Patag",
  "San Vicente",
  "Santa Clara",
  "Santa Cruz",
  "Silangan",
  "Tabing Bakod",
  "Tumana",
];
export const CATEGORIES = [
  "Administration",
  "Retail & Sales",
  "Manufacturing",
  "Hospitality",
  "Information Technology",
  "Logistics",
  "Healthcare",
  "Finance & Accounting",
];
export const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "Submitted",
  "Under Review",
  "Shortlisted",
  "Interview Scheduled",
  "Hired",
  "Rejected",
];
export const ROLE_LABELS: Record<import("@/types").UserRole, string> = {
  jobseeker: "Job Seeker",
  employer: "Employer",
  admin: "PESO Admin",
  staff: "PESO Staff",
};
export const DEMO_ACCOUNTS = [
  {
    role: "jobseeker" as const,
    name: "Maria Santos",
    email: "maria@demo.joblinked.ph",
    id: "seeker-1",
  },
  {
    role: "employer" as const,
    name: "Andrea Reyes",
    email: "employer@demo.joblinked.ph",
    id: "employer-user-1",
  },
  {
    role: "admin" as const,
    name: "Gabriel Mendoza",
    email: "admin@demo.joblinked.ph",
    id: "admin-1",
  },
];
export const DEMO_PASSWORD = "Demo123!";
export const STORAGE_KEY = "joblinked-demo-workflows-v1";
export const DEMO_QUERY_KEY = "joblinked-demo-state";
export const DEFAULT_REQUIREMENTS = [
  "Business Permit",
  "DOLE Registration",
  "Fire Safety Certificate",
];
export const PROGRAMS = [
  {
    title: "Job Matching & Placement",
    description:
      "Connect your skills and career goals with opportunities from verified local employers.",
    icon: "matching",
    tag: "For job seekers",
  },
  {
    title: "Job Fairs",
    description:
      "Meet participating employers and discover opportunities at local recruitment events.",
    icon: "fair",
    tag: "Community events",
  },
  {
    title: "Career Guidance & Counseling",
    description:
      "Get support with career decisions, interview preparation, and your next professional step.",
    icon: "guidance",
    tag: "Career support",
  },
  {
    title: "Skills Training & Livelihood",
    description:
      "Explore skills development and livelihood assistance, subject to program eligibility.",
    icon: "training",
    tag: "Build your skills",
  },
  {
    title: "Labor Market Information",
    description:
      "Understand local hiring needs, in-demand skills, and employment trends.",
    icon: "information",
    tag: "Local insights",
  },
  {
    title: "Special Program for Employment of Students",
    description:
      "Learn about SPES, eligibility, application requirements, and available schedules.",
    icon: "spes",
    tag: "SPES",
  },
  {
    title: "Government Internship Program",
    description:
      "Explore GIP opportunities for eligible young people to gain public service experience.",
    icon: "gip",
    tag: "GIP",
  },
  {
    title: "Employment Referral Services",
    description:
      "Receive guidance and referrals to suitable vacancies and partner employment services.",
    icon: "referrals",
    tag: "Get connected",
  },
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
export const DEFAULT_PRIVACY = `DRAFT PRIVACY NOTICE — FOR REVIEW\n\n1. About this prototype\nJobLinked is a frontend demonstration of a municipal employment platform. It is not an official LGU or PESO service and is not endorsed by a government office. This notice is a configurable design draft, not a legal determination of compliance with Republic Act No. 10173 (Data Privacy Act of 2012). Use fictional information only.\n\n2. Information and purposes\nA production service would process only information necessary for profile creation, local job matching, applications, employer accreditation, recruitment coordination, support, and aggregate labor market reporting. Job seekers may provide contact details, barangay, education, experience, skills, and a resume. Employers may provide company details, an authorized representative, and required accreditation documents. Do not submit government identification numbers, health information, financial credentials, or unnecessary sensitive personal information.\n\n3. Visibility and access\nPublic visitors see published vacancy and employer information only. A job seeker’s application and resume must be available only to that applicant, the employer receiving the application, and authorized PESO personnel with a legitimate purpose. Compliance documents are intended for the submitting employer and authorized reviewers, never public visitors or unrelated employers. The production backend must enforce these rules; frontend role guards do not provide security.\n\n4. Demo storage\nNo file content is uploaded, transmitted, or stored. Selected files are represented by temporary metadata in memory. Password entries are discarded and no JWT or real credential is created. Newly entered registration profiles, cover letters, internal notes, and file metadata are kept only in memory and disappear on refresh. Non-sensitive fictional vacancy edits, saved fixture jobs, sample application statuses, and sample accreditation review states may persist in this browser. Reset Demo clears this stored workflow data. Do not enter real personal information.\n\n5. Retention and safeguards\nProduction retention periods, lawful bases, data controller identity, hosting arrangements, processor contracts, access controls, encryption, incident response, and deletion procedures must be defined and approved before launch. This demonstration cannot guarantee confidentiality or legal compliance.\n\n6. Your choices and rights\nA production service should provide a verified process to request access, correction, objection, erasure or blocking, and other rights available under applicable law, subject to lawful limitations. Required acknowledgment of this notice is separate from terms acceptance and from an employer’s role-specific declaration. There is no marketing opt-in in this demo. Where consent is relied on, production must support recording and withdrawal without confusing it with other lawful bases.\n\n7. Contact and review\nAn authorized data controller and Data Protection Officer contact must be designated before launch. No official DPO contact is represented here. Use the demo Contact page only to preview a support form; messages are not transmitted. This text must be reviewed by the responsible organization and qualified privacy counsel before production use.\n\nDraft version 1.0 · October 2026`;
export const DEFAULT_TERMS = `DRAFT DEMO TERMS — FOR REVIEW\n\nJobLinked is a fictional frontend prototype, not an official government service. These configurable draft terms do not create binding municipal terms and require organizational and legal review before use.\n\nUse fictional records only. Do not upload real resumes, confidential business records, credentials, or identification documents. Files remain metadata-only in memory. Demo role selection is not production authentication.\n\nListings, salaries, vacancies, employer approvals, recommendations, statistics, referrals, placements, and announcements are sample data. They are not offers, guarantees of employment, or actual government decisions. Skills matching is a simple transparent keyword comparison, not AI or a claim of predictive accuracy.\n\nUsers should represent themselves and companies accurately in a future production service, obtain authority before submitting company documents, and use the platform only for lawful recruitment. Production policies for fair employment, acceptable use, account suspension, complaints, accessibility, and dispute resolution must be reviewed and published by the responsible organization.\n\nNo Facebook, email, SMS, or government-system messages are sent. No password reset emails, real applications, or document submissions occur outside this local demo. Browser demo data can be cleared with Reset Demo.\n\nDraft version 1.0 · October 2026`;
