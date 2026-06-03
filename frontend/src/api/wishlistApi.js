import api from "./api";

/**
 * Fetch the logged-in patient's wishlist from the backend.
 */
export async function getWishlist() {
  const response = await api.get("/wishlist");
  return response.data;
}

/**
 * Add a medicine to the wishlist.
 * @param {object} medicine - medicine object from the search results
 */
export async function addToWishlist(medicine) {
  const payload = {
    medicine_id: String(medicine.id ?? medicine._id ?? medicine.name),
    name: medicine.name ?? null,
    price: medicine.price ?? null,
    category: medicine.category ?? null,
    manufacturer_name: medicine.manufacturer_name ?? null,
    image: medicine.image ?? null,
    salt: medicine.salt ?? null,
    therapeutic_class: medicine.therapeutic_class ?? null,
  };
  const response = await api.post("/wishlist", payload);
  return response.data;
}

/**
 * Remove a medicine from the wishlist by medicine_id.
 * @param {string|number} medicineId
 */
export async function removeFromWishlist(medicineId) {
  const response = await api.delete(`/wishlist/${medicineId}`);
  return response.data;
}
