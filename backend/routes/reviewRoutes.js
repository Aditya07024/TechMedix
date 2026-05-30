import express from "express";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

// POST /api/reviews (Patient: Submit review)
router.post(
  "/",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { doctor_id, appointment_id, rating, comment } = req.body;

      if (!doctor_id || !rating) {
        return res.status(400).json({ error: "Doctor ID and rating are required" });
      }

      const parsedRating = parseInt(rating);
      if (parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5 stars" });
      }

      // Check if appointment is completed/visited
      if (appointment_id) {
        const appts = await sql`
          SELECT * FROM appointments
          WHERE id = ${appointment_id} AND patient_id = ${req.user.id} AND status IN ('completed', 'visited')
        `;
        if (!appts.length) {
          return res.status(400).json({ error: "No completed or visited appointment found for this review." });
        }

        // Check if already reviewed
        const existing = await sql`
          SELECT * FROM doctor_reviews
          WHERE appointment_id = ${appointment_id}
        `;
        if (existing.length) {
          return res.status(400).json({ error: "You have already reviewed this appointment." });
        }
      }

      const review = await sql`
        INSERT INTO doctor_reviews (doctor_id, patient_id, appointment_id, rating, comment)
        VALUES (${doctor_id}, ${req.user.id}, ${appointment_id || null}, ${parsedRating}, ${comment || null})
        RETURNING *
      `;

      res.status(201).json({ success: true, review: review[0] });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET /api/reviews/doctor/:doctorId (Public/Patient: Get reviews for a doctor)
router.get(
  "/doctor/:doctorId",
  async (req, res) => {
    try {
      const { doctorId } = req.params;

      const reviews = await sql`
        SELECT dr.*, u.name as patient_name
        FROM doctor_reviews dr
        LEFT JOIN users u ON dr.patient_id = u.id
        WHERE dr.doctor_id = ${doctorId}
        ORDER BY dr.created_at DESC
      `;

      const avgResult = await sql`
        SELECT AVG(rating)::numeric as average, COUNT(*)::numeric as count
        FROM doctor_reviews
        WHERE doctor_id = ${doctorId}
      `;

      const average = avgResult[0]?.average ? parseFloat(avgResult[0].average).toFixed(1) : "0.0";
      const count = avgResult[0]?.count ? parseInt(avgResult[0].count) : 0;

      res.json({
        success: true,
        average,
        count,
        reviews
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET /api/reviews/patient (Patient: Get own reviews)
router.get(
  "/patient",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const reviews = await sql`
        SELECT dr.*, d.name as doctor_name, d.specialty as doctor_specialty
        FROM doctor_reviews dr
        LEFT JOIN doctors d ON dr.doctor_id = d.id
        WHERE dr.patient_id = ${req.user.id}
        ORDER BY dr.created_at DESC
      `;
      res.json({ success: true, reviews });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

export default router;
