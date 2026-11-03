import {
  BARANGAYS,
  DEFAULT_PRIVACY,
  DEFAULT_REQUIREMENTS,
  DEFAULT_TERMS,
} from "@/constants";
import type {
  DemoState,
  Employer,
  JobApplication,
  JobPosting,
  JobSeeker,
} from "@/types";

const anchor = new Date("2026-10-18T04:00:00Z");
const day = (offset: number) =>
  new Date(anchor.getTime() + offset * 86400000).toISOString();
const companies: Employer[] = [
  {
    id: "company-1",
    userId: "employer-user-1",
    name: "Northfield Business Solutions",
    initials: "N",
    color: "blue",
    industry: "Business Services",
    barangay: "Poblacion",
    address: "28 F. Santiago Street, Poblacion",
    description:
      "A fictional, people-first business services company supporting growing enterprises across Bulacan. We value collaboration, curiosity, and opportunities close to home.",
    email: "careers@northfield.example",
    phone: "0917 000 0101",
    representative: "Andrea Reyes",
    website: "northfield.example",
    accreditationStatus: "Approved",
  },
  {
    id: "company-2",
    userId: "employer-user-2",
    name: "Likha Food Manufacturing",
    initials: "L",
    color: "teal",
    industry: "Food & Manufacturing",
    barangay: "Pulong Buhangin",
    address: "16 Industrial Road, Pulong Buhangin",
    description:
      "A sample local food manufacturer making everyday Filipino favorites while investing in the skills of our community.",
    email: "hr@likha.example",
    phone: "0917 000 0102",
    representative: "Miguel Cruz",
    website: "likha.example",
    accreditationStatus: "Approved",
  },
  {
    id: "company-3",
    userId: "employer-user-3",
    name: "Bayanihan Retail Group",
    initials: "b.",
    color: "amber",
    industry: "Retail",
    barangay: "Santa Clara",
    address: "42 Community Avenue, Santa Clara",
    description:
      "A fictional neighborhood retail group built around friendly service, local products, and community connections.",
    email: "people@bayanihan.example",
    phone: "0917 000 0103",
    representative: "Patricia Ramos",
    website: "bayanihan.example",
    accreditationStatus: "Approved",
  },
  {
    id: "company-4",
    userId: "employer-user-4",
    name: "Hiraya Digital Studio",
    initials: "h",
    color: "navy",
    industry: "Technology",
    barangay: "Guyong",
    address: "7 Creative Lane, Guyong",
    description:
      "A sample independent creative and technology studio designing thoughtful digital experiences for local businesses.",
    email: "team@hiraya.example",
    phone: "0917 000 0104",
    representative: "Paolo Garcia",
    website: "hiraya.example",
    accreditationStatus: "Approved",
  },
  {
    id: "company-5",
    userId: "employer-user-5",
    name: "Alaga Community Pharmacy",
    initials: "a+",
    color: "teal",
    industry: "Healthcare",
    barangay: "Bagbaguin",
    address: "12 Health Street, Bagbaguin",
    description:
      "A fictional community pharmacy supporting accessible, caring service in Santa Maria.",
    email: "careers@alaga.example",
    phone: "0917 000 0105",
    representative: "Isabel Flores",
    website: "alaga.example",
    accreditationStatus: "Pending Review",
  },
  {
    id: "company-6",
    userId: "employer-user-6",
    name: "Lakbay Logistics",
    initials: "LK",
    color: "blue",
    industry: "Logistics",
    barangay: "Cay Pombo",
    address: "31 Warehouse Road, Cay Pombo",
    description:
      "A sample logistics team connecting Bulacan businesses with reliable local distribution.",
    email: "hr@lakbay.example",
    phone: "0917 000 0106",
    representative: "Rafael Dizon",
    website: "lakbay.example",
    accreditationStatus: "Pending Review",
  },
];
const jobSeeds = [
  [
    "Administrative Assistant",
    "company-1",
    "Administration",
    "Full-time",
    "Poblacion",
    18000,
    22000,
    "Entry level",
    ["Microsoft Office", "Communication", "Organization"],
  ],
  [
    "Production Staff",
    "company-2",
    "Manufacturing",
    "Full-time",
    "Pulong Buhangin",
    16000,
    19000,
    "No experience",
    ["Teamwork", "Attention to detail", "Food safety"],
  ],
  [
    "Sales Associate",
    "company-3",
    "Retail & Sales",
    "Full-time",
    "Santa Clara",
    16000,
    20000,
    "Entry level",
    ["Customer service", "Communication", "Sales"],
  ],
  [
    "Junior Web Developer",
    "company-4",
    "Information Technology",
    "Full-time",
    "Guyong",
    25000,
    35000,
    "Entry level",
    ["React", "TypeScript", "Communication"],
  ],
  [
    "Accounting Assistant",
    "company-1",
    "Finance & Accounting",
    "Full-time",
    "Poblacion",
    20000,
    26000,
    "1–3 years",
    ["Bookkeeping", "Microsoft Office", "Attention to detail"],
  ],
  [
    "Quality Assurance Inspector",
    "company-2",
    "Manufacturing",
    "Contract",
    "Pulong Buhangin",
    21000,
    27000,
    "1–3 years",
    ["Quality control", "Attention to detail", "Food safety"],
  ],
  [
    "Customer Service Representative",
    "company-1",
    "Administration",
    "Full-time",
    "San Vicente",
    19000,
    24000,
    "No experience",
    ["Customer service", "Communication", "Microsoft Office"],
  ],
  [
    "Store Crew",
    "company-3",
    "Retail & Sales",
    "Part-time",
    "Parada",
    10000,
    14000,
    "No experience",
    ["Teamwork", "Customer service", "Organization"],
  ],
  [
    "Graphic Design Intern",
    "company-4",
    "Information Technology",
    "Internship",
    "Guyong",
    8000,
    10000,
    "No experience",
    ["Figma", "Communication", "Creativity"],
  ],
  [
    "Warehouse Coordinator",
    "company-2",
    "Logistics",
    "Full-time",
    "Balasing",
    18000,
    23000,
    "1–3 years",
    ["Inventory", "Organization", "Microsoft Office"],
  ],
  [
    "Retail Supervisor",
    "company-3",
    "Retail & Sales",
    "Full-time",
    "Santa Clara",
    24000,
    30000,
    "3+ years",
    ["Leadership", "Sales", "Customer service"],
  ],
  [
    "UI / UX Designer",
    "company-4",
    "Information Technology",
    "Contract",
    "Guyong",
    30000,
    45000,
    "1–3 years",
    ["Figma", "Research", "Communication"],
  ],
  ["Human Resources Assistant", "company-1", "Administration", "Full-time", "Poblacion", 19000, 24000, "Entry level", ["Communication", "Organization", "Microsoft Office"]],
  ["Machine Operator", "company-2", "Manufacturing", "Full-time", "Pulong Buhangin", 18000, 23000, "1–3 years", ["Machine operation", "Safety", "Attention to detail"]],
  ["Cashier", "company-3", "Retail & Sales", "Full-time", "Santa Clara", 15000, 18000, "No experience", ["Customer service", "Numeracy", "Communication"]],
  ["IT Support Technician", "company-4", "Information Technology", "Full-time", "Guyong", 22000, 30000, "Entry level", ["Troubleshooting", "Networking", "Communication"]],
  ["Office Clerk", "company-1", "Administration", "Contract", "San Vicente", 16000, 20000, "No experience", ["Data entry", "Organization", "Microsoft Office"]],
  ["Packaging Staff", "company-2", "Manufacturing", "Full-time", "Balasing", 15500, 18500, "No experience", ["Teamwork", "Safety", "Attention to detail"]],
  ["Merchandiser", "company-3", "Retail & Sales", "Full-time", "Parada", 17000, 21000, "Entry level", ["Inventory", "Sales", "Organization"]],
  ["Software QA Tester", "company-4", "Information Technology", "Contract", "Guyong", 26000, 36000, "1–3 years", ["Software testing", "Attention to detail", "Communication"]],
  ["Payroll Assistant", "company-1", "Finance & Accounting", "Full-time", "Poblacion", 21000, 27000, "1–3 years", ["Payroll", "Microsoft Office", "Attention to detail"]],
  ["Maintenance Technician", "company-2", "Manufacturing", "Full-time", "Pulong Buhangin", 22000, 29000, "1–3 years", ["Maintenance", "Troubleshooting", "Safety"]],
  ["Sales Representative", "company-3", "Retail & Sales", "Full-time", "Santa Clara", 20000, 28000, "1–3 years", ["Sales", "Communication", "Customer service"]],
  ["Frontend Developer", "company-4", "Information Technology", "Full-time", "Guyong", 30000, 42000, "1–3 years", ["React", "TypeScript", "CSS"]],
  ["Receptionist", "company-1", "Administration", "Full-time", "Poblacion", 17000, 22000, "Entry level", ["Customer service", "Communication", "Organization"]],
  ["Inventory Controller", "company-2", "Logistics", "Full-time", "Balasing", 21000, 27000, "1–3 years", ["Inventory", "Microsoft Office", "Attention to detail"]],
  ["Store Manager", "company-3", "Retail & Sales", "Full-time", "Parada", 28000, 36000, "3+ years", ["Leadership", "Sales", "Inventory"]],
  ["Data Entry Specialist", "company-4", "Information Technology", "Part-time", "Guyong", 14000, 18000, "No experience", ["Data entry", "Microsoft Office", "Attention to detail"]],
  ["Procurement Assistant", "company-1", "Administration", "Full-time", "San Vicente", 20000, 26000, "1–3 years", ["Procurement", "Organization", "Communication"]],
  ["Delivery Coordinator", "company-2", "Logistics", "Full-time", "Balasing", 19000, 25000, "Entry level", ["Logistics", "Organization", "Communication"]],
  ["Brand Promoter", "company-3", "Retail & Sales", "Contract", "Santa Clara", 16000, 22000, "No experience", ["Communication", "Sales", "Customer service"]],
  ["Backend Developer", "company-4", "Information Technology", "Full-time", "Guyong", 32000, 46000, "1–3 years", ["Node.js", "Databases", "TypeScript"]],
  ["Executive Assistant", "company-1", "Administration", "Full-time", "Poblacion", 25000, 33000, "3+ years", ["Organization", "Communication", "Microsoft Office"]],
  ["Forklift Operator", "company-2", "Logistics", "Full-time", "Pulong Buhangin", 18000, 23000, "1–3 years", ["Forklift operation", "Safety", "Inventory"]],
  ["Visual Merchandiser", "company-3", "Retail & Sales", "Full-time", "Parada", 19000, 25000, "Entry level", ["Creativity", "Inventory", "Sales"]],
  ["Digital Marketing Specialist", "company-4", "Information Technology", "Full-time", "Guyong", 25000, 35000, "1–3 years", ["Digital marketing", "Communication", "Analytics"]],
  ["Billing Assistant", "company-1", "Finance & Accounting", "Full-time", "San Vicente", 19000, 24000, "Entry level", ["Bookkeeping", "Numeracy", "Microsoft Office"]],
  ["Production Supervisor", "company-2", "Manufacturing", "Full-time", "Pulong Buhangin", 28000, 36000, "3+ years", ["Leadership", "Quality control", "Safety"]],
  ["Customer Relations Officer", "company-3", "Retail & Sales", "Full-time", "Santa Clara", 21000, 27000, "1–3 years", ["Customer service", "Communication", "Problem solving"]],
  ["Mobile App Developer", "company-4", "Information Technology", "Contract", "Guyong", 32000, 48000, "1–3 years", ["React Native", "TypeScript", "Communication"]],
  ["Records Assistant", "company-1", "Administration", "Contract", "Poblacion", 17000, 21000, "Entry level", ["Records management", "Organization", "Data entry"]],
  ["Logistics Dispatcher", "company-2", "Logistics", "Full-time", "Balasing", 20000, 26000, "1–3 years", ["Logistics", "Communication", "Organization"]],
] as const;
const jobs: JobPosting[] = jobSeeds.map((j, index) => ({
  id: `job-${index + 1}`,
  title: j[0],
  employerId: j[1],
  category: j[2],
  type: j[3],
  barangay: j[4],
  salaryMin: j[5],
  salaryMax: j[6],
  experience: j[7],
  skills: [...j[8]],
  arrangement: index === 3 || index === 11 ? "Hybrid" : "On-site",
  description: `Build a meaningful career close to home as our ${j[0].toLowerCase()}. We are looking for a motivated, dependable teammate who enjoys learning and making a positive contribution. This is a fictional vacancy created to demonstrate the JobLinked application journey.`,
  qualifications: [
    "Relevant education or equivalent practical experience",
    `${j[7]} applicants are welcome`,
    "Strong interpersonal skills and a willingness to learn",
    "Able to work in Santa Maria, Bulacan",
  ],
  responsibilities: [
    "Support day-to-day operations and meet agreed team goals",
    "Collaborate with colleagues and communicate updates clearly",
    "Maintain accurate records and follow workplace procedures",
    "Contribute ideas that improve service and team efficiency",
  ],
  benefits: [
    "Statutory government benefits",
    "Skills development",
    "Supportive team environment",
    "Local work opportunities",
  ],
  openings: (index % 3) + 1,
  deadline: day(index === 10 ? -2 : 22 + index),
  postedAt: day(-1 - index),
  status: "Published",
}));
const seekerNames = [
  "Maria Santos",
  "Juan Dela Cruz",
  "Camille Rivera",
  "Joshua Villanueva",
  "Bea Castillo",
  "Mark Bautista",
  "Angela Lopez",
  "Carlo Mercado",
];
const seekers: JobSeeker[] = seekerNames.map((name, i) => ({
  id: `seeker-${i + 1}`,
  name,
  profilePicture:
    i === 0
      ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/402fe4473f1b29109259566ee004bf96-774447062-pEYH9kqDabuKqTKjgoXLd2RT4sQqWm.jpg"
      : undefined,
  email:
    i === 0 ? "maria@demo.joblinked.ph" : `sample${i + 1}@demo.joblinked.ph`,
  role: "jobseeker",
  active: true,
  createdAt: day(-30 - i * 12),
  phone: `0917 000 020${i}`,
  barangay: i === 0 ? "Poblacion" : BARANGAYS[(i * 3) % 24],
  address: "Sample address · Santa Maria, Bulacan",
  headline:
    i === 0
      ? "Administrative professional · Ready for my next opportunity"
      : "Exploring opportunities close to home",
  education:
    "Bachelor of Science in Business Administration · Sample College, 2025",
  experience: "Administrative intern · Sample Community Enterprise, 2025–2026",
  skills:
    i === 0
      ? [
          "Microsoft Office",
          "Communication",
          "Organization",
          "Customer service",
        ]
      : [
          "Teamwork",
          "Communication",
          "Attention to detail",
          ...(i % 2 === 0 ? ["React", "TypeScript"] : ["Customer service"]),
        ],
  resumes: [
    {
      id: `resume-${i}`,
      name:
        i === 0
          ? "Maria_Santos_Resume.pdf"
          : `${name.replaceAll(" ", "_")}_Sample.pdf`,
      size: 248000,
      type: "application/pdf",
      addedAt: day(-5),
    },
  ],
  savedJobIds: i === 0 ? ["job-1", "job-4"] : [],
}));
const applicationSeeds = [
  ["seeker-1", "job-7", "Interview Scheduled"],
  ["seeker-1", "job-5", "Under Review"],
  ["seeker-1", "job-3", "Submitted"],
  ["seeker-2", "job-1", "Shortlisted"],
  ["seeker-3", "job-1", "Under Review"],
  ["seeker-4", "job-4", "Hired"],
  ["seeker-5", "job-2", "Submitted"],
  ["seeker-6", "job-3", "Rejected"],
  ["seeker-7", "job-8", "Submitted"],
  ["seeker-8", "job-7", "Under Review"],
] as const;
const applications: JobApplication[] = applicationSeeds.map((a, i) => {
  const stages = [
    "Submitted",
    "Under Review",
    "Shortlisted",
    "Interview Scheduled",
    "Hired",
  ] as const;
  const finalIndex = a[2] === "Rejected" ? 1 : stages.indexOf(a[2]);
  const submittedTime =
    new Date(jobs.find((job) => job.id === a[1])!.postedAt).getTime() +
    (2 + (i % 3)) * 3600000;
  const submittedAt = new Date(submittedTime).toISOString();
  const timeline = stages.slice(0, finalIndex + 1).map((status, si) => ({
    status,
    date: new Date(submittedTime + si * 3600000).toISOString(),
    description:
      status === "Submitted"
        ? "Your sample application was received."
        : `The employer updated this application to ${status.toLowerCase()}.`,
  }));
  if (a[2] === "Rejected")
    timeline.push({
      status: "Rejected" as (typeof timeline)[number]["status"],
      date: new Date(submittedTime + 3 * 3600000).toISOString(),
      description: "The employer has chosen to proceed with another candidate.",
    });
  return {
    id: `application-${i + 1}`,
    seekerId: a[0],
    jobId: a[1],
    status: a[2],
    submittedAt,
    resumeName: seekers.find((s) => s.id === a[0])!.resumes[0].name,
    coverLetter:
      "Sample cover letter: I would welcome the opportunity to contribute my skills to your team.",
    notes: [],
    timeline,
    referred: i % 3 === 0,
    ...(a[2] === "Interview Scheduled"
      ? {
          interview: {
            date: day(3),
            location: "Sample Northfield office, Poblacion",
          },
        }
      : {}),
  };
});

import { DEFAULT_PERMISSIONS } from "@/lib/permissions";

export function createInitialState(): DemoState {
  return structuredClone({
    employmentRecords: applications
      .filter((a) => a.status === "Hired")
      .map((a) => {
        const job = jobs.find((j) => j.id === a.jobId)!;
        const date =
          a.timeline.find((e) => e.status === "Hired")?.date ?? a.submittedAt;
        return {
          id: `employee-${a.id}`,
          applicationId: a.id,
          seekerId: a.seekerId,
          employerId: job.employerId,
          position: job.title,
          department: "Not yet specified",
          hiredAt: date,
          startDate: null,
          endDate: null,
          classification: job.type,
          status: "Hired — Pending Start" as const,
          updatedAt: date,
          assignedStaffIds: [],
          history: [
            {
              id: `hire-${a.id}`,
              status: "Hired — Pending Start" as const,
              effectiveDate: date.slice(0, 10),
              recordedAt: date,
              actorId: companies.find((c) => c.id === job.employerId)!.userId,
              remarks:
                "Hiring confirmed through the recorded application event.",
            },
          ],
        };
      }),
    correctionRequests: [],
    roleChangeLogs: [],
    permissionMatrix: DEFAULT_PERMISSIONS,
    users: [
      ...seekers.map(({ id, name, email, role, active, createdAt }) => ({
        id,
        name,
        email,
        role,
        active,
        createdAt,
      })),
      ...companies.map((c) => ({
        id: c.userId,
        name: c.representative,
        email: c.id === "company-1" ? "employer@demo.joblinked.ph" : c.email,
        role: "employer" as const,
        active: true,
        createdAt: day(-35),
      })),
      {
        id: "staff-1",
        name: "Elena Santos",
        email: "staff@demo.joblinked.ph",
        role: "staff" as const,
        active: true,
        createdAt: day(-30),
      },
      {
        id: "admin-1",
        name: "Gabriel Mendoza",
        email: "admin@demo.joblinked.ph",
        role: "admin" as const,
        active: true,
        createdAt: day(-60),
      },
    ],
    seekers,
    employers: companies,
    jobs,
    applications,
    accreditations: companies.map((c) => ({
      id: `accreditation-${c.id}`,
      employerId: c.id,
      status: c.accreditationStatus,
      submittedAt: day(c.accreditationStatus === "Approved" ? -25 : -2),
      documents: DEFAULT_REQUIREMENTS.map((category, i) => ({
        id: `${c.id}-doc-${i}`,
        name: `${category.replaceAll(" ", "_")}_SAMPLE.pdf`,
        size: 320000 + i * 40000,
        type: "application/pdf",
        category,
        addedAt: day(-3),
      })),
      feedback:
        c.accreditationStatus === "Approved"
          ? "Sample requirements reviewed and accepted."
          : "",
      history: [
        {
          status: "Pending Review" as const,
          date: day(-25),
          reviewer: "System demo",
          reason: "Initial sample submission",
        },
        ...(c.accreditationStatus === "Approved"
          ? [
              {
                status: "Approved" as const,
                date: day(-24),
                reviewer: "Gabriel Mendoza",
                reason: "Example documents accepted in demo.",
              },
            ]
          : []),
      ],
    })),
    notifications: [
      {
        id: "notification-1",
        userId: "seeker-1",
        title: "You have an interview coming up",
        message:
          "Northfield Business Solutions has scheduled your sample interview. View your application for details.",
        date: day(-1),
        read: false,
        href: "/jobseeker/applications/application-1",
        type: "interview" as const,
      },
      {
        id: "notification-2",
        userId: "seeker-1",
        title: "Your application is under review",
        message:
          "Your Accounting Assistant application has moved to Under Review.",
        date: day(-2),
        read: false,
        href: "/jobseeker/applications/application-2",
        type: "application" as const,
      },
      {
        id: "notification-3",
        userId: "employer-user-1",
        title: "New applicants are ready to review",
        message: "Explore sample applications for your active vacancies.",
        date: day(-1),
        read: false,
        href: "/employer/applicants",
        type: "application" as const,
      },
      {
        id: "notification-4",
        userId: "admin-1",
        title: "Two accreditations need your review",
        message:
          "Alaga Community Pharmacy and Lakbay Logistics have sample submissions.",
        date: day(-1),
        read: false,
        href: "/admin/accreditation",
        type: "accreditation" as const,
      },
    ],
    auditLogs: [
      {
        id: "audit-1",
        actor: "Gabriel Mendoza",
        action: "Approved accreditation",
        target: "Northfield Business Solutions",
        date: day(-24),
      },
      {
        id: "audit-2",
        actor: "Andrea Reyes",
        action: "Published vacancy",
        target: "Administrative Assistant",
        date: day(-1),
      },
      {
        id: "audit-3",
        actor: "Paolo Garcia",
        action: "Updated application to Hired",
        target: "Junior Web Developer",
        date: day(-2),
      },
    ],
    announcements: [
      {
        id: "announcement-1",
        title: "Your next opportunity could be closer than you think.",
        body: "Explore our sample community job fair and meet fictional local employers. This is a demo notice, not an actual scheduled municipal event.",
        category: "Job fair",
        date: day(12),
        published: true,
        distributionDate: day(3).slice(0, 10),
      },
      {
        id: "announcement-2",
        title: "Make your first impression count",
        body: "Explore resume preparation and interview guidance through the PESO services information page. Actual schedules must be confirmed through official channels.",
        category: "Career guidance",
        date: day(6),
        published: true,
        distributionDate: day(2).slice(0, 10),
      },
    ],
    sessionUserId: null,
    preferences: {
      applicationUpdates: true,
      announcements: true,
      requirements: DEFAULT_REQUIREMENTS,
      privacyText: DEFAULT_PRIVACY,
      termsText: DEFAULT_TERMS,
    },
    revision: 0,
  });
}
