import express from "express";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

// Auto-create wishlist table on first use
async function ensureWishlistTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS medicine_wishlist (
      id          SERIAL PRIMARY KEY,
      patient_id  UUID NOT NULL,
      medicine_id TEXT NOT NULL,
      name        TEXT,
      price       NUMERIC,
      category    TEXT,
      manufacturer_name TEXT,
      image       TEXT,
      salt        TEXT,
      therapeutic_class TEXT,
      added_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (patient_id, medicine_id)
    )
  `;
}

ensureWishlistTable().catch((err) =>
  console.error("Wishlist table migration error:", err)
);

// GET /api/wishlist  — fetch all wishlist items for the logged-in patient
router.get(
  "/",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const items = await sql`
        SELECT * FROM medicine_wishlist
        WHERE patient_id = ${req.user.id}
        ORDER BY added_at DESC
      `;
      res.json({ success: true, data: items });
    } catch (err) {
      console.error("Wishlist GET error:", err);
      res.status(500).json({ success: false, error: "Failed to fetch wishlist" });
    }
  }
);

// POST /api/wishlist  — add a medicine to the wishlist
router.post(
  "/",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const {
        medicine_id,
        name,
        price,
        category,
        manufacturer_name,
        image,
        salt,
        therapeutic_class,
      } = req.body;

      if (!medicine_id) {
        return res.status(400).json({ success: false, error: "medicine_id is required" });
      }

      const existing = await sql`
        SELECT id FROM medicine_wishlist
        WHERE patient_id = ${req.user.id} AND medicine_id = ${String(medicine_id)}
      `;

      if (existing.length > 0) {
        return res.json({ success: true, message: "Already in wishlist" });
      }

      const [item] = await sql`
        INSERT INTO medicine_wishlist
          (patient_id, medicine_id, name, price, category, manufacturer_name, image, salt, therapeutic_class)
        VALUES
          (${req.user.id}, ${String(medicine_id)}, ${name || null}, ${price ?? null},
           ${category || null}, ${manufacturer_name || null}, ${image || null},
           ${salt || null}, ${therapeutic_class || null})
        RETURNING *
      `;

      res.status(201).json({ success: true, data: item });
    } catch (err) {
      console.error("Wishlist POST error:", err);
      res.status(500).json({ success: false, error: "Failed to add to wishlist" });
    }
  }
);

// DELETE /api/wishlist/:medicine_id  — remove a medicine from the wishlist
router.delete(
  "/:medicine_id",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { medicine_id } = req.params;

      await sql`
        DELETE FROM medicine_wishlist
        WHERE patient_id = ${req.user.id} AND medicine_id = ${medicine_id}
      `;

      res.json({ success: true, message: "Removed from wishlist" });
    } catch (err) {
      console.error("Wishlist DELETE error:", err);
      res.status(500).json({ success: false, error: "Failed to remove from wishlist" });
    }
  }
);

export default router;
