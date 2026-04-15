import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import cloudinary from "../config/cloudinary.js";
import { createHealthWalletDocument } from "../models-pg/healthWalletDocument.js";
import {
  generateQueueToken,
  getLimitedPatientProfile,
  getLiveQueue,
  getOverviewStats,
  getPatientReports,
  getStaffActivity,
  getStaffPerformance,
  getStaffProfile,
  getTodayAppointments,
  logStaffAction,
  markAppointmentArrived,
  savePatientReport,
  updateLimitedPatientProfile,
  updateQueueStatus,
} from "../services/staffService.js";
import {
  getStaffDoctors,
  staffHasDoctorAccess,
  switchStaffDoctor,
} from "../services/doctorStaffService.js";
import { createStaffDoctorRequest } from "../services/staffRequestService.js";

const router = express.Router();
const reportsDir = path.resolve("uploads/reports");

if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, reportsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`),
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.use(authenticate, authorizeRoles("staff", "admin"));

async function resolveStaffContext(req) {
  if (req.user.role !== "staff") {
    return { staffProfile: null, doctorId: req.query.doctor_id || req.body?.doctor_id || null };
  }

  const staffProfile = await getStaffProfile(req.user.id);
  const requestedDoctorId = req.query.doctor_id || req.body?.doctor_id || null;

  if (!staffProfile) {
    throw new Error("Staff profile not found");
  }

  if (requestedDoctorId) {
    const hasAccess = await staffHasDoctorAccess(staffProfile.id, requestedDoctorId);
    if (!hasAccess) {
      throw new Error("Doctor context is not assigned to this staff member");
    }
    return { staffProfile, doctorId: requestedDoctorId };
  }

  let doctorId = staffProfile?.active_doctor_id || null;

  if (doctorId) {
    const hasAccess = await staffHasDoctorAccess(staffProfile.id, doctorId);
    if (hasAccess) {
      return { staffProfile, doctorId };
    }
  }

  const assignedDoctors = await getStaffDoctors(staffProfile.id);
  const fallbackDoctorId = assignedDoctors[0]?.id || null;

  if (fallbackDoctorId && fallbackDoctorId !== staffProfile?.active_doctor_id) {
    await switchStaffDoctor(staffProfile.id, fallbackDoctorId);
    staffProfile.active_doctor_id = fallbackDoctorId;
  }

  return { staffProfile, doctorId: fallbackDoctorId };
}

router.get("/overview", async (req, res) => {
  try {
    const { staffProfile, doctorId } = await resolveStaffContext(req);
    const stats = await getOverviewStats({
      hospitalId: staffProfile?.hospital_id || null,
      staffId: staffProfile?.id || null,
      doctorId,
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/doctors", async (req, res) => {
  try {
    const { staffProfile } = await resolveStaffContext(req);
    const doctors = await getStaffDoctors(staffProfile?.id || null);
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/appointments/today", async (req, res) => {
  try {
    const { staffProfile, doctorId } = await resolveStaffContext(req);
    const appointments = await getTodayAppointments({
      hospitalId: staffProfile?.hospital_id || null,
      doctorId,
      status: req.query.status || null,
    });

    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/appointments/:appointmentId/arrive", async (req, res) => {
  try {
    const { staffProfile } = await resolveStaffContext(req);
    const appointment = await markAppointmentArrived({
      appointmentId: req.params.appointmentId,
      staffId: staffProfile?.id || null,
    });

    await logStaffAction(
      staffProfile?.id || null,
      "appointment_marked_arrived",
      "appointment",
      appointment.id,
      { patient_id: appointment.patient_id, doctor_id: appointment.doctor_id },
    );

    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/queue/token", async (req, res) => {
  try {
    const { appointment_id } = req.body;
    const { staffProfile, doctorId } = await resolveStaffContext(req);

    if (!appointment_id) {
      return res.status(400).json({ success: false, error: "appointment_id is required" });
    }

    const queueEntry = await generateQueueToken({
      appointmentId: appointment_id,
      staffId: staffProfile?.id || null,
      hospitalId: staffProfile?.hospital_id || null,
      requiredDoctorId: doctorId,
    });

    await logStaffAction(
      staffProfile?.id || null,
      "queue_token_generated",
      "queue",
      queueEntry.id,
      { appointment_id, token_no: queueEntry.token_no, doctor_id: queueEntry.doctor_id },
    );

    const io = req.app.get("io");
    io?.to(`doctor-${queueEntry.doctor_id}`).emit("queue-update", {
      doctor_id: queueEntry.doctor_id,
      queue_id: queueEntry.id,
      appointment_id,
      token_no: queueEntry.token_no,
      status: queueEntry.status,
    });
    io?.to(`doctor-${queueEntry.doctor_id}`).emit("staff-queue-token-generated", {
      appointment_id,
      token_no: queueEntry.token_no,
      queue_id: queueEntry.id,
    });
    io?.to(`doctor-${queueEntry.doctor_id}`).emit("queue-update-requested", {
      doctor_id: queueEntry.doctor_id,
    });

    res.status(201).json({ success: true, data: queueEntry });
  } catch (error) {
    const code = String(error.message || "").includes("already exists") ? 409 : 400;
    res.status(code).json({ success: false, error: error.message });
  }
});

router.get("/queue/live", async (req, res) => {
  try {
    const { date } = req.query;
    const { staffProfile, doctorId } = await resolveStaffContext(req);
    if (!doctorId) {
      return res.status(400).json({ success: false, error: "doctor_id is required or staff must set an active doctor" });
    }

    const queue = await getLiveQueue({
      doctorId,
      date: date || undefined,
      hospitalId: staffProfile?.hospital_id || null,
    });

    res.json({ success: true, data: queue });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch("/queue/:queueId/status", async (req, res) => {
  try {
    const { status } = req.body;
    const { staffProfile } = await resolveStaffContext(req);

    const updated = await updateQueueStatus({
      queueId: req.params.queueId,
      status,
      staffId: staffProfile?.id || null,
    });

    await logStaffAction(
      staffProfile?.id || null,
      "queue_status_updated",
      "queue",
      updated.id,
      { status: updated.status, appointment_id: updated.appointment_id },
    );

    const io = req.app.get("io");
    io?.to(`doctor-${updated.doctor_id}`).emit("queue-update", {
      doctor_id: updated.doctor_id,
      queue_id: updated.id,
      appointment_id: updated.appointment_id,
      status: updated.status,
    });
    io?.to(`doctor-${updated.doctor_id}`).emit("staff-queue-status-updated", {
      queue_id: updated.id,
      appointment_id: updated.appointment_id,
      status: updated.status,
    });
    io?.to(`patient-${updated.patient_id}`).emit("queue-status-updated", {
      queue_id: updated.id,
      appointment_id: updated.appointment_id,
      status: updated.status,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/patients/:patientId", async (req, res) => {
  try {
    const patient = await getLimitedPatientProfile(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: "Patient not found" });
    }

    res.json({ success: true, data: patient });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch("/patients/:patientId", async (req, res) => {
  try {
    const { staffProfile } = await resolveStaffContext(req);
    const patient = await updateLimitedPatientProfile(req.params.patientId, req.body);

    await logStaffAction(
      staffProfile?.id || null,
      "patient_profile_updated",
      "patient",
      patient.id,
      {
        updated_fields: Object.keys(req.body || {}),
      },
    );

    res.json({ success: true, data: patient });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/reports", upload.single("report"), async (req, res) => {
  try {
    const { patient_id, appointment_id } = req.body;
    const { staffProfile } = await resolveStaffContext(req);

    if (!patient_id) {
      return res.status(400).json({ success: false, error: "patient_id is required" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Report file is required" });
    }

    const relativeFilePath = path
      .relative(process.cwd(), req.file.path)
      .replace(/\\/g, "/");
    let filePath = `/${relativeFilePath}`;
    let secureUrl = process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}${filePath}`
      : filePath;
    let publicId = null;
    let storageProvider = "local";

    const hasCloudinary =
      !!process.env.CLOUDINARY_CLOUD_NAME &&
      !!process.env.CLOUDINARY_API_KEY &&
      !!process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinary) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: process.env.CLOUDINARY_REPORTS_FOLDER || "techmedix/reports",
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
      });

      secureUrl = uploadResult.secure_url;
      publicId = uploadResult.public_id;
      storageProvider = "cloudinary";

      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }

    const report = await savePatientReport({
      patientId: patient_id,
      appointmentId: appointment_id || null,
      uploadedBy: req.user.id,
      filePath,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      secureUrl,
      publicId,
      storageProvider,
    });

    await createHealthWalletDocument({
      patient_id,
      public_id: publicId || `staff-report-${report.id}`,
      file_url: secureUrl,
      file_name: req.file.originalname,
      resource_type: req.file.mimetype?.startsWith("image/") ? "image" : "raw",
      format:
        path.extname(req.file.originalname).slice(1) ||
        req.file.mimetype?.split("/")[1] ||
        null,
      bytes: req.file.size,
      mime_type: req.file.mimetype,
    });

    await logStaffAction(
      staffProfile?.id || null,
      "report_uploaded",
      "report",
      String(report.id),
      { patient_id, appointment_id: appointment_id || null, storage_provider: storageProvider },
    );

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/patients/:patientId/reports", async (req, res) => {
  try {
    const reports = await getPatientReports(req.params.patientId);
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/notify-doctor", async (req, res) => {
  try {
    const { doctor_id, patient_id, appointment_id, message } = req.body;
    const { staffProfile, doctorId: activeDoctorId } = await resolveStaffContext(req);

    const effectiveDoctorId = doctor_id || activeDoctorId;

    if (!effectiveDoctorId || !patient_id) {
      return res.status(400).json({ success: false, error: "doctor_id and patient_id are required" });
    }

    const payload = {
      type: "patient_ready",
      doctor_id: effectiveDoctorId,
      patient_id,
      appointment_id: appointment_id || null,
      message: message || "Patient is ready for consultation",
      staff_name: staffProfile?.name || "Staff",
      created_at: new Date().toISOString(),
    };

    const io = req.app.get("io");
    io?.to(`doctor-${effectiveDoctorId}`).emit("staff-notify-doctor", payload);

    await logStaffAction(
      staffProfile?.id || null,
      "doctor_notified",
      "doctor",
      effectiveDoctorId,
      { patient_id, appointment_id: appointment_id || null },
    );

    res.json({ success: true, data: payload });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/request-doctor", async (req, res) => {
  try {
    const { staffProfile } = await resolveStaffContext(req);
    const request = await createStaffDoctorRequest({
      staffId: staffProfile?.id || null,
      doctorId: req.body?.doctor_id,
    });

    await logStaffAction(
      staffProfile?.id || null,
      "doctor_access_requested",
      "doctor",
      req.body?.doctor_id,
      { request_id: request.id },
    );

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/switch-doctor", async (req, res) => {
  try {
    const { staffProfile } = await resolveStaffContext(req);
    const result = await switchStaffDoctor(
      staffProfile?.id || null,
      req.body?.doctor_id,
    );

    await logStaffAction(
      staffProfile?.id || null,
      "active_doctor_switched",
      "doctor",
      req.body?.doctor_id,
      {},
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const { staffProfile } = await resolveStaffContext(req);
    const logs = await getStaffActivity({
      staffId: req.user.role === "staff" ? staffProfile?.id || null : req.query.staff_id || null,
      limit: Number(req.query.limit || 25),
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/performance", async (req, res) => {
  try {
    const { staffProfile, doctorId } = await resolveStaffContext(req);
    const performance = await getStaffPerformance({
      hospitalId: staffProfile?.hospital_id || null,
      doctorId,
    });

    res.json({ success: true, data: performance });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
