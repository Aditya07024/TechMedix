import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import axios from "axios";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = CASHFREE_SECRET_KEY?.includes("_prod_")
  ? "production"
  : (CASHFREE_SECRET_KEY?.includes("_test_") ? "sandbox" : (process.env.CASHFREE_ENV || "sandbox"));

const cashfreeBaseUrl = CASHFREE_ENV === "production"
  ? "https://api.cashfree.com/pg"
  : "https://sandbox.cashfree.com/pg";

const getCashfreeHeaders = () => ({
  "x-client-id": CASHFREE_APP_ID,
  "x-client-secret": CASHFREE_SECRET_KEY,
  "x-api-version": "2023-08-01",
  "Content-Type": "application/json"
});
import cloudinary from "../config/cloudinary.js";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

const uploadDir = "uploads/posters";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error("Only PNG, JPG, JPEG, and WEBP image files are allowed"));
      return;
    }
    cb(null, true);
  },
});



/**
 * POST /api/doctor-posters/upload
 * Doctors upload their cropped promotion banners.
 */
router.post(
  "/upload",
  authenticate,
  authorizeRoles("doctor"),
  upload.single("poster"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Poster image is required" });
      }

      const folder = process.env.CLOUDINARY_POSTERS_FOLDER || "techmedix/posters";

      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: "image",
        folder,
        use_filename: true,
        unique_filename: true,
      });

      // Cleanup local temp file
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupErr) {
        console.warn("Failed to delete temp file:", cleanupErr.message);
      }

      // Save pending promotion to Database
      const poster = await sql`
        INSERT INTO doctor_posters (
          doctor_id,
          image_url,
          cloudinary_public_id,
          amount,
          duration_days,
          status
        )
        VALUES (
          ${req.user.id},
          ${uploadResult.secure_url},
          ${uploadResult.public_id},
          30.00,
          30,
          'pending'
        )
        RETURNING *
      `;

      res.status(201).json({ success: true, data: poster[0] });
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      }
      console.error("Doctor poster upload failed:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/doctor-posters/pay
 * Initiate payment transaction for a pending poster.
 */
router.post(
  "/pay",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { poster_id } = req.body;
      if (!poster_id) {
        return res.status(400).json({ success: false, error: "poster_id is required" });
      }

      // Fetch pending poster
      const posters = await sql`
        SELECT * FROM doctor_posters
        WHERE id = ${poster_id} AND doctor_id = ${req.user.id}
      `;

      if (!posters.length) {
        return res.status(404).json({ success: false, error: "Poster not found" });
      }

      const poster = posters[0];
      if (poster.status === "active") {
        return res.status(400).json({ success: false, error: "Poster is already paid and active" });
      }

      const orderId = `cf_ord_pst_${poster.id.substring(0, 8)}_${Date.now()}`;
      
      const doctor = await sql`
        SELECT name, email, phone FROM doctors WHERE id = ${req.user.id}
      `;
      const customerEmail = doctor[0]?.email || "doctor@techmedix.com";
      const customerPhone = doctor[0]?.phone ? String(doctor[0].phone).replace(/\D/g, "").slice(-10) : "9999999999";
      const customerName = doctor[0]?.name || "Doctor";

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.slice(0, -1) : frontendUrl;
      const returnUrl = `${cleanFrontendUrl}/doctor/dashboard?payment_trigger=promotions&cf_order_id={order_id}&poster_id=${poster.id}`;

      const response = await axios.post(
        `${cashfreeBaseUrl}/orders`,
        {
          order_id: orderId,
          order_amount: Number(poster.amount),
          order_currency: "INR",
          customer_details: {
            customer_id: String(req.user.id),
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
          },
          order_meta: {
            return_url: returnUrl
          }
        },
        {
          headers: getCashfreeHeaders()
        }
      );

      const cashfreeOrder = response.data;

      // Save Cashfree order ID to Db
      await sql`
        UPDATE doctor_posters
        SET razorpay_order_id = ${cashfreeOrder.order_id}, updated_at = NOW()
        WHERE id = ${poster.id}
      `;

      res.json({
        success: true,
        order: {
          id: cashfreeOrder.order_id,
          amount: cashfreeOrder.order_amount,
          payment_session_id: cashfreeOrder.payment_session_id,
        },
        cashfree_mode: CASHFREE_ENV,
      });
    } catch (error) {
      console.error("Payment initialization failed:", error?.response?.data || error);
      res.status(500).json({ success: false, error: error?.response?.data?.message || error.message });
    }
  }
);

/**
 * POST /api/doctor-posters/verify
 * Confirm payment and activate doctor poster campaign.
 */
router.post(
  "/verify",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const orderId = req.body.order_id || req.body.razorpay_order_id;
      const posterId = req.body.poster_id;

      if (!orderId || !posterId) {
        return res.status(400).json({
          success: false,
          error: "order_id and poster_id are required",
        });
      }

      // Check order status from Cashfree
      let orderResponse;
      try {
        orderResponse = await axios.get(
          `${cashfreeBaseUrl}/orders/${orderId}`,
          {
            headers: getCashfreeHeaders()
          }
        );
      } catch (err) {
        console.error("Failed to fetch order details from Cashfree:", err.message);
        return res.status(400).json({ success: false, error: `Cashfree order lookup failed: ${err.message}` });
      }

      const { order_status } = orderResponse.data;
      if (order_status !== "PAID") {
        return res.status(400).json({ success: false, error: `Payment is not completed. Status: ${order_status}` });
      }

      // Fetch transaction ID
      let transactionId = `cf_${orderId}`;
      try {
        const paymentsResponse = await axios.get(
          `${cashfreeBaseUrl}/orders/${orderId}/payments`,
          {
            headers: getCashfreeHeaders()
          }
        );
        const successPayment = paymentsResponse.data?.find(p => p.payment_status === "SUCCESS");
        if (successPayment?.cf_payment_id) {
          transactionId = String(successPayment.cf_payment_id);
        }
      } catch (err) {
        console.warn("Could not retrieve payments detail from Cashfree:", err.message);
      }

      // Activate poster
      const updated = await sql`
        UPDATE doctor_posters
        SET status = 'active',
            razorpay_payment_id = ${transactionId},
            start_date = CURRENT_TIMESTAMP,
            end_date = CURRENT_TIMESTAMP + INTERVAL '30 days',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${posterId} AND doctor_id = ${req.user.id}
        RETURNING *
      `;

      if (!updated.length) {
        return res.status(404).json({ success: false, error: "Poster record not found" });
      }

      res.json({ success: true, data: updated[0] });
    } catch (error) {
      console.error("Cashfree verification failed:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/doctor-posters/my-posters
 * Retrieve promotions submitted by the authenticated doctor.
 */
router.get(
  "/my-posters",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const posters = await sql`
        SELECT * FROM doctor_posters
        WHERE doctor_id = ${req.user.id}
        ORDER BY created_at DESC
      `;
      res.json({ success: true, data: posters });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/doctor-posters/active
 * Public route to fetch all active posters for home display.
 */
router.get(
  "/active",
  async (req, res) => {
    try {
      const active = await sql`
        SELECT dp.*, d.name AS doctor_name, d.specialty
        FROM doctor_posters dp
        JOIN doctors d ON dp.doctor_id = d.id
        WHERE dp.status = 'active'
          AND dp.end_date > CURRENT_TIMESTAMP
        ORDER BY dp.created_at DESC
      `;
      res.json({ success: true, data: active });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/doctor-posters/:id
 * Delete a doctor promotion poster (and clean up Cloudinary storage).
 */
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if poster exists and belongs to the doctor
      const posters = await sql`
        SELECT * FROM doctor_posters
        WHERE id = ${id} AND doctor_id = ${req.user.id}
      `;

      if (!posters.length) {
        return res.status(404).json({ success: false, error: "Poster not found" });
      }

      const poster = posters[0];

      // Remove from Cloudinary if public ID exists
      if (poster.cloudinary_public_id) {
        try {
          await cloudinary.uploader.destroy(poster.cloudinary_public_id);
        } catch (cloudinaryErr) {
          console.warn("Failed to delete Cloudinary asset:", cloudinaryErr.message);
        }
      }

      // Delete from DB
      await sql`
        DELETE FROM doctor_posters
        WHERE id = ${id} AND doctor_id = ${req.user.id}
      `;

      res.json({ success: true, message: "Poster deleted successfully" });
    } catch (error) {
      console.error("Failed to delete poster:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
