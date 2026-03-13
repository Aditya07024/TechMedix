import React, { useState } from "react";
import "./HealthWallet.css";

export default function HealthWallet() {
  const [files, setFiles] = useState([]);

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files);
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="health-wallet">
      <header className="wallet-header">
        <h1>Health Wallet</h1>
        <p>Store your reports, X‑rays and other health documents securely.</p>
      </header>

      <section className="upload-section">
        <label className="upload-label">
          Upload documents (PDF, JPG, PNG)
          <input
            type="file"
            multiple
            accept=".pdf,image/*"
            onChange={handleFiles}
          />
        </label>
      </section>

      <section className="files-section">
        <h2>Saved Documents</h2>
        {files.length === 0 ? (
          <p className="empty-state">No documents uploaded yet.</p>
        ) : (
          <ul className="files-list">
            {files.map((file, index) => (
              <li key={index} className="file-item">
                <span className="file-name">{file.name}</span>
                <button
                  className="remove-btn"
                  onClick={() => removeFile(index)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
