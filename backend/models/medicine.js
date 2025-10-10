import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  salt: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  info: {
    type: String,
  },
  benefits: {
    type: String,
    required: true,
  },
  sideeffects: {
    type: String,
    required: true,
  },
  usage: {
    type: String,
  },
  working: {
    type: String,
    required: true,
  },
  safetyadvice: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default:
      "https://img1.exportersindia.com/product_images/bc-full/2022/1/1169423/warfarin-sodium-tablets-1642579071-6164622.jpeg",
    set: (v) =>
      v === ""
        ? "https://img1.exportersindia.com/product_images/bc-full/2022/1/1169423/warfarin-sodium-tablets-1642579071-6164622.jpeg"
        : v,
  },
  link: {
    type: String,
    required: true,
  },
});

const Medicine = mongoose.model("Medicine", medicineSchema);
export default Medicine;
