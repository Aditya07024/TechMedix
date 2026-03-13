import express from "express";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.post(
  "/branch",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { name, address, city, state, phone } = req.body;

      if (!name || !city || !state) {
        return res.status(400).json({
          error: "Name, city and state are required",
        });
      }

      const existing = await sql`
        SELECT id FROM branches WHERE LOWER(name) = LOWER(${name})
      `;

      if (existing.length) {
        return res.status(409).json({
          error: "Branch with this name already exists",
        });
      }

      const branch = await sql`
        INSERT INTO branches (name, address, city, state, phone)
        VALUES (${name}, ${address}, ${city}, ${state}, ${phone})
        RETURNING *
      `;

      console.log(`Admin ${req.user.id} created branch ${name}`);

      res.status(201).json(branch[0]);
    } catch (err) {
      console.error("Branch creation failed:", err);
      res.status(500).json({ error: "Branch creation failed" });
    }
  }
);

export default router;