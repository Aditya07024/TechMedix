import express from "express";
import {
  getMedicineById,
  getMedicineFilters,
  getMedicines,
  getMedicineSideEffects,
  getMedicineSubstitutes,
  getMedicineUses,
  lookupMedicineWithAiFallback,
  searchMedicines,
} from "../controllers/medicine.controller.js";

const router = express.Router();

router.get("/medicines", getMedicines);
router.get("/medicines/search", searchMedicines);
router.get("/medicines/ai-lookup", lookupMedicineWithAiFallback);
router.get("/medicines/filters", getMedicineFilters);
router.get("/medicines/:id/substitutes", getMedicineSubstitutes);
router.get("/medicines/:id/side-effects", getMedicineSideEffects);
router.get("/medicines/:id/uses", getMedicineUses);
router.get("/medicines/:id", getMedicineById);

export default router;
