import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BULACAN_MUNICIPALITIES, SANTA_MARIA_BARANGAYS } from "@/shared/constants";
import { toLocalDigits } from "@/shared/utils/phone";
import FormSelect from "@/shared/components/FormSelect";

function EmployerCompanyStep({ errors, setErrors, inputClass, labelClass, reqMark }) {
  return (
            <section className="surface p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 1 — Company Details</p>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="companyName" className={labelClass}>Company / Trade Name{reqMark}</Label>
                  <Input id="companyName" name="companyName" type="text" placeholder="e.g. Santa Maria Logistics Inc." className={inputClass} onChange={() => { if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: undefined })); }} />
                  {errors.companyName && <p className="text-danger text-xs mt-1">{errors.companyName}</p>}
                </div>
                <div>
                  <Label htmlFor="industry" className={labelClass}>Company Industry{reqMark}</Label>
                  <Input id="industry" name="industry" type="text" placeholder="e.g. Manufacturing, IT, Retail" className={inputClass} onChange={() => { if (errors.industry) setErrors((prev) => ({ ...prev, industry: undefined })); }} />
                  {errors.industry && <p className="text-danger text-xs mt-1">{errors.industry}</p>}
                </div>
                </div>
                <div>
                  <p className={labelClass}>Address Information</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="houseNumberUnit" className={labelClass}>House / Building / Unit No. <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input id="houseNumberUnit" name="houseNumberUnit" type="text" placeholder="e.g. Unit 402 or Bldg 3" className={inputClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="streetAddress" className={labelClass}>Street Address & Lot / Block{reqMark}</Label>
                      <Input id="streetAddress" name="streetAddress" type="text" placeholder="e.g. Norzagaray-Santa Maria Road" className={inputClass} onChange={() => { if (errors.streetAddress) setErrors((prev) => ({ ...prev, streetAddress: undefined })); }} />
                      {errors.streetAddress && <p className="text-danger text-xs mt-1">{errors.streetAddress}</p>}
                    </div>
                    <div>
                      <Label htmlFor="subdivisionBuilding" className={labelClass}>Subdivision / Village / Building Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input id="subdivisionBuilding" name="subdivisionBuilding" type="text" placeholder="e.g. Greenview Heights" className={inputClass} />
                    </div>
                    <div>
                      <Label htmlFor="barangayDistrict" className={labelClass}>Barangay / District <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <FormSelect id="barangayDistrict" name="barangayDistrict" className={inputClass}>
                        <option value="">Select barangay</option>
                        {SANTA_MARIA_BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </FormSelect>
                    </div>
                    <div>
                      <Label htmlFor="cityMunicipality" className={labelClass}>City / Municipality{reqMark}</Label>
                      <FormSelect id="cityMunicipality" name="cityMunicipality" className={inputClass} onChange={() => { if (errors.cityMunicipality) setErrors((prev) => ({ ...prev, cityMunicipality: undefined })); }}>
                        <option value="">Select city / municipality</option>
                        {BULACAN_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </FormSelect>
                      {errors.cityMunicipality && <p className="text-danger text-xs mt-1">{errors.cityMunicipality}</p>}
                    </div>
                    <div>
                      <Label htmlFor="provinceState" className={labelClass}>Province / State{reqMark}</Label>
                      <FormSelect id="provinceState" name="provinceState" className={inputClass} onChange={() => { if (errors.provinceState) setErrors((prev) => ({ ...prev, provinceState: undefined })); }}>
                        <option value="">Select province</option>
                        <option value="Bulacan">Bulacan</option>
                      </FormSelect>
                      {errors.provinceState && <p className="text-danger text-xs mt-1">{errors.provinceState}</p>}
                    </div>
                    <div>
                      <Label htmlFor="postalCode" className={labelClass}>Postal Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input id="postalCode" name="postalCode" type="text" inputMode="numeric" maxLength={4} placeholder="e.g. 3022" className={inputClass} onChange={() => { if (errors.postalCode) setErrors((prev) => ({ ...prev, postalCode: undefined })); }} />
                      {errors.postalCode && <p className="text-danger text-xs mt-1">{errors.postalCode}</p>}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contactNumber" className={labelClass}>Company Contact No.{reqMark}</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">+63</span>
                      <Input id="contactNumber" name="contactNumber" type="tel" inputMode="numeric" maxLength={10} placeholder="44 000 0000" className={`${inputClass} pl-12`} onBlur={(e) => { e.target.value = toLocalDigits(e.target.value); }} onChange={() => { if (errors.contactNumber) setErrors((prev) => ({ ...prev, contactNumber: undefined })); }} />
                    </div>
                    {errors.contactNumber && <p className="text-danger text-xs mt-1">{errors.contactNumber}</p>}
                  </div>
                  <div>
                    <Label htmlFor="companyEmail" className={labelClass}>Official Company Email{reqMark}</Label>
                    <Input id="companyEmail" name="companyEmail" type="email" placeholder="hr@company.com" className={inputClass} onChange={() => { if (errors.companyEmail) setErrors((prev) => ({ ...prev, companyEmail: undefined })); }} />
                    {errors.companyEmail && <p className="text-danger text-xs mt-1">{errors.companyEmail}</p>}
                  </div>
                </div>
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="password" className={labelClass}>Password{reqMark}</Label>
                    <Input id="password" name="password" type="password" placeholder="Min. 8 characters" className={inputClass} onChange={() => { if (errors.password) setErrors((prev) => ({ ...prev, password: undefined })); }} />
                    {errors.password && <p className="text-danger text-xs mt-1">{errors.password}</p>}
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className={labelClass}>Confirm Password{reqMark}</Label>
                    <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Re-enter password" className={inputClass} onChange={() => { if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined })); }} />
                    {errors.confirmPassword && <p className="text-danger text-xs mt-1">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>
            </section>
  );
}

export default EmployerCompanyStep;
