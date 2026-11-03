export type Role = "jobseeker" | "employer" | "admin";
export type AccreditationStatus =
  "Pending Review" | "Approved" | "Rejected" | "Resubmission Requested";
export type ApplicationStatus =
  | "Submitted"
  | "Under Review"
  | "Shortlisted"
  | "Interview Scheduled"
  | "Hired"
  | "Rejected";
export type JobStatus =
  "Draft" | "Published" | "Closed" | "Flagged" | "Removed";
export type UserRole = Role | "staff";
export type Permission =
  | "browse"
  | "apply"
  | "jobs"
  | "employees"
  | "accreditation"
  | "reports"
  | "roles";
export type PermissionScope = "none" | "own" | "company" | "all" | "assigned";
export type PermissionMatrix = Record<
  UserRole,
  Record<Permission, PermissionScope>
>;
export type EmploymentStatus =
  | "Hired — Pending Start"
  | "Active"
  | "Probationary"
  | "Regular"
  | "Contractual"
  | "Resigned"
  | "Terminated"
  | "Contract Completed";
export interface EmploymentStatusHistory {
  id: string;
  status: EmploymentStatus;
  effectiveDate: string;
  recordedAt: string;
  actorId: string;
  remarks: string;
}
export interface EmployeeTrackingRecord {
  id: string;
  applicationId: string;
  seekerId: string;
  employerId: string;
  position: string;
  department: string;
  hiredAt: string;
  startDate: string | null;
  endDate: string | null;
  classification: string;
  status: EmploymentStatus;
  updatedAt: string;
  history: EmploymentStatusHistory[];
  assignedStaffIds: string[];
}
export interface EmploymentCorrectionRequest {
  id: string;
  employmentId: string;
  seekerId: string;
  message: string;
  createdAt: string;
  status: "Pending" | "Reviewed";
  resolution?: string;
  reviewedBy?: string;
}
export interface RoleChangeAuditLog {
  id: string;
  userId: string;
  previousRole: UserRole;
  newRole: UserRole;
  administratorId: string;
  timestamp: string;
  reason: string;
  previousActive: boolean;
  newActive: boolean;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  updatedAt?: string;
  active: boolean;
  createdAt: string;
}
export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: string;
  category?: string;
}
export interface JobSeeker extends User {
  role: "jobseeker";
  profilePicture?: string;
  phone: string;
  barangay: string;
  address: string;
  headline: string;
  education: string;
  experience: string;
  skills: string[];
  resumes: FileMetadata[];
  savedJobIds: string[];
}
export interface Employer {
  id: string;
  userId: string;
  name: string;
  initials: string;
  color: "blue" | "teal" | "navy" | "amber";
  industry: string;
  barangay: string;
  address: string;
  description: string;
  email: string;
  phone: string;
  representative: string;
  website: string;
  accreditationStatus: AccreditationStatus;
}
export interface PESOAdmin extends User {
  role: "admin";
  position: string;
}
export interface ReviewHistory {
  status: AccreditationStatus;
  date: string;
  reviewer: string;
  reason: string;
}
export interface Accreditation {
  id: string;
  employerId: string;
  status: AccreditationStatus;
  submittedAt: string;
  documents: FileMetadata[];
  feedback: string;
  history: ReviewHistory[];
}
export interface JobPosting {
  id: string;
  employerId: string;
  title: string;
  category: string;
  type: string;
  arrangement: string;
  barangay: string;
  salaryMin: number | null;
  salaryMax: number | null;
  experience: string;
  description: string;
  qualifications: string[];
  responsibilities: string[];
  skills: string[];
  benefits: string[];
  openings: number;
  deadline: string;
  postedAt: string;
  status: JobStatus;
  moderationNote?: string;
}
export interface TimelineEvent {
  status: ApplicationStatus;
  date: string;
  description: string;
}
export interface InternalNote {
  id: string;
  text: string;
  date: string;
  authorId: string;
}
export interface JobApplication {
  id: string;
  jobId: string;
  seekerId: string;
  status: ApplicationStatus;
  submittedAt: string;
  resumeName: string;
  coverLetter: string;
  timeline: TimelineEvent[];
  notes: InternalNote[];
  interview?: { date: string; location: string };
  referred: boolean;
}
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  href: string;
  type: "application" | "interview" | "announcement" | "accreditation";
}
export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  date: string;
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  date: string;
  published: boolean;
  distributionDate: string;
}
export interface SystemPreferences {
  applicationUpdates: boolean;
  announcements: boolean;
  requirements: string[];
  privacyText: string;
  termsText: string;
}
export interface DemoState {
  employmentRecords: EmployeeTrackingRecord[];
  correctionRequests: EmploymentCorrectionRequest[];
  roleChangeLogs: RoleChangeAuditLog[];
  permissionMatrix: PermissionMatrix;
  users: User[];
  seekers: JobSeeker[];
  employers: Employer[];
  accreditations: Accreditation[];
  jobs: JobPosting[];
  applications: JobApplication[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  announcements: Announcement[];
  sessionUserId: string | null;
  preferences: SystemPreferences;
  userPreferences?: Record<
    string,
    { applicationUpdates: boolean; announcements: boolean }
  >;
  revision: number;
}
export interface Report {
  generatedAt: string;
  from: string;
  to: string;
  vacancies: number;
  openings: number;
  applications: number;
  referrals: number;
  placements: number;
  barangays: {
    name: string;
    seekers: number;
    vacancies: number;
    applications: number;
    placements: number;
  }[];
  months: { month: string; applications: number; placements: number }[];
}
export interface RegistrationInput {
  role: "jobseeker" | "employer";
  name: string;
  email: string;
  phone: string;
  barangay: string;
  address: string;
  education?: string;
  experience?: string;
  skills?: string[];
  companyName?: string;
  industry?: string;
  description?: string;
  documents: FileMetadata[];
  resume?: FileMetadata;
  privacyAcknowledged: boolean;
  termsAccepted: boolean;
  representativeDeclared?: boolean;
  processingConsent?: boolean;
}
export interface JobFilters {
  keyword: string;
  barangay: string;
  category: string;
  type: string;
  salary: string;
  experience: string;
  sort: string;
}
