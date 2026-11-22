import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

import { BULACAN_MUNICIPALITIES, INDUSTRIES, SANTA_MARIA_BARANGAYS } from "@/shared/constants";

import { PASSWORD_HINT } from "@/shared/utils/password";
import { formatPhoneDisplay, toLocalDigits } from "@/shared/utils/phone";
import FormSelect from "@/shared/components/FormSelect";
import PasswordRequirements from "@/shared/components/PasswordRequirements";

function EmployerCompanyStep({ errors, setErrors, inputClass, labelClass, reqMark, form, set }) {
  const password = form?.password ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  function field(name, value) {
    set?.(name, value);
    if (errors?.[name]) setErrors?.((prev) => ({ ...prev, [name]: undefined }));
  }
  return (
            <section className="surface p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 1 — Company Details</p>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="companyName" className={labelClass}>Company / Trade Name{reqMark}</Label>
                  <Input id="companyName" name="companyName" type="text" placeholder="e.g. Santa Maria Logistics Inc." value={form?.companyName ?? ""} className={inputClass} onChange={(e) => field("companyName", e.target.value)} />
                  {errors?.companyName && <p className="text-danger text-xs mt-1">{errors.companyName}</p>}
                </div>
                <div>
                  <Label htmlFor="industry" className={labelClass}>Company Industry{reqMark}</Label>
                  <FormSelect id="industry" name="industry" value={form?.industry ?? ""} className={inputClass} onChange={(e) => field("industry", e.target.value)}>
  <option value="">Select industry</option>
  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
</FormSelect>
                  {errors?.industry && <p className="text-danger text-xs mt-1">{errors.industry}</p>}
                </div>
                <div>
                  <Label htmlFor="houseNumberUnit" className={labelClass}>House / Building / Unit No. <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="houseNumberUnit" name="houseNumberUnit" type="text" placeholder="e.g. Unit 402 or Bldg 3" value={form?.houseNumberUnit ?? ""} className={inputClass} onChange={(e) => field("houseNumberUnit", e.target.value)} />
                </div>
                </div>
                <div>
                  <p className={labelClass}>Address Information</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="streetAddress" className={labelClass}>Street Address & Lot / Block{reqMark}</Label>
                      <Input id="streetAddress" name="streetAddress" type="text" placeholder="e.g. Norzagaray-Santa Maria Road" value={form?.streetAddress ?? ""} className={inputClass} onChange={(e) => field("streetAddress", e.target.value)} />
                      {errors?.streetAddress && <p className="text-danger text-xs mt-1">{errors.streetAddress}</p>}
                    </div>
                    <div>
                      <Label htmlFor="subdivisionBuilding" className={labelClass}>Subdivision / Village / Building Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input id="subdivisionBuilding" name="subdivisionBuilding" type="text" placeholder="e.g. Greenview Heights" value={form?.subdivisionBuilding ?? ""} className={inputClass} onChange={(e) => field("subdivisionBuilding", e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="barangayDistrict" className={labelClass}>Barangay / District <span className="text-danger">*</span></Label>
                      <FormSelect id="barangayDistrict" name="barangayDistrict" value={form?.barangayDistrict ?? ""} className={inputClass} onChange={(e) => field("barangayDistrict", e.target.value)}>
                        <option value="">Select barangay</option>
                        {SANTA_MARIA_BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </FormSelect>
                    </div>
                    <div>
                      <Label htmlFor="cityMunicipality" className={labelClass}>City / Municipality{reqMark}</Label>
                      <FormSelect id="cityMunicipality" name="cityMunicipality" value={form?.cityMunicipality ?? ""} className={inputClass} onChange={(e) => field("cityMunicipality", e.target.value)}>
                        <option value="">Select city / municipality</option>
                        {BULACAN_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </FormSelect>
                      {errors?.cityMunicipality && <p className="text-danger text-xs mt-1">{errors.cityMunicipality}</p>}
                    </div>
                    <div>
                      <Label htmlFor="provinceState" className={labelClass}>Province / State{reqMark}</Label>
                      <FormSelect id="provinceState" name="provinceState" value={form?.provinceState ?? ""} className={inputClass} onChange={(e) => field("provinceState", e.target.value)}>
                        <option value="">Select province</option>
                        <option value="Bulacan">Bulacan</option>
                      </FormSelect>
                      {errors?.provinceState && <p className="text-danger text-xs mt-1">{errors.provinceState}</p>}
                    </div>
                    <div>
                      <Label htmlFor="postalCode" className={labelClass}>Postal Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input id="postalCode" name="postalCode" type="text" inputMode="numeric" maxLength={4} placeholder="e.g. 3022" value={form?.postalCode ?? ""} className={inputClass} onChange={(e) => field("postalCode", e.target.value)} />
                      {errors?.postalCode && <p className="text-danger text-xs mt-1">{errors.postalCode}</p>}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contactNumber" className={labelClass}>Company Contact No.{reqMark}</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">+63</span>
                      <Input id="contactNumber" name="contactNumber" type="tel" inputMode="numeric" placeholder="902 021 5030" value={formatPhoneDisplay(form?.contactNumber)} className={`${inputClass} pl-12`} onChange={(e) => field("contactNumber", toLocalDigits(e.target.value))} />
                    </div>
                    {errors?.contactNumber && <p className="text-danger text-xs mt-1">{errors.contactNumber}</p>}
                  </div>
                  <div>
                    <Label htmlFor="companyEmail" className={labelClass}>Official Company Email(Login Email){reqMark}</Label>
                    <Input id="companyEmail" name="companyEmail" type="email" placeholder="hr@company.com" value={form?.companyEmail ?? ""} className={inputClass} onChange={(e) => field("companyEmail", e.target.value)} />
                    {errors?.companyEmail && <p className="text-danger text-xs mt-1">{errors.companyEmail}</p>}
                  </div>
                </div>
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="password" className={labelClass}>Password{reqMark}</Label>
                    <div className="relative">
                      <Input id="password" name="password" type={showPassword ? "text" : "password"} placeholder={PASSWORD_HINT} value={password} className={`${inputClass} pr-10`} onChange={(e) => field("password", e.target.value)} />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>
                        {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                      </button>
                    </div>
                    <PasswordRequirements value={password} />
                    {errors?.password && <p className="text-danger text-xs mt-1">{errors.password}</p>}
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className={labelClass}>Confirm Password{reqMark}</Label>
                    <div className="relative">
                      <Input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Re-enter password" value={form?.confirmPassword ?? ""} className={`${inputClass} pr-10`} onChange={(e) => field("confirmPassword", e.target.value)} />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showConfirmPassword ? "Hide password" : "Show password"} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((v) => !v)}>
                        {showConfirmPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                      </button>
                    </div>
                    {errors?.confirmPassword && <p className="text-danger text-xs mt-1">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>
            </section>
  );
}

export default EmployerCompanyStep;