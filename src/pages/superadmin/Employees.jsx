import { useState } from "react";

const initialEmployees = [
  { name: 'Juan Dela Cruz', email: 'juan.delacruz@gmail.com', registered: 'Aug 20, 2026', status: 'Active' },
  { name: 'Pedro Ramos', email: 'pedro.ramos@gmail.com', registered: 'Aug 18, 2026', status: 'Active' },
  { name: 'Carla Mendoza', email: 'carla.mendoza@gmail.com', registered: 'Aug 15, 2026', status: 'Suspended' },
];

function Employees() {
  const [employees, setEmployees] = useState(initialEmployees);

  function toggleStatus(email) {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.email === email
          ? { ...emp, status: emp.status === 'Active' ? 'Suspended' : 'Active' }
          : emp
      )
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
          MUNICIPAL REGISTRY
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-white">
          Registered Job Seekers
        </h1>
        <p className="mt-2 text-sm text-white/55">
          View registered Santa Maria applicants and manage platform enrollment statuses
        </p>
      </header>

      <div className="bg-[#272727] border border-white/[0.06] rounded-2xl p-6 shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] font-mono text-[10px] tracking-widest text-white/40 uppercase">
                <th className="text-left py-3 px-4 font-medium">Applicant Name</th>
                <th className="text-left py-3 px-4 font-medium">Email Address</th>
                <th className="text-left py-3 px-4 font-medium">Date Registered</th>
                <th className="text-left py-3 px-4 font-medium">Account Status</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {employees.map((employee) => (
                <tr key={employee.email} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 text-white font-medium">{employee.name}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-white/50">{employee.email}</td>
                  <td className="py-3.5 px-4 text-xs text-white/50">{employee.registered}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                        employee.status === 'Active'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      {employee.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => toggleStatus(employee.email)}
                      className={`text-xs font-mono transition-colors ${
                        employee.status === 'Active'
                          ? 'text-rose-400/80 hover:text-rose-300'
                          : 'text-[#0075A2] hover:text-white'
                      }`}
                    >
                      {employee.status === 'Active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Employees;
