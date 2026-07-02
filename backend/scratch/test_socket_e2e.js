import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import axios from "axios";
import { io } from "socket.io-client";
dotenv.config();

const TOKEN_SECRET = process.env.TOKEN_SECRET || "fallback_secret";
const DOCTOR_ID = "8bf56ced-3e4f-4510-9a03-5d05ec1b6691"; // Dr. Singh
const PATIENT_ID = "cd79a931-03de-4daa-b8b7-b3e021b82ce7"; // Ram's patient

async function run() {
  console.log("Starting Socket E2E test...");
  console.log("TOKEN_SECRET length:", TOKEN_SECRET.length);

  // 1. Connect to socket.io server
  const socket = io("http://localhost:8080", {
    auth: {
      token: "dummy_jwt_token_not_strictly_validated_by_connection_if_not_required"
    }
  });

  socket.on("connect", () => {
    console.log("Socket client connected! ID:", socket.id);
    
    // Join room
    console.log("Emitting join-doctor-room for:", DOCTOR_ID);
    socket.emit("join-doctor-room", DOCTOR_ID);
  });

  socket.on("staff-notify-doctor", (payload) => {
    console.log("SUCCESS!!! Received staff-notify-doctor event:", payload);
    socket.disconnect();
    process.exit(0);
  });

  // Wait 1.5 seconds for socket connection & room join, then make the HTTP request
  setTimeout(async () => {
    try {
      console.log("Generating staff token...");
      const staffToken = jwt.sign(
        {
          id: "bfdfa311-8dd7-4b2b-8e8e-f9c262475cf8",
          staff_id: "152204de-357a-42de-b0a2-8e2d25d0b13c",
          email: "staff@gmail.com",
          role: "staff",
          hospital_id: null,
          staff_role: "staff",
          active_doctor_id: DOCTOR_ID,
        },
        TOKEN_SECRET,
        { expiresIn: "1h" }
      );

      console.log("Sending POST /api/staff/notify-doctor...");
      const response = await axios.post(
        "http://localhost:8080/api/staff/notify-doctor",
        {
          doctor_id: DOCTOR_ID,
          patient_id: PATIENT_ID,
          message: "Patient Ram is ready and waiting in the queue.",
        },
        {
          headers: {
            Authorization: `Bearer ${staffToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("POST /api/staff/notify-doctor response:", response.data);

    } catch (err) {
      console.error("HTTP error:", err.response?.data || err.message);
      socket.disconnect();
      process.exit(1);
    }
  }, 1500);

  // Set timeout of 10 seconds for the whole test
  setTimeout(() => {
    console.error("FAIL: Timeout waiting for socket event.");
    socket.disconnect();
    process.exit(1);
  }, 10000);
}

run();
