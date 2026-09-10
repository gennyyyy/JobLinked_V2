const JOBS_KEY = "joblinked_jobs";
const APPS_KEY = "joblinked_applications";

function read(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ensureSeed() {
  if (!localStorage.getItem(JOBS_KEY)) {
    write(JOBS_KEY, []);
  }
  if (!localStorage.getItem(APPS_KEY)) {
    write(APPS_KEY, []);
  }
}

export function getJobs() {
  ensureSeed();
  return read(JOBS_KEY, []);
}

export function getJobById(id) {
  return getJobs().find((job) => job.id === String(id));
}

export function getJobsByEmployer(companyEmail) {
  return getJobs().filter((job) => job.companyEmail === companyEmail);
}

export function addJob(data) {
  const jobs = getJobs();
  const job = {
    id: `job-${Date.now()}`,
    status: "Open",
    posted: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    createdAt: new Date().toISOString(),
    ...data,
  };
  write(JOBS_KEY, [job, ...jobs]);
  return job;
}

export function updateJob(id, patch) {
  const jobs = getJobs().map((job) => (job.id === String(id) ? { ...job, ...patch } : job));
  write(JOBS_KEY, jobs);
  return jobs;
}

export function deleteJob(id) {
  write(JOBS_KEY, getJobs().filter((job) => job.id !== String(id)));
}

export function getApplications() {
  ensureSeed();
  return read(APPS_KEY, []);
}

export function getApplicationsBySeeker(seekerEmail) {
  return getApplications().filter(
    (app) => (app.seekerEmail || "").toLowerCase() === (seekerEmail || "").toLowerCase(),
  );
}

export function getApplicationsByJob(jobId) {
  return getApplications().filter((app) => app.jobId === String(jobId));
}

export function getApplicationsByEmployer(companyEmail) {
  return getApplications().filter((app) => app.companyEmail === companyEmail);
}

export function addApplication(data) {
  const apps = getApplications();
  const already = apps.some(
    (app) =>
      app.jobId === String(data.jobId) &&
      (app.seekerEmail || "").toLowerCase() === (data.seekerEmail || "").toLowerCase(),
  );
  if (already) return null;
  const application = {
    id: `app-${Date.now()}`,
    status: "Under Review",
    applied: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    appliedAt: new Date().toISOString(),
    ...data,
  };
  write(APPS_KEY, [application, ...apps]);
  return application;
}

export function updateApplicationStatus(id, status) {
  const apps = getApplications().map((app) =>
    app.id === String(id) ? { ...app, status } : app,
  );
  write(APPS_KEY, apps);
  return apps;
}
