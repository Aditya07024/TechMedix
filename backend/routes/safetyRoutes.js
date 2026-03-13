import express from "express";
import { runSafetyAgent } from "../agents/safetyAgent.js";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import { analyzeInteractionAI } from "../services/aiInteractionAnalyzer.js";

const router = express.Router();

// POST /api/prescriptions/:prescriptionId/safety-check
router.post(
  "/prescriptions/:prescriptionId/safety-check",
  authenticate,
  authorizeRoles("patient", "doctor"),
  async (req, res) => {
    try {
      const { prescriptionId } = req.params;
      const candidateRaw =
        req.body?.candidate_medicine || req.body?.candidateMedicine || req.body?.medicine || null;

      if (!prescriptionId) {
        return res.status(400).json({ success: false, error: "prescriptionId missing" });
      }

      // Verify prescription ownership (patients can only check their own)
      const rows = await sql`
        SELECT user_id_int, user_id
        FROM prescriptions
        WHERE id = ${prescriptionId}
      `;

      if (!rows.length) {
        return res.status(404).json({ success: false, error: "Prescription not found" });
      }

      const ownerId = rows[0].user_id_int ?? rows[0].user_id;
      if (req.user.role === "patient" && String(req.user.id) !== String(ownerId)) {
        return res.status(403).json({
          success: false,
          error: "You can only run safety check for your own prescription",
        });
      }

      // If a candidate medicine is provided, compare it against each prescribed medicine
      if (candidateRaw && String(candidateRaw).trim().length > 0) {
        const candidate = String(candidateRaw).trim();

        // Load current prescription medicines
        const meds = await sql`
          SELECT medicine_name
          FROM prescription_medicines
          WHERE prescription_id = ${prescriptionId}
        `;

        const warnings = [];

        for (const row of meds) {
          const a = row.medicine_name;
          const b = candidate;

          // 1) Check DB for known interactions (drug_interactions)
          const db = await sql`
            SELECT *
            FROM drug_interactions
            WHERE (
              LOWER(medicine_a) = LOWER(${a}) AND LOWER(medicine_b) = LOWER(${b})
            ) OR (
              LOWER(medicine_a) = LOWER(${b}) AND LOWER(medicine_b) = LOWER(${a})
            )
            LIMIT 1
          `;

          if (db.length) {
            const i = db[0];
            warnings.push({
              type: "interaction",
              severity: i.severity,
              medicine_1: i.medicine_a,
              medicine_2: i.medicine_b,
              description: i.description,
              mechanism: i.mechanism,
              recommendation: i.recommendation,
              source: i.source || "database",
              confidence: 1.0,
            });
            continue;
          }

          // 2) AI fallback
          try {
            const ai = await analyzeInteractionAI(a, b);
            if (ai?.interaction_found) {
              // Optimistically cache into DB to learn over time
              await sql`
                INSERT INTO drug_interactions (
                  medicine_a, medicine_b, severity, description, mechanism, recommendation, source
                )
                VALUES (
                  ${a}, ${b}, ${ai.severity}, ${ai.description}, ${ai.mechanism}, ${ai.recommendation}, 'ai'
                )
                ON CONFLICT DO NOTHING
              `;

              warnings.push({
                type: "interaction",
                severity: ai.severity,
                medicine_1: a,
                medicine_2: b,
                description: ai.description,
                mechanism: ai.mechanism,
                recommendation: ai.recommendation,
                source: "ai",
                confidence: ai.confidence ?? 0.8,
              });
            }
          } catch (e) {
            // best-effort; do not fail entire request
            console.warn("AI compare failed:", e.message);
          }
        }

        const riskLevel = warnings.some((w) => w.severity === "critical")
          ? "critical"
          : warnings.some((w) => w.severity === "high")
          ? "high"
          : warnings.length > 0
          ? "medium"
          : "safe";

        return res.json({
          success: true,
          data: {
            prescription_id: prescriptionId,
            candidate_medicine: candidate,
            warnings,
            risk_level: riskLevel,
            safe_to_proceed: riskLevel === "safe",
          },
        });
      }

      // Default behavior: run full safety agent for the prescription
      const userId = req.user.id;
      const report = await runSafetyAgent({ prescriptionId, userId });
      return res.json({ success: true, data: report });
    } catch (err) {
      console.error("❌ Safety check failed:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// Fallback: compare candidate medicine against the latest prescription of a user
router.post(
  "/prescriptions/safety-check-latest",
  authenticate,
  authorizeRoles("patient", "doctor"),
  async (req, res) => {
    try {
      const candidateRaw =
        req.body?.candidate_medicine || req.body?.candidateMedicine || req.body?.medicine || null;
      if (!candidateRaw || String(candidateRaw).trim().length === 0) {
        return res.status(400).json({ success: false, error: "candidate_medicine is required" });
      }

      let patientId = null;
      if (req.user.role === "patient") {
        patientId = req.user.id;
      } else if (req.user.role === "doctor") {
        patientId = req.body?.patientId;
        if (!patientId) {
          return res.status(400).json({ success: false, error: "patientId required for doctor role" });
        }
      }

      const pres = await sql`
        SELECT id
        FROM prescriptions
        WHERE user_id = ${patientId}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!pres.length) {
        return res.status(404).json({ success: false, error: "No prescriptions found" });
      }

      const prescriptionId = pres[0].id;
      const candidate = String(candidateRaw).trim();

      // Load current prescription medicines
      const meds = await sql`
        SELECT medicine_name
        FROM prescription_medicines
        WHERE prescription_id = ${prescriptionId}
      `;

      const warnings = [];
      for (const row of meds) {
        const a = row.medicine_name;
        const b = candidate;

        const db = await sql`
          SELECT *
          FROM drug_interactions
          WHERE (
            LOWER(medicine_a) = LOWER(${a}) AND LOWER(medicine_b) = LOWER(${b})
          ) OR (
            LOWER(medicine_a) = LOWER(${b}) AND LOWER(medicine_b) = LOWER(${a})
          )
          LIMIT 1
        `;

        if (db.length) {
          const i = db[0];
          warnings.push({
            type: "interaction",
            severity: i.severity,
            medicine_1: i.medicine_a,
            medicine_2: i.medicine_b,
            description: i.description,
            mechanism: i.mechanism,
            recommendation: i.recommendation,
            source: i.source || "database",
            confidence: 1.0,
          });
          continue;
        }

        try {
          const ai = await analyzeInteractionAI(a, b);
          if (ai?.interaction_found) {
            await sql`
              INSERT INTO drug_interactions (
                medicine_a, medicine_b, severity, description, mechanism, recommendation, source
              )
              VALUES (
                ${a}, ${b}, ${ai.severity}, ${ai.description}, ${ai.mechanism}, ${ai.recommendation}, 'ai'
              )
              ON CONFLICT DO NOTHING
            `;

            warnings.push({
              type: "interaction",
              severity: ai.severity,
              medicine_1: a,
              medicine_2: b,
              description: ai.description,
              mechanism: ai.mechanism,
              recommendation: ai.recommendation,
              source: "ai",
              confidence: ai.confidence ?? 0.8,
            });
          }
        } catch (e) {
          console.warn("AI compare failed:", e.message);
        }
      }

      const riskLevel = warnings.some((w) => w.severity === "critical")
        ? "critical"
        : warnings.some((w) => w.severity === "high")
        ? "high"
        : warnings.length > 0
        ? "medium"
        : "safe";

      return res.json({
        success: true,
        data: {
          prescription_id: prescriptionId,
          candidate_medicine: candidate,
          warnings,
          risk_level: riskLevel,
          safe_to_proceed: riskLevel === "safe",
        },
      });
    } catch (err) {
      console.error("❌ Latest safety check failed:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// router.post(
//   "/prescriptions/:prescriptionId/safety-check",
//   async (req, res) => {
//     console.log("🧪 DEBUG HEADERS:", req.headers);
//     console.log("🧪 DEBUG BODY:", req.body);

//     try {
//       const { prescriptionId } = req.params;
//       const userId = req.body?.userId;

//       if (!prescriptionId || !userId) {
//         return res.status(400).json({
//           success: false,
//           error: "prescriptionId or userId missing",
//           debugBody: req.body,
//         });
//       }

//       const report = await runSafetyAgent({
//         prescriptionId,
//         userId,
//       });

//       res.json({ success: true, data: report });
//     } catch (err) {
//       console.error("❌ Safety check failed:", err);
//       res.status(500).json({
//         success: false,
//         error: err.message,
//       });
//     }
//   }
// );
export default router;
