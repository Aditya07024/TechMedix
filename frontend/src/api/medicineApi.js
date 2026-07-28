import api from "./api";

export async function getMedicines(params = {}) {
  const response = await api.get("/medicines", { params });
  return response.data;
}

const medicineCache = new Map();

export async function getMedicineById(id) {
  const cacheKey = JSON.stringify(["medicine", id]);
  if (medicineCache.has(cacheKey)) {
    return medicineCache.get(cacheKey);
  }
  const promise = api.get(`/medicines/${id}`)
    .then((response) => response.data)
    .catch((error) => {
      medicineCache.delete(cacheKey);
      throw error;
    });
  medicineCache.set(cacheKey, promise);
  return promise;
}

export async function searchMedicines(query) {
  const response = await api.get("/medicines/search", {
    params: { q: query || "" },
  });
  return response.data;
}

export async function lookupMedicineWithAi(query) {
  const response = await api.get("/medicines/ai-lookup", {
    params: { q: query || "" },
  });
  return response.data;
}

export async function getMedicineFilters() {
  const response = await api.get("/medicines/filters");
  return response.data;
}

export async function getPriceInsights(name) {
  const response = await api.get(
    `/medicines/${encodeURIComponent(name)}/price-insights`,
  );
  return response.data;
}
