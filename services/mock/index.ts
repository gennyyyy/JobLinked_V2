import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/constants";
import { isJobOpen, profileCompletion } from "@/lib/format";
import type { DemoApi } from "@/services/api/contracts";
import type {
  AccreditationStatus,
  ApplicationStatus,
  DemoState,
  Employer,
  FileMetadata,
  JobPosting,
  JobSeeker,
  RegistrationInput,
} from "@/types";
import {
  audit,
  commit,
  current,
  makeId,
  notify,
  now,
  rememberUser,
  requireEmployer,
  requireUser,
  resetStore,
  wait,
} from "./store";
import { buildReport } from "./reports";
import { hasPermission } from "@/lib/permissions";
import { ensureEmployment, trackingActions } from "./tracking";

type ExtraActions = {
  selectDemoAccount(userId: string): Promise<void>;
  updateProfile(input: Partial<JobSeeker>): Promise<void>;
  updateCompany(input: Partial<Employer>): Promise<void>;
  addResume(file: FileMetadata): Promise<void>;
  deleteResume(fileId: string): Promise<void>;
  replaceResume(fileId: string, file: FileMetadata): Promise<void>;
  updateNotificationPreferences(input: {
    applicationUpdates: boolean;
    announcements: boolean;
  }): Promise<void>;
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
};

export const demoApi: DemoApi & ExtraActions & typeof trackingActions = {
  ...trackingActions,
  async getState() {
    await wait();
    return current();
  },
  async selectDemoAccount(userId) {
    const target = current().users.find((u) => u.id === userId && u.active);
    if (!target) throw new Error("Choose an active sample account.");
    await commit((s) => {
      s.sessionUserId = userId;
    });
    rememberUser(userId);
  },
  async login(email, password, remember) {
    const account = current().users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase().trim(),
    );
    if (!account || password !== DEMO_PASSWORD)
      throw new Error(
        "Use a listed demo account and the sample password Demo123!. Real credentials are not supported.",
      );
    if (!account.active)
      throw new Error(
        "This sample account is suspended. A PESO demo administrator can reactivate it.",
      );
    await commit((s) => {
      s.sessionUserId = account.id;
    });
    rememberUser(account.id, remember);
    return { user: account };
  },
  async previewRole(role) {
    const account = DEMO_ACCOUNTS.find((a) => a.role === role)!;
    if (!current().users.find((u) => u.id === account.id)?.active)
      throw new Error(
        "This demo account is suspended. Reactivate it from User Management.",
      );
    await commit((s) => {
      s.sessionUserId = account.id;
    });
    rememberUser(account.id);
  },
  async logout() {
    await commit((s) => {
      s.sessionUserId = null;
    });
    rememberUser(null);
  },
  async register(input: RegistrationInput) {
    if (!input.privacyAcknowledged || !input.termsAccepted)
      throw new Error(
        "Acknowledge the Privacy Notice and accept the demo Terms first.",
      );
    if (
      current().users.some(
        (u) => u.email.toLowerCase() === input.email.toLowerCase(),
      )
    )
      throw new Error(
        "This email is already used. Choose another fictional email.",
      );
    if (
      input.role === "employer" &&
      (!input.representativeDeclared || !input.processingConsent)
    )
      throw new Error(
        "The authorized representative declaration and processing consent are required.",
      );
    const newId = makeId(input.role);
    const newUser = {
      id: newId,
      name: input.name,
      email: input.email,
      role: input.role,
      active: true,
      createdAt: now(),
    };
    await commit((s) => {
      s.users.push(newUser);
      if (input.role === "jobseeker")
        s.seekers.push({
          ...newUser,
          role: "jobseeker",
          phone: input.phone,
          barangay: input.barangay,
          address: input.address,
          headline: "Ready for opportunities close to home",
          education: input.education ?? "",
          experience: input.experience ?? "",
          skills: input.skills ?? [],
          resumes: input.resume ? [input.resume] : [],
          savedJobIds: [],
        });
      else {
        const companyId = makeId("company");
        s.employers.push({
          id: companyId,
          userId: newId,
          name: input.companyName!,
          initials: input.companyName!.slice(0, 2).toUpperCase(),
          color: "blue",
          industry: input.industry ?? "",
          barangay: input.barangay,
          address: input.address,
          description: input.description ?? "",
          email: input.email,
          phone: input.phone,
          representative: input.name,
          website: "",
          accreditationStatus: "Pending Review",
        });
        s.accreditations.push({
          id: makeId("accreditation"),
          employerId: companyId,
          status: "Pending Review",
          submittedAt: now(),
          documents: input.documents,
          feedback: "",
          history: [
            {
              status: "Pending Review",
              date: now(),
              reviewer: "Demo submission",
              reason: "Initial sample accreditation submission.",
            },
          ],
        });
        notify(
          s,
          "admin-1",
          "New employer accreditation",
          `${input.companyName} submitted a sample accreditation.`,
          "/admin/accreditation",
          "accreditation",
        );
      }
      s.sessionUserId = newId;
      audit(s, "Registered demo profile", input.role);
    });
    rememberUser(null);
    return { user: newUser };
  },
  reset: resetStore,
  async listJobs() {
    await wait();
    return current().jobs.filter(
      (j) =>
        j.status === "Published" &&
        current().employers.find((e) => e.id === j.employerId)
          ?.accreditationStatus === "Approved",
    );
  },
  async saveJob(jobId) {
    await commit((s) => {
      const actor = requireUser(s, "jobseeker");
      const seeker = s.seekers.find((p) => p.id === actor.id)!;
      if (!s.jobs.some((j) => j.id === jobId))
        throw new Error("This vacancy is no longer available.");
      seeker.savedJobIds = seeker.savedJobIds.includes(jobId)
        ? seeker.savedJobIds.filter((j) => j !== jobId)
        : [...seeker.savedJobIds, jobId];
    });
  },
  async updateProfile(input) {
    await commit((s) => {
      const actor = requireUser(s, "jobseeker");
      const profile = s.seekers.find((p) => p.id === actor.id)!;
      const {
        name,
        phone,
        barangay,
        address,
        headline,
        education,
        experience,
        skills,
      } = input;
      Object.assign(
        profile,
        Object.fromEntries(
          Object.entries({
            name,
            phone,
            barangay,
            address,
            headline,
            education,
            experience,
            skills,
          }).filter(([, value]) => value !== undefined),
        ),
      );
      actor.name = profile.name;
      audit(s, "Updated sample profile", "Own profile");
    });
  },
  async updateCompany(input) {
    await commit((s) => {
      const company = requireEmployer(s);
      const {
        name,
        description,
        industry,
        barangay,
        address,
        email,
        phone,
        website,
      } = input;
      Object.assign(
        company,
        Object.fromEntries(
          Object.entries({
            name,
            description,
            industry,
            barangay,
            address,
            email,
            phone,
            website,
          }).filter(([, value]) => value !== undefined),
        ),
      );
      audit(s, "Updated company profile", company.name);
    });
  },
  async addResume(file) {
    await commit((s) => {
      const actor = requireUser(s, "jobseeker");
      const profile = s.seekers.find((p) => p.id === actor.id)!;
      if (profile.resumes.length >= 1)
        throw new Error(
          "Only one resume is allowed. Replace or delete your current resume before adding another.",
        );
      profile.resumes.push(file);
    });
  },
  async deleteResume(fileId) {
    await commit((s) => {
      const actor = requireUser(s, "jobseeker");
      const profile = s.seekers.find((p) => p.id === actor.id)!;
      profile.resumes = profile.resumes.filter((f) => f.id !== fileId);
    });
  },
  async replaceResume(fileId, file) {
    await commit((s) => {
      const actor = requireUser(s, "jobseeker");
      const profile = s.seekers.find((p) => p.id === actor.id)!;
      const index = profile.resumes.findIndex((f) => f.id === fileId);
      if (index < 0)
        throw new Error("Resume metadata not found in your profile.");
      profile.resumes[index] = file;
    });
  },
  async updateNotificationPreferences(input) {
    await commit((s) => {
      const actor = requireUser(s);
      s.userPreferences ??= {};
      s.userPreferences[actor.id] = input;
    });
  },
  async apply(jobId, resumeId, coverLetter) {
    const applicationId = makeId("application");
    await commit((s) => {
      const actor = requireUser(s, "jobseeker");
      const profile = s.seekers.find((p) => p.id === actor.id)!;
      const job = s.jobs.find((j) => j.id === jobId);
      if (
        !job ||
        !isJobOpen(job) ||
        s.employers.find((e) => e.id === job.employerId)
          ?.accreditationStatus !== "Approved"
      )
        throw new Error("This vacancy is closed, expired, or unavailable.");
      if (
        !profile.phone ||
        !profile.barangay ||
        !profile.address ||
        !profile.education ||
        !profile.skills.length ||
        profileCompletion(profile) < 75
      )
        throw new Error(
          "Complete your contact, address, education, and skills in My Profile before applying.",
        );
      if (
        s.applications.some((a) => a.seekerId === actor.id && a.jobId === jobId)
      )
        throw new Error(
          "You already applied for this vacancy. Track it in My Applications.",
        );
      const resume = profile.resumes.find((r) => r.id === resumeId);
      if (!resume) throw new Error("Select a sample resume before applying.");
      if (coverLetter.length > 3000)
        throw new Error("Keep the cover letter within 3,000 characters.");
      s.applications.unshift({
        id: applicationId,
        jobId,
        seekerId: actor.id,
        status: "Submitted",
        submittedAt: now(),
        resumeName: resume.name,
        coverLetter,
        timeline: [
          {
            status: "Submitted",
            date: now(),
            description:
              "Your sample application was received. No actual application was sent.",
          },
        ],
        notes: [],
        referred: false,
      });
      notify(
        s,
        s.employers.find((e) => e.id === job.employerId)!.userId,
        "New sample application",
        `${actor.name} applied for ${job.title}.`,
        `/employer/applicants/${applicationId}`,
      );
      notify(
        s,
        actor.id,
        "Application submitted in demo",
        `Track your ${job.title} application.`,
        `/jobseeker/applications/${applicationId}`,
      );
      audit(s, "Submitted sample application", job.title);
    });
    return applicationId;
  },
  async createJob(input) {
    const jobId = makeId("job");
    await commit((s) => {
      const company = requireEmployer(s);
      if (
        input.status === "Published" &&
        company.accreditationStatus !== "Approved"
      )
        throw new Error(
          "PESO approval is required before publishing. You may save a draft.",
        );
      if (
        !input.title.trim() ||
        !Number.isInteger(input.openings) ||
        input.openings < 1 ||
        input.openings > 1000
      )
        throw new Error("Provide a title and 1–1,000 openings.");
      if (
        input.status === "Published" &&
        new Date(input.deadline) < new Date(new Date().toDateString())
      )
        throw new Error("Choose a future application deadline.");
      const job = {
        ...input,
        id: jobId,
        employerId: company.id,
        postedAt: now(),
      };
      s.jobs.unshift(job);
      audit(
        s,
        input.status === "Published" ? "Published vacancy" : "Drafted vacancy",
        job.title,
      );
    });
    return current().jobs.find((j) => j.id === jobId)!;
  },
  async updateJob(jobId, input) {
    await commit((s) => {
      const company = requireEmployer(s);
      const job = s.jobs.find(
        (j) => j.id === jobId && j.employerId === company.id,
      );
      if (!job) throw new Error("You can only update your own vacancies.");
      if (job.status === "Removed" || job.status === "Flagged")
        throw new Error(
          "A moderated vacancy needs PESO clearance before it can be changed.",
        );
      if (
        input.status === "Published" &&
        company.accreditationStatus !== "Approved"
      )
        throw new Error("PESO approval is required before publishing.");
      if (
        input.status === "Published" &&
        new Date(input.deadline ?? job.deadline) <
          new Date(new Date().toDateString())
      )
        throw new Error("Update the expired deadline before reopening.");
      const { id: _id, employerId: _employerId, ...safeInput } = input;
      Object.assign(job, safeInput);
      audit(s, "Updated vacancy", job.title);
    });
    return current().jobs.find((j) => j.id === jobId)!;
  },
  async updateApplication(applicationId, status: ApplicationStatus, interview) {
    await commit((s) => {
      const company = requireEmployer(s);
      const application = s.applications.find((a) => a.id === applicationId);
      const job = s.jobs.find(
        (j) => j.id === application?.jobId && j.employerId === company.id,
      );
      if (!application || !job)
        throw new Error(
          "This application is not associated with your company.",
        );
      if (status === application.status && !interview) {
        if (status === "Hired") {
          ensureEmployment(s, applicationId);
          return;
        }
        throw new Error("Choose a different status.");
      }
      if (
        s.employmentRecords.some((r) => r.applicationId === applicationId) &&
        status !== "Hired"
      )
        throw new Error(
          "This applicant is already hired. Update their employment record instead.",
        );
      if (
        status === "Interview Scheduled" &&
        (!interview?.date ||
          !Number.isFinite(Date.parse(interview.date)) ||
          interview.location.trim().length < 3 ||
          Date.parse(interview.date) <= Date.now())
      )
        throw new Error(
          "Provide a future interview date and a location or meeting link.",
        );
      if (status === "Hired" && company.accreditationStatus !== "Approved")
        throw new Error(
          "Company verification is required before confirming a hire.",
        );
      application.status = status;
      if (interview) application.interview = interview;
      application.timeline.push({
        status,
        date: now(),
        description:
          status === "Rejected"
            ? "The employer decided not to proceed with this sample application."
            : `Your application is now ${status.toLowerCase()}.${interview ? ` Interview: ${interview.location}.` : ""}`,
      });
      notify(
        s,
        application.seekerId,
        `Application update: ${status}`,
        `${job.title} at ${company.name}`,
        `/jobseeker/applications/${applicationId}`,
        status === "Interview Scheduled" ? "interview" : "application",
      );
      if (status === "Hired") ensureEmployment(s, applicationId);
      audit(s, `Updated application to ${status}`, job.title);
    });
  },
  async addNote(applicationId, text) {
    await commit((s) => {
      const company = requireEmployer(s);
      const application = s.applications.find((a) => a.id === applicationId);
      if (
        !application ||
        !s.jobs.some(
          (j) => j.id === application.jobId && j.employerId === company.id,
        )
      )
        throw new Error("This candidate is not available to your company.");
      if (!text.trim() || text.length > 2000)
        throw new Error("Enter a note with 1–2,000 characters.");
      application.notes.unshift({
        id: makeId("note"),
        text: text.trim(),
        date: now(),
        authorId: requireUser(s).id,
      });
      audit(s, "Added internal note", applicationId);
    });
  },
  async reviewAccreditation(employerId, status: AccreditationStatus, reason) {
    await commit((s) => {
      const actor = requireUser(s);
      if (
        !["admin", "staff"].includes(actor.role) ||
        !hasPermission(s, actor, "accreditation")
      )
        throw new Error("Accreditation review permission required.");
      const company = s.employers.find((e) => e.id === employerId);
      const accreditation = s.accreditations.find(
        (a) => a.employerId === employerId,
      );
      if (!company || !accreditation)
        throw new Error("Accreditation not found.");
      if (
        status !== "Approved" &&
        status !== "Pending Review" &&
        reason.trim().length < 10
      )
        throw new Error("Provide a reason of at least 10 characters.");
      if (
        status === "Approved" &&
        s.preferences.requirements.some(
          (r) => !accreditation.documents.some((d) => d.category === r),
        )
      )
        throw new Error(
          "All configured documents are required before approval.",
        );
      company.accreditationStatus = status;
      accreditation.status = status;
      accreditation.feedback =
        reason.trim() || "Sample documents reviewed and accepted.";
      accreditation.history.push({
        status,
        date: now(),
        reviewer: actor.name,
        reason: accreditation.feedback,
      });
      notify(
        s,
        company.userId,
        `Accreditation: ${status}`,
        accreditation.feedback,
        "/employer/accreditation",
        "accreditation",
      );
      audit(s, `${status} accreditation`, company.name);
    });
  },
  async submitAccreditation(documents) {
    await commit((s) => {
      const company = requireEmployer(s);
      if (
        s.preferences.requirements.some(
          (category) => !documents.some((d) => d.category === category),
        )
      )
        throw new Error(
          "Attach a sample file for each configured requirement.",
        );
      const accreditation = s.accreditations.find(
        (a) => a.employerId === company.id,
      )!;
      accreditation.documents = documents;
      accreditation.status = "Pending Review";
      accreditation.submittedAt = now();
      accreditation.feedback = "";
      accreditation.history.push({
        status: "Pending Review",
        date: now(),
        reviewer: requireUser(s).name,
        reason: "Sample documents resubmitted.",
      });
      company.accreditationStatus = "Pending Review";
      notify(
        s,
        "admin-1",
        "Accreditation ready for review",
        company.name,
        "/admin/accreditation",
        "accreditation",
      );
      audit(s, "Resubmitted accreditation", company.name);
    });
  },
  async markNotification(notificationId, read) {
    await commit((s) => {
      const actor = requireUser(s);
      for (const n of s.notifications)
        if (
          n.userId === actor.id &&
          (notificationId === "all" || n.id === notificationId)
        )
          n.read = read;
    });
  },
  async moderateJob(jobId, status, reason) {
    await commit((s) => {
      requireUser(s, "admin");
      const job = s.jobs.find((j) => j.id === jobId);
      if (!job) throw new Error("Vacancy not found.");
      if (
        status === "Published" &&
        s.employers.find((e) => e.id === job.employerId)
          ?.accreditationStatus !== "Approved"
      )
        throw new Error("The employer must be approved before publication.");
      if (["Flagged", "Removed"].includes(status) && reason.trim().length < 10)
        throw new Error(
          "Provide a moderation reason of at least 10 characters.",
        );
      if (status === "Published" && !isJobOpen({ ...job, status }))
        throw new Error("The application deadline has passed.");
      job.status = status;
      job.moderationNote = reason;
      notify(
        s,
        s.employers.find((e) => e.id === job.employerId)!.userId,
        `Vacancy ${status.toLowerCase()}`,
        `${job.title}: ${reason || "Sample posting reviewed."}`,
        "/employer/jobs",
      );
      audit(s, `${status} vacancy`, job.title);
    });
  },
  async setUserActive(userId, active) {
    await commit((s) => {
      const actor = requireUser(s, "admin");
      if (actor.id === userId)
        throw new Error("You cannot suspend your own administrator account.");
      const target = s.users.find((u) => u.id === userId);
      if (!target) throw new Error("User not found.");
      if (
        target.role === "admin" &&
        target.active &&
        !active &&
        s.users.filter((u) => u.role === "admin" && u.active).length <= 1
      )
        throw new Error("The last active administrator must be retained.");
      s.roleChangeLogs.unshift({
        id: makeId("access-audit"),
        userId,
        previousRole: target.role,
        newRole: target.role,
        administratorId: actor.id,
        timestamp: now(),
        reason: active
          ? "Account reactivated from User Management"
          : "Account suspended from User Management",
        previousActive: target.active,
        newActive: active,
      });
      target.updatedAt = now();
      target.active = active;
      const profile = s.seekers.find((p) => p.id === userId);
      if (profile) profile.active = active;
      audit(
        s,
        active ? "Reactivated account" : "Suspended account",
        target.name,
      );
    });
  },
  async referApplication(applicationId, referred) {
    await commit((s) => {
      requireUser(s, "admin");
      const application = s.applications.find((a) => a.id === applicationId);
      if (!application) throw new Error("Application not found.");
      application.referred = referred;
      audit(
        s,
        referred ? "Recorded sample referral" : "Removed sample referral",
        applicationId,
      );
    });
  },
  async saveAnnouncement(input, announcementId) {
    await commit((s) => {
      requireUser(s, "admin");
      if (input.title.trim().length < 5 || input.body.trim().length < 15)
        throw new Error("Provide a descriptive title and announcement.");
      const existing = s.announcements.find((a) => a.id === announcementId);
      if (existing) Object.assign(existing, input);
      else s.announcements.unshift({ ...input, id: makeId("announcement") });
      if (input.published)
        for (const account of s.users.filter((u) => u.active))
          notify(
            s,
            account.id,
            input.title,
            input.body,
            "/peso-services",
            "announcement",
          );
      audit(
        s,
        existing ? "Updated announcement" : "Created announcement",
        input.title,
      );
    });
  },
  async deleteAnnouncement(announcementId) {
    await commit((s) => {
      requireUser(s, "admin");
      const target = s.announcements.find((a) => a.id === announcementId);
      if (!target) throw new Error("Announcement not found.");
      s.announcements = s.announcements.filter((a) => a.id !== announcementId);
      audit(s, "Deleted announcement", target.title);
    });
  },
  async updatePreferences(input) {
    await commit((s) => {
      const actor = requireUser(s);
      if (
        actor.role !== "admin" &&
        Object.keys(input).some(
          (k) => !["applicationUpdates", "announcements"].includes(k),
        )
      )
        throw new Error("Only PESO administrators can edit system policies.");
      Object.assign(s.preferences, input);
      audit(
        s,
        "Updated demo preferences",
        actor.role === "admin"
          ? "System configuration"
          : "Notification preferences",
      );
    });
  },
  async getReport(from, to) {
    await wait();
    const s = current();
    const actor = requireUser(s);
    if (
      !["admin", "staff"].includes(actor.role) ||
      !hasPermission(s, actor, "reports")
    )
      throw new Error("PESO reporting permission required.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      !Number.isFinite(Date.parse(from)) ||
      !Number.isFinite(Date.parse(to)) ||
      from > to ||
      (Date.parse(to) - Date.parse(from)) / 86400000 > 3660
    )
      throw new Error("Choose a valid date range of no more than ten years.");
    return buildReport(s, from, to);
  },
};
