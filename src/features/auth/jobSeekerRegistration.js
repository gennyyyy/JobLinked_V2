import { normalizePhone, isValidPhone } from "@/shared/utils/phone";

export const EDUCATION_LEVELS = ["Elementary", "High School", "Senior High School", "Vocational", "College", "Post-Graduate"];
export const MAX_PDF_SIZE = 2 * 1024 * 1024;
export const MAX_RESUME_SIZE = 5 * 1024 * 1024;

export const EMPTY_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  birthdate: "",
  mobileNumber: "",
  email: "",
  password: "",
  confirmPassword: "",
  lot: "",
  block: "",
  streetAddress: "",
  subdivisionBuilding: "",
  barangayDistrict: "",
  cityMunicipality: "",
  provinceState: "",
  postalCode: "",
  employmentStatus: "",
  skills: "",
  resumeReviewConfirmed: false,
  agree: false,
  confirmAccurate: false,
};

export function validate(values) {
  const e = {};
  if (!values.firstName?.trim()) e.firstName = "First name is required";
  if (!values.lastName?.trim()) e.lastName = "Last name is required";
  if (!values.email?.trim()) e.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) e.email = "Invalid email address";
  if (!values.mobileNumber?.trim()) e.mobileNumber = "Mobile number is required";
  else if (!isValidPhone(values.mobileNumber)) e.mobileNumber = "Enter a valid number (e.g. 917 123 4567)";
  if (!values.birthdate) e.birthdate = "Birthday is required";
  if (!values.streetAddress?.trim()) e.streetAddress = "Street address is required";
  if (!values.cityMunicipality?.trim()) e.cityMunicipality = "City / Municipality is required";
  if (!values.provinceState?.trim()) e.provinceState = "Province is required";
  if (values.postalCode?.trim() && !/^\d{4}$/.test(values.postalCode.trim())) e.postalCode = "Postal code must be 4 digits";
  if (!values.password) e.password = "Password is required";
  else if (values.password.length < 8) e.password = "Password must be at least 8 characters";
  if (!values.confirmPassword) e.confirmPassword = "Please confirm your password";
  else if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match";
  if (!values.employmentStatus) e.employmentStatus = "Employment status is required";
  if (!values.resumeReviewConfirmed) e.resumeReviewConfirmed = "Please confirm you will review the resume autofill information";
  if (!values.agree) e.agree = "You must agree to the terms";
  if (!values.confirmAccurate) e.confirmAccurate = "Please confirm your information is true and correct";
  return e;
}

// Education is optional; when started (level or school filled) both are
// required, and a non-studying entry needs a 4-digit graduation year.
export function validateEducation(edu) {
  if (!edu.level.trim() && !edu.school.trim()) return "";
  if (!edu.level.trim() || !edu.school.trim()) return "Please select a level and enter a school name.";
  if (!edu.studying && !/^\d{4}$/.test(edu.year.trim())) return "Graduation year must be a 4-digit year.";
  return "";
}

export function buildJobSeekerSignUpPayload(form, education) {
  return {
    email: form.email.trim(),
    password: form.password,
    role: "job-seeker",
    firstName: form.firstName.trim(),
    middleName: form.middleName?.trim() || "",
    lastName: form.lastName.trim(),
    suffix: form.suffix?.trim() || "",
    extra: {
      phone: normalizePhone(form.mobileNumber),
      birthdate: form.birthdate,
      lot: form.lot.trim(),
      block: form.block.trim(),
      streetAddress: form.streetAddress.trim(),
      subdivisionBuilding: form.subdivisionBuilding?.trim() || "",
      barangayDistrict: form.barangayDistrict?.trim() || "",
      cityMunicipality: form.cityMunicipality.trim(),
      provinceState: form.provinceState.trim(),
      postalCode: form.postalCode?.trim() || "",
      country: "Philippines",
      employmentStatus: form.employmentStatus || "",
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      education: education.level.trim() && education.school.trim() ? {
        level: education.level.trim(),
        school: education.school.trim(),
        field: education.field.trim() || null,
        end_year: education.studying ? null : Number(education.year.trim()),
      } : null,
    },
  };
}
