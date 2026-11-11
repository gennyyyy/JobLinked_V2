import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toLocalDigits } from "@/shared/utils/phone";

function EmployerRepresentativeStep({ errors, setErrors, inputClass, labelClass, reqMark }) {
  return (
            <section className="surface p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 2 — Authorized Representative</p>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="repFirstName" className={labelClass}>First Name{reqMark}</Label>
                  <Input id="repFirstName" name="repFirstName" type="text" placeholder="Maria" className={inputClass} onChange={() => { if (errors.repFirstName) setErrors((prev) => ({ ...prev, repFirstName: undefined })); }} />
                    {errors.repFirstName && <p className="text-danger text-xs mt-1">{errors.repFirstName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="repMiddleName" className={labelClass}>Middle Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="repMiddleName" name="repMiddleName" type="text" placeholder="Santos" className={inputClass} />
                  </div>
                  <div>
                    <Label htmlFor="repLastName" className={labelClass}>Last Name{reqMark}</Label>
                  <Input id="repLastName" name="repLastName" type="text" placeholder="Reyes" className={inputClass} onChange={() => { if (errors.repLastName) setErrors((prev) => ({ ...prev, repLastName: undefined })); }} />
                    {errors.repLastName && <p className="text-danger text-xs mt-1">{errors.repLastName}</p>}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="repSuffix" className={labelClass}>Suffix <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="repSuffix" name="repSuffix" type="text" placeholder="Jr., Sr., III" className={inputClass} />
                  </div>
                  <div>
                    <Label htmlFor="repPosition" className={labelClass}>Designation / Position{reqMark}</Label>
                    <Input id="repPosition" name="repPosition" type="text" placeholder="e.g. HR Manager" className={inputClass} onChange={() => { if (errors.repPosition) setErrors((prev) => ({ ...prev, repPosition: undefined })); }} />
                    {errors.repPosition && <p className="text-danger text-xs mt-1">{errors.repPosition}</p>}
                  </div>
                  <div>
                    <Label htmlFor="repBirthdate" className={labelClass}>Birthday{reqMark}</Label>
                    <Input id="repBirthdate" name="repBirthdate" type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass} onChange={() => { if (errors.repBirthdate) setErrors((prev) => ({ ...prev, repBirthdate: undefined })); }} />
                    {errors.repBirthdate && <p className="text-danger text-xs mt-1">{errors.repBirthdate}</p>}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="repMobile" className={labelClass}>Representative Mobile{reqMark}</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">+63</span>
                      <Input id="repMobile" name="repMobile" type="tel" inputMode="numeric" maxLength={10} placeholder="917 123 4567" className={`${inputClass} pl-12`} onBlur={(e) => { e.target.value = toLocalDigits(e.target.value); }} onChange={() => { if (errors.repMobile) setErrors((prev) => ({ ...prev, repMobile: undefined })); }} />
                    </div>
                    {errors.repMobile && <p className="text-danger text-xs mt-1">{errors.repMobile}</p>}
                  </div>
                  <div>
                    <Label htmlFor="repEmail" className={labelClass}>Representative Email{reqMark}</Label>
                    <Input id="repEmail" name="repEmail" type="email" placeholder="maria@company.com" className={inputClass} onChange={() => { if (errors.repEmail) setErrors((prev) => ({ ...prev, repEmail: undefined })); }} />
                    {errors.repEmail && <p className="text-danger text-xs mt-1">{errors.repEmail}</p>}
                  </div>
                </div>
              </div>
            </section>
  );
}

export default EmployerRepresentativeStep;
