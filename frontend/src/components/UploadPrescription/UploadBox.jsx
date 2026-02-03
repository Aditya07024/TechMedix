import React, { useState } from "react";
import "./UploadBox.css";

const UploadBox = () => {
  const [file, setFile] = useState(null);

  const handleUpload = () => {
    if (!file) return alert("Please select a file");
    alert("Prescription uploaded successfully (API pending)");
  };

  return (
    <div className="upload-box">
      <h2>Upload Prescription</h2>

      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button onClick={handleUpload}>Upload</button>
    </div>
  );
};

export default UploadBox;
