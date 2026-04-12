import express from "express";
import { verifyDoctor, verifyStaff } from "../middleware/auth.js";
import {
  createStaffForDoctor,
  getDoctorStaff,
  resetDoctorStaffPassword,
  getStaffDoctors,
  removeDoctorStaffAccess,
  switchStaffDoctor,
} from "../services/doctorStaffService.js";
import {
  createStaffDoctorRequest,
  getDoctorStaffRequests,
  resolveStaffRequest,
} from "../services/staffRequestService.js";
import { getStaffProfile, logStaffAction } from "../services/staffService.js";

const router = express.Router();

router.post("/doctor/staff/create", ...verifyDoctor, async (req, res) => {
  try {
    const staff = await createStaffForDoctor({
      doctorId: req.user.doctor_id || req.user.id,
      ...req.body,
    });

    await logStaffAction(
      staff.id,
      "staff_created_by_doctor",
      "doctor",
      req.user.doctor_id || req.user.id,
      { created_staff_id: staff.id },
    );

    res.status(201).json({ success: true, data: staff });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/doctor/staff", ...verifyDoctor, async (req, res) => {
  try {
    const doctorId = req.user.doctor_id || req.user.id;
    const staff = await getDoctorStaff(doctorId);
    res.json({ success: true, data: staff });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/doctor/staff/requests", ...verifyDoctor, async (req, res) => {
  try {
    const doctorId = req.user.doctor_id || req.user.id;
    const requests = await getDoctorStaffRequests(doctorId);
    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch("/doctor/staff/request/:id", ...verifyDoctor, async (req, res) => {
  try {
    const status = req.body?.status;
    const doctorId = req.user.doctor_id || req.user.id;
    const request = await resolveStaffRequest({
      requestId: req.params.id,
      doctorId,
      status,
    });

    await logStaffAction(
      request.staff_id,
      `staff_request_${status}`,
      "doctor",
      doctorId,
      { request_id: request.id },
    );

    res.json({ success: true, data: request });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete("/doctor/staff/:staffId", ...verifyDoctor, async (req, res) => {
  try {
    const doctorId = req.user.doctor_id || req.user.id;
    const result = await removeDoctorStaffAccess(doctorId, req.params.staffId);

    await logStaffAction(
      req.params.staffId,
      "doctor_staff_access_removed",
      "doctor",
      doctorId,
      {},
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/doctor/staff/:staffId/reset-password", ...verifyDoctor, async (req, res) => {
  try {
    const doctorId = req.user.doctor_id || req.user.id;
    const result = await resetDoctorStaffPassword(doctorId, req.params.staffId);

    await logStaffAction(
      req.params.staffId,
      "doctor_staff_password_reset",
      "doctor",
      doctorId,
      {},
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/staff/doctors", ...verifyStaff, async (req, res) => {
  try {
    const staffProfile = await getStaffProfile(req.user.id);
    const doctors = await getStaffDoctors(staffProfile.id);
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/staff/request-doctor", ...verifyStaff, async (req, res) => {
  try {
    const staffProfile = await getStaffProfile(req.user.id);
    const request = await createStaffDoctorRequest({
      staffId: staffProfile.id,
      doctorId: req.body?.doctor_id,
    });

    await logStaffAction(
      staffProfile.id,
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

router.post("/staff/switch-doctor", ...verifyStaff, async (req, res) => {
  try {
    const staffProfile = await getStaffProfile(req.user.id);
    const result = await switchStaffDoctor(staffProfile.id, req.body?.doctor_id);

    await logStaffAction(
      staffProfile.id,
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

export default router;
