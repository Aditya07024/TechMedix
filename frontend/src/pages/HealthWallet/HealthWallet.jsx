import React, { useEffect, useMemo, useState } from "react";
import { healthWalletApi } from "../../api";
import "./HealthWallet.css";

export default function HealthWallet() {
  const [pendingFiles, setPendingFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files);
    setPendingFiles((prev) => [...prev, ...selected]);
    event.target.value = "";
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await healthWalletApi.listDocuments();
      setDocuments(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load health wallet documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const removePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;

    try {
      setUploading(true);
      setError("");
      const formData = new FormData();
      pendingFiles.forEach((file) => formData.append("documents", file));

      const res = await healthWalletApi.uploadDocuments(formData);
      const savedDocs = res.data?.data || [];
      setDocuments((prev) => [...savedDocs, ...prev]);
      setPendingFiles([]);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to upload documents.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id) => {
    try {
      setError("");
      await healthWalletApi.deleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete document.");
    }
  };

  const previewableDocuments = useMemo(
    () =>
      documents.map((doc) => ({
        ...doc,
        isImage: doc.mime_type?.startsWith("image/"),
        isPdf:
          doc.mime_type === "application/pdf" ||
          String(doc.format || "").toLowerCase() === "pdf",
      })),
    [documents],
  );
  const imageCount = previewableDocuments.filter((doc) => doc.isImage).length;
  const pdfCount = previewableDocuments.filter((doc) => doc.isPdf).length;

  return (
    <div className="health-wallet">
      <header className="wallet-header">
        <div className="wallet-header-copy">
          <span className="wallet-kicker">Personal records</span>
          <h1>Health Wallet</h1>
          <p>
            Keep your reports, scans, prescriptions, and other medical
            documents in one place.
          </p>
        </div>

        <div className="wallet-summary">
          <div className="wallet-stat-card">
            <strong>{documents.length}</strong>
            <span>Total Files</span>
          </div>
          <div className="wallet-stat-card">
            <strong>{imageCount}</strong>
            <span>Images</span>
          </div>
          <div className="wallet-stat-card">
            <strong>{pdfCount}</strong>
            <span>PDFs</span>
          </div>
        </div>
      </header>

      <section className="upload-section">
        <div className="upload-intro">
          <span className="upload-badge">Secure storage</span>
          <h2>Add documents</h2>
          <p>PDF, JPG, PNG, or WEBP files up to 10 MB each.</p>
        </div>

        <label className="upload-label">
          <span className="upload-icon" aria-hidden="true">
            +
          </span>
          <span className="upload-label-text">
            Select reports, scans, or prescriptions
          </span>
          <input
            type="file"
            multiple
            accept=".pdf,image/*"
            onChange={handleFiles}
          />
        </label>
        <button
          className="upload-btn"
          type="button"
          onClick={handleUpload}
          disabled={pendingFiles.length === 0 || uploading}
        >
          {uploading ? "Uploading..." : "Upload to Health Wallet"}
        </button>
      </section>

      {error && <p className="wallet-error">{error}</p>}

      {pendingFiles.length > 0 && (
        <section className="pending-files">
          <div className="section-heading">
            <h2>Ready to Upload</h2>
            <span>{pendingFiles.length} file(s) selected</span>
          </div>
          {pendingFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="pending-file-item">
              <div className="pending-file-meta">
                <span className="pending-file-type">
                  {file.type === "application/pdf" ? "PDF" : "IMG"}
                </span>
                <span className="pending-file-name">{file.name}</span>
              </div>
              <button
                className="remove-btn"
                type="button"
                onClick={() => removePendingFile(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="docs-section">
        <div className="section-heading">
          <h2>Saved Documents</h2>
          {!loading && previewableDocuments.length > 0 && (
            <span>{previewableDocuments.length} available</span>
          )}
        </div>
        {loading ? (
          <p className="empty-state">Loading documents...</p>
        ) : previewableDocuments.length === 0 ? (
          <p className="empty-state">No documents uploaded yet.</p>
        ) : (
          <div className="docs-grid">
            {previewableDocuments.map((doc) => (
              <article key={doc.id} className="doc-card">
                <div className="doc-preview">
                  {doc.isImage ? (
                    <img
                      src={doc.file_url}
                      alt={doc.file_name}
                      className="preview-image"
                    />
                  ) : doc.isPdf ? (
                    <iframe
                      src={doc.file_url}
                      title={doc.file_name}
                      className="preview-pdf-frame"
                    />
                  ) : (
                    <div className="preview-pdf">{doc.isPdf ? "PDF" : "DOC"}</div>
                  )}
                </div>

                <div className="doc-info">
                  <div className="doc-chip-row">
                    <span className="doc-chip">
                      {doc.isImage ? "Image" : doc.isPdf ? "PDF" : "Document"}
                    </span>
                  </div>
                  <p className="doc-name">{doc.file_name}</p>
                  <p className="doc-date">
                    Uploaded {new Date(doc.created_at).toLocaleString()}
                  </p>

                  <div className="doc-actions">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="view-btn"
                    >
                      View
                    </a>
                    <button
                      className="remove-btn"
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
