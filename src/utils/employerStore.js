const STORAGE_KEY = "joblinked_employer_applications";

export function getApplications() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveApplications(applications) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
}

export function addApplication(data) {
  const applications = getApplications();
  const application = {
    id: `emp-${Date.now()}`,
    status: "Pending",
    note: null,
    decidedAt: null,
    submittedAt: new Date().toISOString(),
    ...data,
  };
  saveApplications([application, ...applications]);
  return application;
}

export function updateApplicationStatus(id, status, note = null) {
  const applications = getApplications().map((application) =>
    application.id === id
      ? { ...application, status, note, decidedAt: new Date().toISOString() }
      : application,
  );
  saveApplications(applications);
  return applications;
}

export function getApplicationById(id) {
  return getApplications().find((application) => application.id === id);
}

export function findApplicationByEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  return getApplications().find(
    (application) => (application.companyEmail || "").toLowerCase() === normalized,
  );
}

export function getStats() {
  const applications = getApplications();
  return {
    pending: applications.filter((application) => application.status === "Pending").length,
    approved: applications.filter((application) => application.status === "Approved").length,
    rejected: applications.filter((application) => application.status === "Rejected").length,
    total: applications.length,
  };
}
