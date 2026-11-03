import type {
  AccreditationStatus,
  ApplicationStatus,
  DemoState,
  Employer,
  FileMetadata,
  JobPosting,
  JobSeeker,
  RegistrationInput,
  Report,
  Role,
  User,
} from "@/types";

export interface AuthResponse {
  user: User;
  accessToken?: string;
}
export interface JobLinkedApi {
  login(
    email: string,
    password: string,
    remember?: boolean,
  ): Promise<AuthResponse>;
  register(input: RegistrationInput): Promise<AuthResponse>;
  logout(): Promise<void>;
  listJobs(): Promise<JobPosting[]>;
  saveJob(jobId: string): Promise<void>;
  createJob(
    input: Omit<JobPosting, "id" | "employerId" | "postedAt">,
  ): Promise<JobPosting>;
  updateJob(id: string, input: Partial<JobPosting>): Promise<JobPosting>;
  apply(jobId: string, resumeId: string, coverLetter: string): Promise<string>;
  updateApplication(
    id: string,
    status: ApplicationStatus,
    interview?: { date: string; location: string },
  ): Promise<void>;
  reviewAccreditation(
    employerId: string,
    status: AccreditationStatus,
    reason: string,
  ): Promise<void>;
  submitAccreditation(documents: FileMetadata[]): Promise<void>;
  markNotification(id: string, read: boolean): Promise<void>;
  getReport(from: string, to: string): Promise<Report>;
  updateProfile(input: Partial<JobSeeker>): Promise<void>;
  updateCompany(input: Partial<Employer>): Promise<void>;
  addResume(file: FileMetadata): Promise<void>;
  replaceResume(fileId: string, file: FileMetadata): Promise<void>;
  deleteResume(fileId: string): Promise<void>;
  addNote(applicationId: string, text: string): Promise<void>;
  moderateJob(
    jobId: string,
    status: JobPosting["status"],
    reason: string,
  ): Promise<void>;
  setUserActive(userId: string, active: boolean): Promise<void>;
  referApplication(applicationId: string, referred: boolean): Promise<void>;
  saveAnnouncement(
    input: Omit<DemoState["announcements"][number], "id">,
    announcementId?: string,
  ): Promise<void>;
  deleteAnnouncement(announcementId: string): Promise<void>;
  updatePreferences(input: Partial<DemoState["preferences"]>): Promise<void>;
  updateNotificationPreferences(input: {
    applicationUpdates: boolean;
    announcements: boolean;
  }): Promise<void>;
}
export interface DemoApi extends JobLinkedApi {
  getState(): Promise<DemoState>;
  previewRole(role: Role): Promise<void>;
  reset(): Promise<void>;
}
