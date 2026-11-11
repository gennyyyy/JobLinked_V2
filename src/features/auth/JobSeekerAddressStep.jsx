import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BULACAN_MUNICIPALITIES, SANTA_MARIA_BARANGAYS } from "@/shared/constants";
import FormSelect from "@/shared/components/FormSelect";

function JobSeekerAddressStep({ form, errors, set, inputClass, labelClass, reqMark }) {
  return (
            <section className="surface p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 2 — Address Information</p>
              <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="lot" className={labelClass}>Lot <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="lot" name="lot" type="text" placeholder="e.g. 12" value={form.lot} onChange={(e) => set("lot", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <Label htmlFor="block" className={labelClass}>Block <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="block" name="block" type="text" placeholder="e.g. 4" value={form.block} onChange={(e) => set("block", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <Label htmlFor="streetAddress" className={labelClass}>Street Address{reqMark}</Label>
                  <Input id="streetAddress" name="streetAddress" type="text" placeholder="e.g. Norzagaray-Santa Maria Road" value={form.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} className={inputClass} />
                  {errors.streetAddress && <p className="text-danger text-xs mt-1">{errors.streetAddress}</p>}
                </div>
                <div>
                  <Label htmlFor="subdivisionBuilding" className={labelClass}>Subdivision / Village / Building Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="subdivisionBuilding" name="subdivisionBuilding" type="text" placeholder="e.g. Greenview Heights" value={form.subdivisionBuilding} onChange={(e) => set("subdivisionBuilding", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <Label htmlFor="barangayDistrict" className={labelClass}>Barangay / District <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <FormSelect id="barangayDistrict" name="barangayDistrict" value={form.barangayDistrict} onChange={(e) => set("barangayDistrict", e.target.value)} className={inputClass}>
                    <option value="">Select barangay</option>
                    {form.barangayDistrict && !SANTA_MARIA_BARANGAYS.includes(form.barangayDistrict) && (
                      <option value={form.barangayDistrict}>{form.barangayDistrict}</option>
                    )}
                    {SANTA_MARIA_BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </FormSelect>
                </div>
                <div>
                  <Label htmlFor="cityMunicipality" className={labelClass}>City / Municipality{reqMark}</Label>
                  <FormSelect id="cityMunicipality" name="cityMunicipality" value={form.cityMunicipality} onChange={(e) => set("cityMunicipality", e.target.value)} className={inputClass}>
                    <option value="">Select city / municipality</option>
                    {BULACAN_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </FormSelect>
                  {errors.cityMunicipality && <p className="text-danger text-xs mt-1">{errors.cityMunicipality}</p>}
                </div>
                <div>
                  <Label htmlFor="provinceState" className={labelClass}>Province / State{reqMark}</Label>
                  <FormSelect id="provinceState" name="provinceState" value={form.provinceState} onChange={(e) => set("provinceState", e.target.value)} className={inputClass}>
                    <option value="">Select province</option>
                    <option value="Bulacan">Bulacan</option>
                  </FormSelect>
                  {errors.provinceState && <p className="text-danger text-xs mt-1">{errors.provinceState}</p>}
                </div>
                <div>
                  <Label htmlFor="postalCode" className={labelClass}>Postal Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="postalCode" name="postalCode" type="text" inputMode="numeric" maxLength={4} placeholder="e.g. 3022" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputClass} />
                  {errors.postalCode && <p className="text-danger text-xs mt-1">{errors.postalCode}</p>}
                </div>
              </div>
              </div>
            </section>
  );
}

export default JobSeekerAddressStep;
