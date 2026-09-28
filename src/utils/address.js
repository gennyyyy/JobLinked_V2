export function formatFullAddress(address = {}) {
  const parts = [
    address.house_number_unit || address.houseNumberUnit,
    address.street_address || address.streetAddress,
    address.subdivision_building || address.subdivisionBuilding,
    address.barangay_district || address.barangayDistrict,
    address.city_municipality || address.cityMunicipality,
    address.province_state || address.provinceState,
    address.postal_code || address.postalCode,
  ].filter(Boolean);
  return parts.length ? [...parts, address.country].filter(Boolean).join(", ") : "";
}
