import dotenv from "dotenv";
import path from "path";
import jwt from "jsonwebtoken";
import axios from "axios";
dotenv.config();

async function run() {
  try {
    const token = jwt.sign(
      {
        id: "bfdfa311-8dd7-4b2b-8e8e-f9c262475cf8",
        staff_id: "152204de-357a-42de-b0a2-8e2d25d0b13c",
        email: "staff@gmail.com",
        role: "staff",
        hospital_id: null,
        staff_role: "staff",
        active_doctor_id: "8bf56ced-3e4f-4510-9a03-5d05ec1b6691",
      },
      process.env.TOKEN_SECRET,
      { expiresIn: "1d" }
    );

    const response = await axios.patch(
      "http://localhost:8080/api/staff/queue/693f7ca2-c1fe-4ce9-91d5-5003f2324fa7/status",
      { status: "in_progress" },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("RESPONSE SUCCESS:", response.data);
    process.exit(0);
  } catch (err) {
    console.error("RESPONSE ERROR:", err.response?.data || err.message);
    process.exit(1);
  }
}
run();
