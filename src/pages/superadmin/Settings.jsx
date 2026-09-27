import { useState, useEffect } from "react";
import { listBarangays, addBarangay, removeBarangay, listReferenceData, addReferenceData, removeReferenceData } from "../../services/admin";
import ConfirmationModal from "../../components/ConfirmationModal";
import LoadingScreen from "../../components/LoadingScreen";

function Settings() {
  const [barangays, setBarangays] = useState([]);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newBarangay, setNewBarangay] = useState("");
  const [newValues, setNewValues] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const categoryLabels = {
    employment_type: "Employment Types",
    education_level: "Education Levels",
  };

  useEffect(() => {
    Promise.all([
      listBarangays(),
      listReferenceData("employment_type"),
      listReferenceData("education_level"),
    ])
      .then(([b, emp, edu]) => {
        setBarangays(b);
        setCategories({ employment_type: emp, education_level: edu });
      })
      .catch((err) => setError(err.message || "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  async function handleAddBarangay() {
    const name = newBarangay.trim();
    if (!name) return;
    await addBarangay(name);
    setBarangays(await listBarangays());
    setNewBarangay("");
  }

  async function handleRemoveBarangay(id) {
    await removeBarangay(id);
    setBarangays(await listBarangays());
    setConfirmDelete(null);
  }

  async function handleAddCategory(category) {
    const value = (newValues[category] || "").trim();
    if (!value) return;
    await addReferenceData(category, value);
    const updated = await listReferenceData(category);
    setCategories((prev) => ({ ...prev, [category]: updated }));
    setNewValues((prev) => ({ ...prev, [category]: "" }));
  }

  async function handleRemoveCategory(category, id) {
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
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">SYSTEM SETTINGS</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl font-bold text-dark-blue">System Settings</h1>
        <p className="mt-2 text-sm text-gray-500">Manage platform reference data: barangays, employment types, education levels</p>
      </header>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="border-l-4 border-primary pl-4 mb-4">
          <h3 className="text-lg font-semibold text-dark-blue">Barangays</h3>
          <p className="text-sm text-gray-500 mt-1">Santa Maria barangays available for profiles and job postings</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {barangays.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-700">
              {b.name}
              <button onClick={() => setConfirmDelete({ type: "barangay", id: b.id, value: b.name })} className="text-gray-400 hover:text-danger">✕</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newBarangay}
            onChange={(e) => setNewBarangay(e.target.value)}
            placeholder="Add new barangay..."
            className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
          />
          <button onClick={handleAddBarangay} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">Add</button>
        </div>
      </section>

      {Object.entries(categoryLabels).map(([category, label]) => (
        <section key={category} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
          <div className="border-l-4 border-primary pl-4 mb-4">
            <h3 className="text-lg font-semibold text-dark-blue">{label}</h3>
          </div>
          <div className="space-y-2 mb-4">
            {(categories[category] || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{item.value}</span>
                <button onClick={() => setConfirmDelete({ type: "category", category, id: item.id, value: item.value })} className="text-xs text-danger hover:underline">Remove</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newValues[category] || ""}
              onChange={(e) => setNewValues((prev) => ({ ...prev, [category]: e.target.value }))}
              placeholder={`Add ${label.toLowerCase().replace(/s$/, "")}...`}
              className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
            />
            <button onClick={() => handleAddCategory(category)} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">Add</button>
          </div>
        </section>
      ))}

      {confirmDelete && (
        <ConfirmationModal
          message={`Remove "${confirmDelete.value}"?`}
          onConfirm={() => confirmDelete.type === "barangay" ? handleRemoveBarangay(confirmDelete.id) : handleRemoveCategory(confirmDelete.category, confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          confirmLabel="Remove"
          danger
        />
      )}
    </div>
  );
}

export default Settings;
