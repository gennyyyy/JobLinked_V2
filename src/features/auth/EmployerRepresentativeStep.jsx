import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhoneDisplay, toLocalDigits } from "@/shared/utils/phone";


function EmployerRepresentativeStep({ errors, setErrors, inputClass, labelClass, reqMark, form, set }) {
  function field(name, value) {
    set?.(name, value);
    if (errors?.[name]) setErrors?.((prev) => ({ ...prev, [name]: undefined }));
  }
  return (
            <section className="surface p-5">
              <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 2 — Authorized Representative</p>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="repFirstName" className={labelClass}>First Name{reqMark}</Label>
                  <Input id="repFirstName" name="repFirstName" type="text" placeholder="Maria" value={form?.repFirstName ?? ""} className={inputClass} onChange={(e) => field("repFirstName", e.target.value)} />
                    {errors?.repFirstName && <p className="text-danger text-xs mt-1">{errors.repFirstName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="repMiddleName" className={labelClass}>Middle Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="repMiddleName" name="repMiddleName" type="text" placeholder="Santos" value={form?.repMiddleName ?? ""} className={inputClass} onChange={(e) => field("repMiddleName", e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="repLastName" className={labelClass}>Last Name{reqMark}</Label>
                  <Input id="repLastName" name="repLastName" type="text" placeholder="Reyes" value={form?.repLastName ?? ""} className={inputClass} onChange={(e) => field("repLastName", e.target.value)} />
                    {errors?.repLastName && <p className="text-danger text-xs mt-1">{errors.repLastName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="repSuffix" className={labelClass}>Suffix <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="repSuffix" name="repSuffix" type="text" placeholder="Jr., Sr., III" value={form?.repSuffix ?? ""} className={inputClass} onChange={(e) => field("repSuffix", e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="repPosition" className={labelClass}>Designation / Position{reqMark}</Label>
                    <Input id="repPosition" name="repPosition" type="text" placeholder="e.g. HR Manager" value={form?.repPosition ?? ""} className={inputClass} onChange={(e) => field("repPosition", e.target.value)} />
                    {errors?.repPosition && <p className="text-danger text-xs mt-1">{errors.repPosition}</p>}
                  </div>
                  <div>
                    <Label htmlFor="repMobile" className={labelClass}>Representative Mobile{reqMark}</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">+63</span>
                      <Input id="repMobile" name="repMobile" type="tel" inputMode="numeric" placeholder="917 123 4567" value={formatPhoneDisplay(form?.repMobile)} className={`${inputClass} pl-12`} onChange={(e) => field("repMobile", toLocalDigits(e.target.value))} />
                    </div>
                    {errors?.repMobile && <p className="text-danger text-xs mt-1">{errors.repMobile}</p>}
                  </div>
                  <div>
                    <Label htmlFor="repEmail" className={labelClass}>Representative Email{reqMark}</Label>
                    <Input id="repEmail" name="repEmail" type="email" placeholder="maria@company.com" value={form?.repEmail ?? ""} className={inputClass} onChange={(e) => field("repEmail", e.target.value)} />
                    {errors?.repEmail && <p className="text-danger text-xs mt-1">{errors.repEmail}</p>}
                  </div>
                </div>
              </div>
            </section>
  );
}

export default EmployerRepresentativeStep;