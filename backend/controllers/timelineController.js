import { getPatientTimeline } from "../services/timelineService.js";

export async function getPatientMedicalTimeline(req, res) {
  try {
    const { patient_id } = req.params;
    const { filter_type, limit = 100, offset = 0 } = req.query;

    if (req.user?.id !== patient_id && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const timeline = await getPatientTimeline(
      patient_id,
      filter_type,
      limit,
      offset,
    );
    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}
