import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VocabularyPicker from "@/shared/components/VocabularyPicker";
import TagField from "@/features/job-seeker/TagField";
import useVocabulary from "@/shared/hooks/useVocabulary";
import { EDUCATION_LEVELS } from "./jobSeekerRegistration";
import FormSelect from "@/shared/components/FormSelect";

function JobSeekerBackgroundStep({ form, errors, set, education, setEducation, eduError, setTermsOpen, termsRead, reqMark, unrecognizedSkills = [] }) {
  const skillVocabulary = useVocabulary('skill');
  return (
            <section className="surface p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Step 3 — Background & Consent</p>
              <div className="space-y-4">
              <div>
              <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase mb-4 font-semibold">Education History</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormSelect aria-label="Education level" id="educationLevel" value={education.level} onChange={(e) => setEducation({ ...education, level: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:border-primary/60 transition-all">

                  {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </FormSelect>
                <Input aria-label="School name" placeholder="School name" value={education.school} onChange={(e) => setEducation({ ...education, school: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-all" />
                <div className="flex gap-2 sm:col-span-2">
                  <Input aria-label="Course / field of study" placeholder="Course / field" value={education.field} onChange={(e) => setEducation({ ...education, field: e.target.value })} className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-all" />
                  <Input aria-label="Graduation year" placeholder="Year" inputMode="numeric" disabled={education.studying} value={education.year} onChange={(e) => setEducation({ ...education, year: e.target.value })} className="!w-40 px-3 py-2.5 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-all disabled:opacity-50" />
                </div>
              </div>
              <Label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                <input type="checkbox" checked={education.studying} onChange={(e) => setEducation({ ...education, studying: e.target.checked })} className="size-4 shrink-0 accent-primary" />
                Currently studying here
              </Label>
              {eduError && <p className="mt-2 text-xs text-danger">{eduError}</p>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
              <div>
              <VocabularyPicker
                id="job-field"
                label="Field"
                category="job_field"
                multiple={false}
                value={form.field}
                onChange={(v) => set("field", v)}
                help="Your main line of work. Optional."
              />
              </div>

              <div>
              <TagField
                label="Skills"
                value={form.skills}
                onChange={(v) => set("skills", v)}
                suggestions={skillVocabulary.values}
                placeholder="Type a skill and press Enter"
                help="Pick the skills employers should match you on. Optional."
              />
              {skillVocabulary.loading && <p role="status" className="text-xs text-muted-foreground">Loading skills…</p>}
              {skillVocabulary.error && (
                <p role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                  <span>{skillVocabulary.error}</span>
                </p>
              )}
              {unrecognizedSkills.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Unrecognized skills: {unrecognizedSkills.join(", ")}. They are not in PESO’s list, so they are not saved.
                </p>
              )}
              </div>
              </div>

              <div>
              <div className="space-y-3">
                <div>
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground pt-2">
                  <input id="agree" type="checkbox" name="agree" checked={form.agree} disabled={!termsRead} onChange={(e) => set("agree", e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary disabled:opacity-50 disabled:cursor-not-allowed" />
                  <div>
                    <Label htmlFor="agree" className={!termsRead ? "cursor-not-allowed opacity-70" : "cursor-pointer"}>I agree to the municipal data collection terms and PESO privacy policies.{reqMark}</Label>
                    <button type="button" onClick={() => setTermsOpen(true)} className="ml-1 text-xs leading-4 text-primary hover:underline underline-offset-4">View terms</button>
                    {!termsRead && <p className="mt-1 text-muted-foreground">Please open and read the terms before agreeing.</p>}
                  </div>
                </div>
                {errors.agree && <p className="text-danger text-xs mt-1">{errors.agree}</p>}
                </div>

                <div>
                <Label className="flex items-start gap-2.5 text-xs text-muted-foreground select-none cursor-pointer">
                  <input type="checkbox" id="confirmAccurate" name="confirmAccurate" checked={form.confirmAccurate} onChange={(e) => set("confirmAccurate", e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
                  <span>I confirm that all the information I provided is true and correct to the best of my knowledge.{reqMark}</span>
                </Label>
                {errors.confirmAccurate && <p className="text-danger text-xs mt-1">{errors.confirmAccurate}</p>}
                </div>
              </div>
              </div>
              </div>
            </section>
  );
}

export default JobSeekerBackgroundStep;
