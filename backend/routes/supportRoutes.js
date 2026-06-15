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
          SELECT st.*, p.email as patient_email, p.name as patient_name
          FROM support_tickets st
          LEFT JOIN patients p ON st.patient_id = p.id
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

      const tickets = await sql`
        SELECT * FROM support_tickets WHERE id = ${ticketId}
      `;

      if (!tickets.length) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const ticket = tickets[0];

      // If it is a withdrawal ticket in open state, and we are closing it (rejecting)
      if (ticket.category === 'withdrawal' && ticket.status === 'open' && status === 'closed') {
        const desc = ticket.description || "";
        const txIdMatch = desc.match(/Transaction ID:\s*([a-f0-9\-]{36})/i);
        if (txIdMatch && txIdMatch[1]) {
          const txId = txIdMatch[1];
          const txs = await sql`
            SELECT * FROM wallet_transactions WHERE id = ${txId} AND type = 'debit' AND source = 'withdrawal'
          `;
          if (txs.length) {
            const amount = Number(txs[0].amount);
            const patientId = ticket.patient_id;

            // Refund to wallet
            const wallet = await sql`
              UPDATE wallets
              SET balance = balance + ${amount}, updated_at = NOW()
              WHERE patient_id = ${patientId}
              RETURNING id
            `;

            if (wallet.length) {
              // Create credit transaction for refund
              await sql`
                INSERT INTO wallet_transactions (wallet_id, patient_id, type, amount, source, note)
                VALUES (${wallet[0].id}, ${patientId}, 'credit', ${amount}, 'refund', 'Refund: Withdrawal request rejected')
              `;
            }
          }
        }
      }

      const updated = await sql`
        UPDATE support_tickets
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${ticketId}
        RETURNING *
      `;

      res.json({ success: true, ticket: updated[0] });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

export default router;
