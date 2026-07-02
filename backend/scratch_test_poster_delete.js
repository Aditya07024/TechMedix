import sql from "./config/database.js";
import jwt from "jsonwebtoken";
import axios from "axios";

async function main() {
  try {
    // 1. Get Dr. Singh's ID
    const docs = await sql`SELECT * FROM doctors WHERE email = 'singh@gmail.com'`;
    if (!docs.length) {
      console.error("Dr. Singh not found!");
      process.exit(1);
    }
    const doctor = docs[0];
    console.log("Found Dr. Singh:", doctor.id);

    // 2. Generate a JWT token for the doctor
    const token = jwt.sign(
      { id: doctor.id, doctor_id: doctor.id, role: "doctor" },
      process.env.TOKEN_SECRET || "medicineapp",
      { expiresIn: "24h" }
    );

    // 3. Insert a dummy poster in DB to try deleting it
    const [newPoster] = await sql`
      INSERT INTO doctor_posters (doctor_id, image_url, status)
      VALUES (${doctor.id}, 'https://example.com/test-poster.jpg', 'pending')
      RETURNING *
    `;
    console.log("Created test poster:", newPoster.id);

    // 4. Try calling the DELETE API using axios
    const response = await axios.delete(
      `http://localhost:8080/api/doctor-posters/${newPoster.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    console.log("Delete API response:", response.data);

    // Verify it is deleted from DB
    const check = await sql`SELECT * FROM doctor_posters WHERE id = ${newPoster.id}`;
    console.log("Post-delete DB check (should be empty):", check);

  } catch (error) {
    console.error("Error during test:", error.response?.data || error.message);
  } finally {
    process.exit(0);
  }
}

main();
