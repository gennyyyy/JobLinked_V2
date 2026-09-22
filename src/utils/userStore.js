const ACCOUNTS_KEY = "joblinked_accounts";

export function getAccounts() {
  try {
    const stored = localStorage.getItem(ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function addAccount(data) {
  const accounts = getAccounts();
  const account = {
    id: `acc-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...data,
  };
  saveAccounts([...accounts, account]);
  return account;
}

export function findAccountByEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  return getAccounts().find((account) => (account.email || "").toLowerCase() === normalized);
}

export function findAccountByRoleAndEmail(role, email) {
  const normalized = (email || "").trim().toLowerCase();
  return getAccounts().find(
    (account) => account.role === role && (account.email || "").toLowerCase() === normalized
  );
}

const ADMIN_SEED = {
  role: "super-admin",
  email: "admin@peso.gov.ph",
  password: "password123",
  firstName: "Super",
  lastName: "Admin",
};

const EMPLOYER_SEED = {
  role: "employer",
  email: "employer@company.com",
  password: "password123",
  firstName: "Company",
  lastName: "HR",
};

const SEEKER_SEED = {
  role: "job-seeker",
  email: "seeker@gmail.com",
  password: "password123",
  firstName: "John",
  lastName: "Doe",
};

export function getAdminAccount() {
  const existing = getAccounts().find((account) => account.role === "super-admin");
  if (existing) return existing;
  addAccount(ADMIN_SEED);
  return { ...ADMIN_SEED };
}

export function getEmployerAccount() {
  const existing = getAccounts().find((account) => account.role === "employer");
  if (existing) return existing;
  addAccount(EMPLOYER_SEED);
  return { ...EMPLOYER_SEED };
}

export function getSeekerAccount() {
  const existing = getAccounts().find((account) => account.role === "job-seeker");
  if (existing) return existing;
  addAccount(SEEKER_SEED);
  return { ...SEEKER_SEED };
}

export function getAccountProfile(role, email) {
  const account = findAccountByRoleAndEmail(role, email);
  return account?.profile || null;
}

export function saveAccountProfile(role, email, profile) {
  const accounts = getAccounts();
  const normalized = (email || "").trim().toLowerCase();
  const next = accounts.map((account) =>
    account.role === role && (account.email || "").toLowerCase() === normalized
      ? { ...account, profile: { ...account.profile, ...profile } }
      : account
  );
  saveAccounts(next);
  return next;
}

// Auto-seed default accounts on first load so login works immediately
(function seedDefaults() {
  const accounts = getAccounts();
  if (!accounts.some((a) => a.role === "super-admin")) addAccount(ADMIN_SEED);
  if (!accounts.some((a) => a.role === "employer")) addAccount(EMPLOYER_SEED);
  if (!accounts.some((a) => a.role === "job-seeker")) addAccount(SEEKER_SEED);
})();
