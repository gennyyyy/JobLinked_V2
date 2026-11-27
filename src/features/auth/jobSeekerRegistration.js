import { normalizePhone, isValidPhone } from "@/shared/utils/phone";
import { passwordError } from "@/shared/utils/password";
import { FIXED_MUNICIPALITY, FIXED_POSTAL_CODE, FIXED_PROVINCE } from "@/shared/constants";

export const EDUCATION_LEVELS = ["Elementary", "High School", "Senior High School", "Vocational", "College", "Post-Graduate"];

export const EMPTY_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  birthdate: "",
  nationality: "Filipino",
  mobileNumber: "",
  email: "",
  password: "",
  confirmPassword: "",
  lot: "",
  block: "",
  streetAddress: "",
  subdivisionBuilding: "",
  barangayDistrict: "",
  cityMunicipality: FIXED_MUNICIPALITY, provinceState: FIXED_PROVINCE,
  postalCode: FIXED_POSTAL_CODE,
  employmentStatus: "",
  field: "",
  skills: [],
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
  if (!values.nationality?.trim()) e.nationality = "Nationality is required";
  if (!values.streetAddress?.trim()) e.streetAddress = "Street address is required";
  if (!values.barangayDistrict?.trim()) e.barangayDistrict = "Barangay / District is required";
  if (!values.cityMunicipality?.trim()) e.cityMunicipality = "City / Municipality is required";
  if (!values.provinceState?.trim()) e.provinceState = "Province is required";
  const passwordIssue = passwordError(values.password);
  if (passwordIssue) e.password = passwordIssue;
  if (!values.confirmPassword) e.confirmPassword = "Please confirm your password";
  else if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match";
  if (!values.employmentStatus) e.employmentStatus = "Employment status is required";
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
    termsAccepted: form.agree === true,
    extra: {
      phone: normalizePhone(form.mobileNumber),
      birthdate: form.birthdate,
      nationality: form.nationality.trim(),
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
      field: form.field || null,
      skills: form.skills,
      education: education.level.trim() && education.school.trim() ? {
        level: education.level.trim(),
        school: education.school.trim(),
        field: education.field.trim() || null,
        end_year: education.studying ? null : Number(education.year.trim()),
      } : null,
    },
  };
}
