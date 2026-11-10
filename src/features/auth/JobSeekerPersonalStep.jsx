import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPLOYMENT_STATUSES } from "@/shared/constants";
import { normalizePhone, withPrefix } from "@/shared/utils/phone";

function JobSeekerPersonalStep({ form, errors, set, autofillStatus, autofillTouched = [], handleResumeChange, inputClass, labelClass, reqMark }) {
  return (
            <section className="surface p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 1 — Personal Details</p>
              <div className="space-y-4">
            <section className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
              <Label htmlFor="resumeAutofill" className={`${labelClass} text-primary`}>Autofill from resume (PDF or DOCX only)</Label>
              <Input
                id="resumeAutofill"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleResumeChange}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:min-h-[40px] file:px-4 file:rounded-xl file:border-0 file:bg-primary file:text-white file:text-xs file:font-semibold hover:file:bg-primary-hover file:cursor-pointer cursor-pointer"
              />
              <p className="mt-2 text-xs text-muted-foreground">PDF up to 2 MB or DOCX up to 5 MB. We'll fill in details below; review and edit them before continuing.</p>
              {autofillStatus && (
                <p role="status" aria-live="polite" data-autofill-touched={autofillTouched.join(",")} className="mt-2 text-xs font-medium text-primary">{autofillStatus}</p>
              )}
            </section>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="firstName" className={labelClass}>First Name{reqMark}</Label>
                <Input id="firstName" name="firstName" type="text" placeholder="Juan" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputClass} />
                {errors.firstName && <p className="text-danger text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <Label htmlFor="middleName" className={labelClass}>Middle Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="middleName" name="middleName" type="text" placeholder="Santos" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} className={inputClass} />
              </div>
              <div>
                <Label htmlFor="lastName" className={labelClass}>Last Name{reqMark}</Label>
                <Input id="lastName" name="lastName" type="text" placeholder="Dela Cruz" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputClass} />
                {errors.lastName && <p className="text-danger text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="suffix" className={labelClass}>Suffix <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="suffix" name="suffix" type="text" placeholder="Jr., Sr., III" value={form.suffix} onChange={(e) => set("suffix", e.target.value)} className={inputClass} />
              </div>
              <div>
                <Label htmlFor="birthdate" className={labelClass}>Birthday{reqMark}</Label>
                <Input id="birthdate" name="birthdate" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} className={inputClass} />
                {errors.birthdate && <p className="text-danger text-xs mt-1">{errors.birthdate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="mobileNumber" className={labelClass}>Mobile Number{reqMark}</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">+63</span>
                  <Input id="mobileNumber" name="mobileNumber" type="tel" inputMode="numeric" maxLength={10} placeholder="917 123 4567" value={form.mobileNumber.replace(/^\+63/, "")} onChange={(e) => set("mobileNumber", withPrefix(e.target.value))} onBlur={(e) => set("mobileNumber", normalizePhone(e.target.value))} className={`${inputClass} pl-12`} />
                </div>
                {errors.mobileNumber && <p className="text-danger text-xs mt-1">{errors.mobileNumber}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="email" className={labelClass}>Email Address{reqMark}</Label>
              <Input id="email" name="email" type="email" placeholder="juan.delacruz@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />
              {errors.email && <p className="text-danger text-xs mt-1">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="password" className={labelClass}>Password{reqMark}</Label>
                <Input id="password" name="password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={(e) => set("password", e.target.value)} className={inputClass} />
                {errors.password && <p className="text-danger text-xs mt-1">{errors.password}</p>}
              </div>
              <div>
                <Label htmlFor="confirmPassword" className={labelClass}>Confirm Password{reqMark}</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} className={inputClass} />
                {errors.confirmPassword && <p className="text-danger text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="employmentStatus" className={labelClass}>Employment Status{reqMark}</Label>
              <select id="employmentStatus" name="employmentStatus" value={form.employmentStatus} onChange={(e) => set("employmentStatus", e.target.value)} className={inputClass}>
                <option value="">Select status</option>
                {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.employmentStatus && <p className="text-danger text-xs mt-1">{errors.employmentStatus}</p>}
            </div>
              </div>
            </section>
  );
}

export default JobSeekerPersonalStep;
