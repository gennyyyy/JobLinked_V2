const ROLES = ["super-admin", "employer", "job-seeker"];

const ROLE_DESCRIPTIONS = {
  "super-admin": "Full system access: manage employers, accreditations, jobs, users, and settings.",
  employer: "Post jobs, manage applicants, submit accreditation documents.",
  "job-seeker": "Browse jobs, manage profile, submit applications.",
};

function RoleManagement() {
  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">SYSTEM ADMINISTRATION</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">Roles</h1>
        <p className="mt-2 text-sm text-gray-500">Roles in the system and what each can do</p>
      </header>

      <section className="bg-white border-2 border-primary rounded-2xl p-6 shadow-sm">
        <div className="border-l-4 border-primary pl-4 mb-6">
          <h2 className="text-lg font-semibold text-dark-blue">System Roles</h2>
          <p className="text-xs text-gray-500 mt-0.5">Roles are enforced by the API's ownership and role checks</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          {ROLES.map((role) => (
            <div key={role} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-dark-blue capitalize">{role.replace("-", " ")}</h3>
              <p className="text-xs text-gray-500 mt-2">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default RoleManagement;
