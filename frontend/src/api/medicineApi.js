import api from "./api";

export const searchMedicines = async (query) => {
  const res = await api.get("/medicines/search", {
    params: { q: query || "" },
  });
  return res.data;
};
