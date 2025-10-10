import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  userId: String,
  filePath: String,
  fileName: String,
  fileType: String,
  aiReport: String,
  timestamp: { type: Date, default: Date.now },
});

const Report = mongoose.model("Report", reportSchema);
export default Report;
