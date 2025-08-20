import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    required: true,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  aiReport: {
    type: String,
    required: false, // AI report might be generated later
  },
});

const Report = mongoose.model('Report', reportSchema);

export default Report;
