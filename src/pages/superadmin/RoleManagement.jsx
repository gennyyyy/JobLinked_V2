import { useState, useEffect } from "react";
import { listReferenceData, addReferenceData, removeReferenceData } from "../../services/admin";
import ConfirmationModal from "../../components/ConfirmationModal";
import LoadingScreen from "../../components/LoadingScreen";

const ROLE_DESCRIPTIONS = {
  "super-admin": "Full system access: manage employers, accreditations, jobs, users, and settings.",
  employer: "Post jobs, manage applicants, submit accreditation documents.",
  "job-seeker": "Browse jobs, manage profile, submit applications.",
};

function RoleManagement() {
  const [roles] = useState(["super-admin", "employer", "job-seeker"]);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newValues, setNewValues] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const categoryLabels = {
    employment_type: "Employment Types",
    education_level: "Education Levels",
  };

  useEffect(() => {
    Promise.all([
      listReferenceData("employment_type"),
      listReferenceData("education_level"),
    ])
      .then(([empTypes, eduLevels]) => {
        setCategories({ employment_type: empTypes, education_level: eduLevels });
      })
      .catch((err) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  async function handleAdd(category) {
    const value = (newValues[category] || "").trim();
    if (!value) return;
    await addReferenceData(category, value);
    const updated = await listReferenceData(category);
    setCategories((prev) => ({ ...prev, [category]: updated }));
    setNewValues((prev) => ({ ...prev, [category]: "" }));
  }

  async function handleRemove(category, id) {
    await removeReferenceData(id);
    const updated = await listReferenceData(category);
    setCategories((prev) => ({ ...prev, [category]: updated }));
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">SYSTEM ADMINISTRATION</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">Role & Reference Management</h1>
        <p className="mt-2 text-sm text-gray-500">View system roles and manage reference data used across portals</p>
      </header>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="border-l-4 border-primary pl-4 mb-6">
          <h2 className="text-lg font-semibold text-dark-blue">System Roles</h2>
          <p className="text-xs text-gray-500 mt-0.5">Roles are enforced by database row-level security</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          {roles.map((role) => (
            <div key={role} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-dark-blue capitalize">{role.replace("-", " ")}</h3>
              <p className="text-xs text-gray-500 mt-2">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          ))}
        </div>
      </section>

      {Object.entries(categoryLabels).map(([category, label]) => (
        <section key={category} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
          <div className="border-l-4 border-primary pl-4 mb-6">
            <h2 className="text-lg font-semibold text-dark-blue">{label}</h2>
          </div>
          <div className="space-y-2">
            {(categories[category] || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{item.value}</span>
                <button onClick={() => setConfirmDelete({ category, id: item.id, value: item.value })} className="text-xs text-danger hover:underline">Remove</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={newValues[category] || ""}
              onChange={(e) => setNewValues((prev) => ({ ...prev, [category]: e.target.value }))}
              placeholder={`Add ${label.toLowerCase().replace(/s$/, "")}...`}
              className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
            />
            <button onClick={() => handleAdd(category)} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">Add</button>
          </div>
        </section>
      ))}

      {confirmDelete && (
        <ConfirmationModal
          message={`Remove "${confirmDelete.value}"?`}
          onConfirm={() => handleRemove(confirmDelete.category, confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          confirmLabel="Remove"
          danger
        />
      )}
    </div>
  );
}

export default RoleManagement;
