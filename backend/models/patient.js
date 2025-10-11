import mongoose from "mongoose";
import bcrypt from "bcrypt";

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed password
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  phone: { type: String },
  bloodGroup: { type: String },
  medicalHistory: { type: String },
  uniqueCode: { type: String, unique: true, sparse: true }, // Add unique code for doctor access
});

// Hash password before saving
patientSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    // Generate unique code only if it's a new patient and no code exists
    if (this.isNew && !this.uniqueCode) {
      this.uniqueCode = Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase(); // Simple unique code
    }
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password for login validation
patientSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Patient = mongoose.model("Patient", patientSchema);
export default Patient;
