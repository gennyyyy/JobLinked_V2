import { normalizePhone, isValidPhone } from "@/shared/utils/phone";

export function validate(values) {
  const e = {};
  if (!values.companyName?.trim()) e.companyName = "Company name is required";
  if (!values.industry?.trim()) e.industry = "Industry is required";
  if (!values.streetAddress?.trim()) e.streetAddress = "Street address is required";
  if (!values.cityMunicipality?.trim()) e.cityMunicipality = "City / Municipality is required";
  if (!values.provinceState?.trim()) e.provinceState = "Province is required";
  if (values.postalCode?.trim() && !/^\d{4}$/.test(values.postalCode.trim())) e.postalCode = "Postal code must be 4 digits";
  if (!values.contactNumber?.trim()) e.contactNumber = "Contact number is required";
  else if (!isValidPhone(values.contactNumber)) e.contactNumber = "Enter a valid number (e.g. 44 000 0000)";
  if (!values.companyEmail?.trim()) e.companyEmail = "Company email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.companyEmail)) e.companyEmail = "Invalid email address";
  if (!values.repFirstName?.trim()) e.repFirstName = "First name is required";
  if (!values.repLastName?.trim()) e.repLastName = "Last name is required";
  if (!values.repPosition?.trim()) e.repPosition = "Position is required";
  if (!values.repEmail?.trim()) e.repEmail = "Representative email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.repEmail)) e.repEmail = "Invalid email address";
  if (!values.repMobile?.trim()) e.repMobile = "Representative mobile is required";
  else if (!isValidPhone(values.repMobile)) e.repMobile = "Enter a valid number (e.g. 917 123 4567)";
  if (!values.repBirthdate) e.repBirthdate = "Birthday is required";
  if (!values.password) e.password = "Password is required";
  else if (values.password.length < 8) e.password = "Password must be at least 8 characters";
  if (!values.confirmPassword) e.confirmPassword = "Please confirm your password";
  else if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match";
  if (!values.agree) e.agree = "You must agree to the terms";
  return e;
}

export function buildEmployerSignUpPayload(values) {
  return {
    email: values.companyEmail.trim(),
    password: values.password,
    role: "employer",
    firstName: values.repFirstName.trim(),
    middleName: values.repMiddleName?.trim() || "",
    lastName: values.repLastName.trim(),
    suffix: values.repSuffix?.trim() || "",
    extra: {
      phone: normalizePhone(values.repMobile),
      birthdate: values.repBirthdate,
      companyName: values.companyName.trim(),
      industry: values.industry.trim(),
      companyEmail: values.companyEmail.trim(),
      representativeEmail: values.repEmail.trim(),
      representativePosition: values.repPosition.trim(),
      houseNumberUnit: values.houseNumberUnit?.trim() || "",
      streetAddress: values.streetAddress.trim(),
      subdivisionBuilding: values.subdivisionBuilding?.trim() || "",
      barangayDistrict: values.barangayDistrict?.trim() || "",
      cityMunicipality: values.cityMunicipality.trim(),
      provinceState: values.provinceState.trim(),
      postalCode: values.postalCode?.trim() || "",
      country: "Philippines",
    },
  };
}
