import express from "express";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

// POST /api/support/tickets (Patient: Create a ticket)
router.post(
  "/tickets",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { subject, category, description } = req.body;
      if (!subject || !description) {
        return res.status(400).json({ error: "Subject and description are required" });
      }

      const ticket = await sql`
        INSERT INTO support_tickets (patient_id, subject, category, description, status)
        VALUES (${req.user.id}, ${subject}, ${category || 'wallet'}, ${description}, 'open')
        RETURNING *
      `;

      res.status(201).json({ success: true, ticket: ticket[0] });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET /api/support/tickets (Patient: Get own | Admin: Get all)
router.get(
  "/tickets",
  authenticate,
  async (req, res) => {
    try {
      if (req.user.role === "admin") {
        // Fetch all tickets with patient email/name details if possible
        const tickets = await sql`
          SELECT st.*, u.email as patient_email, u.name as patient_name
          FROM support_tickets st
          LEFT JOIN users u ON st.patient_id = u.id
          ORDER BY st.created_at DESC
        `;
        return res.json({ success: true, tickets });
      } else if (req.user.role === "patient") {
        const tickets = await sql`
          SELECT *
          FROM support_tickets
          WHERE patient_id = ${req.user.id}
          ORDER BY created_at DESC
        `;
        return res.json({ success: true, tickets });
      } else {
        return res.status(403).json({ error: "Access denied" });
      }
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// PUT /api/support/tickets/:ticketId/status (Admin: Update status)
router.put(
  "/tickets/:ticketId/status",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const updated = await sql`
        UPDATE support_tickets
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${ticketId}
        RETURNING *
      `;

      if (!updated.length) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      res.json({ success: true, ticket: updated[0] });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

export default router;
