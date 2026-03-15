import { useEffect, useState } from "react";
import { getXrayHistory } from "../../api/xrayApi";

const XRayHistory = () => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getXrayHistory();
        if (!mounted) return;
        setScans(res.data?.scans || []);
      } catch (e) {
        setError(e?.response?.data?.error || "Failed to load history");
      } finally {
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error)
    return (
      <div style={{ padding: 16, color: "#b91c1c" }}>Error: {error}</div>
    );

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <h2>My X‑Ray Scans</h2>
      {scans.length === 0 ? (
        <p>No scans yet. Try the X‑Ray Analyzer first.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {scans.map((s) => (
            <div
              key={s.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                display: "grid",
                gridTemplateColumns: "160px 1fr",
                gap: 12,
                alignItems: "center",
              }}
           >
              <div>
                <img
                  src={s.heatmapUrl || s.fileUrl}
                  alt="scan"
                  style={{ width: 160, height: 120, objectFit: "cover", borderRadius: 6 }}
                />
              </div>
              <div>
                <div>
                  <strong>Prediction:</strong> {s.prediction}
                </div>
                <div>
                  <strong>Confidence:</strong> {Math.round((s.confidence || 0) * 100)}%
                </div>
                <div>
                  <strong>Date:</strong> {new Date(s.createdAt).toLocaleString()}
                </div>
                <div style={{ marginTop: 6 }}>
                  <a href={s.fileUrl} target="_blank" rel="noreferrer">
                    View Original Image
                  </a>
                  {s.heatmapUrl && (
                    <>
                      {" | "}
                      <a href={s.heatmapUrl} target="_blank" rel="noreferrer">
                        View Heatmap
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default XRayHistory;

