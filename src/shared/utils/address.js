export function formatFullAddress(address = {}) {
  const parts = [
    address.house_number_unit,
    address.street_address,
    address.subdivision_building,
    address.barangay_district,
    address.city_municipality,
    address.province_state,
    address.postal_code,
  ].filter(Boolean);
  return parts.length ? [...parts, address.country].filter(Boolean).join(", ") : "";
}
