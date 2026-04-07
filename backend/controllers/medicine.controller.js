import {
  getMedicineByIdFromDb,
  getMedicineFiltersFromDb,
  getMedicinesFromDb,
  getMedicineSideEffectsFromDb,
  getMedicineSubstitutesFromDb,
  getMedicineUsesFromDb,
  searchMedicinesInDb,
} from "../services/medicineDbFallbackService.js";
import { lookupMedicineWithAi } from "../services/aiMedicineLookupService.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function sendServerError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
}

function parsePagination(query) {
  const rawPage = query.page ?? DEFAULT_PAGE;
  const rawLimit = query.limit ?? DEFAULT_LIMIT;

  const page = Number.parseInt(rawPage, 10);
  const limit = Number.parseInt(rawLimit, 10);

  if (!Number.isInteger(page) || page < 1) {
    return { error: "Invalid page query parameter" };
  }

  if (!Number.isInteger(limit) || limit < 1) {
    return { error: "Invalid limit query parameter" };
  }

  return {
    page,
    limit: Math.min(limit, MAX_LIMIT),
  };
}

function parseMedicineId(value) {
  const id = Number.parseInt(value, 10);

  if (!Number.isInteger(id) || id < 1) {
    return null;
  }

  return id;
}

function parseBooleanFilter(value) {
  if (value === undefined) {
    return { hasValue: false, value: null };
  }

  if (typeof value === "boolean") {
    return { hasValue: true, value };
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes"].includes(normalized)) {
      return { hasValue: true, value: true };
    }

    if (["false", "0", "no"].includes(normalized)) {
      return { hasValue: true, value: false };
    }
  }

  return { hasValue: true, error: "Invalid habit_forming query parameter" };
}

export async function getMedicines(req, res) {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({
        success: false,
        message: pagination.error,
      });
    }

    const habitForming = parseBooleanFilter(req.query.habit_forming);
    if (habitForming.error) {
      return res.status(400).json({
        success: false,
        message: habitForming.error,
      });
    }

    const result = await getMedicinesFromDb({
      page: pagination.page,
      limit: pagination.limit,
      search: req.query.search?.trim() ?? "",
      saltSearch: req.query.salt_search?.trim() ?? "",
      chemicalClass: req.query.chemical_class?.trim() ?? "",
      therapeuticClass: req.query.therapeutic_class?.trim() ?? "",
      actionClass: req.query.action_class?.trim() ?? "",
      category: req.query.category?.trim() ?? "",
      habitForming: habitForming.hasValue ? habitForming.value : undefined,
    });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to fetch medicines");
  }
}

export async function getMedicineById(req, res) {
  try {
    const medicineId = parseMedicineId(req.params.id);
    if (!medicineId) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine id",
      });
    }

    const medicine = await getMedicineByIdFromDb(medicineId);
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    return res.json({
      success: true,
      data: medicine,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to fetch medicine details");
  }
}

export async function searchMedicines(req, res) {
  try {
    const query = req.query.q?.trim() ?? "";

    if (!query) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const medicines = await searchMedicinesInDb(query);

    return res.json({
      success: true,
      data: medicines,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to search medicines");
  }
}

export async function lookupMedicineWithAiFallback(req, res) {
  try {
    const query = req.query.q?.trim() ?? "";

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Missing medicine query",
      });
    }

    const medicine = await lookupMedicineWithAi(query);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found in dataset and AI lookup failed",
      });
    }

    return res.json({
      success: true,
      data: medicine,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to fetch AI medicine details");
  }
}

export async function getMedicineFilters(req, res) {
  try {
    const filters = await getMedicineFiltersFromDb();

    return res.json({
      success: true,
      data: filters,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to fetch medicine filters");
  }
}

export async function getMedicineSubstitutes(req, res) {
  try {
    const medicineId = parseMedicineId(req.params.id);
    if (!medicineId) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine id",
      });
    }

    const substitutes = await getMedicineSubstitutesFromDb(medicineId);
    if (substitutes === null) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    return res.json({
      success: true,
      data: substitutes,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to fetch medicine substitutes");
  }
}

export async function getMedicineSideEffects(req, res) {
  try {
    const medicineId = parseMedicineId(req.params.id);
    if (!medicineId) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine id",
      });
    }

    const sideEffects = await getMedicineSideEffectsFromDb(medicineId);
    if (sideEffects === null) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    return res.json({
      success: true,
      data: sideEffects,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to fetch medicine side effects");
  }
}

export async function getMedicineUses(req, res) {
  try {
    const medicineId = parseMedicineId(req.params.id);
    if (!medicineId) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine id",
      });
    }

    const uses = await getMedicineUsesFromDb(medicineId);
    if (uses === null) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    return res.json({
      success: true,
      data: uses,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to fetch medicine uses");
  }
}
