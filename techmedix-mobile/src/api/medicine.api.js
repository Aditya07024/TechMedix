import api from "./index";

export const medicineApi = {
  search: (query) =>
    api.get(`/api/medicine/search?q=${query}`),

  compare: (genericId, brandId) =>
    api.get(`/api/medicine/compare`, {
      params: { genericId, brandId },
    }),
};