import { useState } from "react";
import { analyzeXray } from "../../api/xrayApi";
import { useAuth } from "../../context/AuthContext";

const XRayAnalyzer = () => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [heatmap, setHeatmap] = useState(false);
  const [error, setError] = useState(null);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setResult(null);
    setError(null);
    if (!f) return;
    const allowed = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(f.type)) {
      setError("Only JPG or PNG images are supported");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const onAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeXray({ file, heatmap });
      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to analyze X-ray");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h2>AI Chest X-Ray Analyzer</h2>
      <p style={{ color: "#b45309", background: "#fff7ed", padding: 8, borderRadius: 8 }}>
        AI analysis is not a medical diagnosis. Please consult a doctor.
      </p>

      <div style={{ marginTop: 16 }}>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={onFileChange}
        />
      </div>

      {preview && (
        <div style={{ marginTop: 16 }}>
          <img
            src={preview}
            alt="Preview"
            style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #eee" }}
          />
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={heatmap} onChange={(e) => setHeatmap(e.target.checked)} />
          Include Grad-CAM heatmap
        </label>
      </div>

      <button
        disabled={!file || loading}
        onClick={onAnalyze}
        style={{ marginTop: 12, padding: "10px 16px" }}
      >
        {loading ? "Analyzing..." : "Analyze X-Ray"}
      </button>

      {error && (
        <div style={{ marginTop: 12, color: "#b91c1c" }}>{error}</div>
      )}

      {result && (
        <div style={{ marginTop: 20, padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <h3>Result</h3>
          <p>
            <strong>Prediction:</strong> {String(result.prediction || "").replace(/\b\w/g, c => c.toUpperCase())}
          </p>
          <p>
            <strong>Confidence:</strong> {Math.round((result.confidence || 0) * 100)}%
          </p>
          {result.heatmapUrl && (
            <div style={{ marginTop: 12 }}>
              <h4>Heatmap</h4>
              <img src={result.heatmapUrl} alt="Grad-CAM" style={{ maxWidth: "100%", borderRadius: 8 }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default XRayAnalyzer;

