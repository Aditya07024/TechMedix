import React, { useState, useEffect, useRef } from "react";
import { doctorPosterApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { Upload, HelpCircle, CheckCircle, Clock, AlertTriangle, CreditCard, Sparkles } from "lucide-react";
import "./DoctorPromotions.css";

const TARGET_RATIO = 1300 / 265; // ~4.90566

export default function DoctorPromotions({ doctorId }) {
  const { user } = useAuth();
  const [posters, setPosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [payingPosterId, setPayingPosterId] = useState(null);
  const [deletingPosterId, setDeletingPosterId] = useState(null);
  
  // Cropping state
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });
  const [cropPosition, setCropPosition] = useState(50); // Slider: 0 to 100%
  const [isWider, setIsWider] = useState(false);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const imageRef = useRef(null);

  const [copied, setCopied] = useState(false);

  const docName = user?.name ? `Dr. ${user.name.replace(/^dr\.?\s+/i, "")}` : "Dr. [Name]";
  const docSpecialty = user?.specialty || "[Specialty]";

  const aiPrompt = `Create a professional, modern healthcare promotion banner for a doctor. The banner MUST be in a very wide landscape layout (aspect ratio approximately 5:1, matching 1300x265 pixels). The design should have a clean, premium clinical theme with soothing colors (teal, light blue, and white). On the side, include high-quality medical illustration or clinic theme. Leave clean space for promotional text. Integrate the following details: 
Doctor: ${docName}
Specialty: ${docSpecialty}
Ensure there is NO generic or garbled placeholder text, keep it visually clean so I can crop it to a 1300x265 banner.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(aiPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    fetchPosters();
  }, []);

  const fetchPosters = async () => {
    try {
      setLoading(true);
      const res = await doctorPosterApi.getMyPosters();
      if (res.data?.success) {
        setPosters(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load posters:", err);
      setError("Failed to load promotion campaigns.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    setSelectedFile(file);
    setError("");
    setSuccess("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        setNaturalDimensions({ width, height });
        
        const ratio = width / height;
        setIsWider(ratio > TARGET_RATIO);
        setImageSrc(event.target.result);
        setCropPosition(50); // default center
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCropAndUpload = async () => {
    if (!imageSrc) return;

    try {
      setUploading(true);
      setError("");
      setSuccess("");

      const img = new Image();
      img.src = imageSrc;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const { width: nw, height: nh } = naturalDimensions;
      let sx = 0;
      let sy = 0;
      let sw = 0;
      let sh = 0;

      if (isWider) {
        // Limited by height
        sh = nh;
        sw = sh * TARGET_RATIO;
        const maxOffset = nw - sw;
        sx = maxOffset * (cropPosition / 100);
      } else {
        // Limited by width
        sw = nw;
        sh = sw / TARGET_RATIO;
        const maxOffset = nh - sh;
        sy = maxOffset * (cropPosition / 100);
      }

      // Draw onto target canvas
      const canvas = document.createElement("canvas");
      canvas.width = 1300;
      canvas.height = 265;
      const ctx = canvas.getContext("2d");
      
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1300, 265);

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setError("Failed to crop image.");
          setUploading(false);
          return;
        }

        const croppedFile = new File([blob], `poster-${Date.now()}.jpg`, { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("poster", croppedFile);

        const uploadRes = await doctorPosterApi.uploadPoster(formData);
        if (uploadRes.data?.success) {
          setSuccess("Poster uploaded successfully! Opening payment window...");
          setImageSrc(null);
          setSelectedFile(null);
          await fetchPosters();
          
          // Instantly trigger Razorpay checkout for the new poster
          if (uploadRes.data.data?.id) {
            await handleCheckout(uploadRes.data.data.id);
          }
        } else {
          setError(uploadRes.data?.error || "Upload failed");
        }
        setUploading(false);
      }, "image/jpeg", 0.95);

    } catch (err) {
      console.error("Crop upload error:", err);
      setError("An error occurred during banner cropping.");
      setUploading(false);
    }
  };

  const handleCheckout = async (posterId) => {
    try {
      setPayingPosterId(posterId);
      setError("");
      
      const paySessionRes = await doctorPosterApi.createPaySession({ poster_id: posterId });
      if (!paySessionRes.data?.success) {
        throw new Error(paySessionRes.data?.error || "Unable to initiate payment");
      }

      const { order, razorpay_key } = paySessionRes.data;

      const options = {
        key: razorpay_key,
        amount: order.amount,
        currency: "INR",
        name: "TechMedix",
        description: "Doctor Promotion Banner Payout",
        order_id: order.id,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        handler: async (response) => {
          try {
            const verifyRes = await doctorPosterApi.verifyPaySignature({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              poster_id: posterId,
            });

            if (verifyRes.data?.success) {
              setSuccess("Payment successful! Your promotion banner is now active.");
              await fetchPosters();
            } else {
              setError("Signature verification failed.");
            }
          } catch (verifyErr) {
            console.error("Verification error:", verifyErr);
            setError("Payment verification failed. Please contact support.");
          }
        },
        theme: {
          color: "#00de94",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error("Checkout failed:", err);
      setError(err.message || "Checkout failed. Please try again.");
    } finally {
      setPayingPosterId(null);
    }
  };

  const handleDeletePoster = async (posterId) => {
    if (!window.confirm("Are you sure you want to delete this campaign?")) {
      return;
    }

    try {
      setDeletingPosterId(posterId);
      setError("");
      setSuccess("");

      const res = await doctorPosterApi.deletePoster(posterId);
      if (res.data?.success) {
        setSuccess("Campaign deleted successfully.");
        await fetchPosters();
      } else {
        setError(res.data?.error || "Failed to delete campaign");
      }
    } catch (err) {
      console.error("Delete campaign failed:", err);
      setError(err.response?.data?.error || "Failed to delete campaign. Please try again.");
    } finally {
      setDeletingPosterId(null);
    }
  };

  return (
    <div className="promotions-dashboard">
      <div className="promotions-card-header">
        <h2>Promotional Campaigns</h2>
        <p>Advertise yourself on the homepage banner header for ₹30 per 30 days.</p>
      </div>

      {error && <div className="promotions-alert error">{error}</div>}
      {success && <div className="promotions-alert success">{success}</div>}

      {/* CROPPER TOOL */}
      {imageSrc && (
        <div className="cropper-section">
          <h3>Adjust Banner Crop Area</h3>
          <p>
            {isWider
              ? "Your image is very wide. Slide horizontally to adjust the crop region."
              : "Your image is very tall. Slide vertically to adjust the crop region."}
          </p>

          <div className="crop-preview-container">
            <div className="crop-ratio-wrapper">
              <div 
                className="crop-image-window"
                style={{
                  aspectRatio: TARGET_RATIO,
                  width: "100%",
                  maxWidth: "800px",
                  overflow: "hidden",
                  position: "relative",
                  borderRadius: "12px",
                  border: "2px dashed #00de94",
                  background: "#111"
                }}
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Crop preview"
                  style={{
                    display: "block",
                    width: isWider ? "auto" : "100%",
                    height: isWider ? "100%" : "auto",
                    maxWidth: "none",
                    maxHeight: "none",
                    position: "absolute",
                    top: isWider ? "0" : `-${(naturalDimensions.height - (naturalDimensions.width / TARGET_RATIO)) * (cropPosition / 100) * (800 / naturalDimensions.width)}px`,
                    left: isWider ? `-${(naturalDimensions.width - (naturalDimensions.height * TARGET_RATIO)) * (cropPosition / 100) * (265 / naturalDimensions.height)}px` : "0",
                    transform: "none"
                  }}
                />
              </div>
            </div>
          </div>

          <div className="slider-control-group">
            <input
              type="range"
              min="0"
              max="100"
              value={cropPosition}
              onChange={(e) => setCropPosition(Number(e.target.value))}
              className="position-slider"
            />
            <div className="slider-labels">
              <span>{isWider ? "Left" : "Top"}</span>
              <span>Center</span>
              <span>{isWider ? "Right" : "Bottom"}</span>
            </div>
          </div>

          <div className="crop-actions">
            <button
              onClick={handleCropAndUpload}
              disabled={uploading}
              className="crop-btn confirm"
            >
              {uploading ? "Cropping & Uploading..." : "Crop & Upload"}
            </button>
            <button
              onClick={() => {
                setImageSrc(null);
                setSelectedFile(null);
              }}
              className="crop-btn cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* UPLOAD TRIGGER */}
      {!imageSrc && (
        <>
          <div className="upload-dropzone">
            <label htmlFor="promotion-file-upload" className="dropzone-label">
              <Upload size={36} className="upload-icon" />
              <strong>Upload New Banner</strong>
              <span>Recommended high quality landscape graphic. Crop will keep 4.9:1 ratio.</span>
            </label>
            <input
              id="promotion-file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          <div className="ai-poster-assistant-card">
            <div className="ai-assistant-header">
              <div className="ai-icon-badge">
                <Sparkles size={20} className="ai-icon" />
              </div>
              <div className="ai-header-text">
                <h3>Need a Banner? Make one with AI</h3>
                <p>Generate a professional landscape poster using ChatGPT / DALL-E, then download and upload it here.</p>
              </div>
            </div>
            
            <div className="ai-prompt-container">
              <div className="prompt-meta">
                <span>Custom AI Prompt for ChatGPT:</span>
                <button 
                  onClick={handleCopyPrompt} 
                  className={`copy-prompt-btn ${copied ? "copied" : ""}`}
                  type="button"
                >
                  {copied ? "✓ Copied!" : "Copy Prompt"}
                </button>
              </div>
              <textarea
                className="prompt-textarea"
                readOnly
                value={aiPrompt}
              />
            </div>
            
            <div className="ai-action-footer">
              <a 
                href="https://chatgpt.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="chatgpt-redirect-btn"
              >
                Open ChatGPT Website ↗
              </a>
            </div>
          </div>
        </>
      )}

      {/* CAMPAIGN LIST */}
      <div className="campaigns-list-section">
        <h3>Your Banners</h3>
        {loading ? (
          <p>Loading history...</p>
        ) : posters.length === 0 ? (
          <div className="empty-promotions">
            <HelpCircle size={32} />
            <p>No promotional banners found. Launch a campaign to get started!</p>
          </div>
        ) : (
          <div className="posters-grid">
            {posters.map((poster) => {
              const isPending = poster.status === "pending";
              const isActive = poster.status === "active";
              const isExpired = poster.end_date && new Date(poster.end_date) < new Date();

              return (
                <div key={poster.id} className="poster-card">
                  <div className="poster-preview">
                    <img src={poster.image_url} alt="Promotion Banner" />
                  </div>
                  <div className="poster-details">
                    <div className="status-badge-container">
                      {isActive && !isExpired && (
                        <span className="badge active">
                          <CheckCircle size={14} /> Active
                        </span>
                      )}
                      {isPending && (
                        <span className="badge pending">
                          <Clock size={14} /> Pending Payment
                        </span>
                      )}
                      {isExpired && isActive && (
                        <span className="badge expired">
                          <AlertTriangle size={14} /> Expired
                        </span>
                      )}
                    </div>

                    <div className="p-row">
                      <span>Package:</span>
                      <strong>30 Days</strong>
                    </div>
                    <div className="p-row">
                      <span>Amount:</span>
                      <strong>₹30.00</strong>
                    </div>

                    {poster.start_date && (
                      <div className="p-row">
                        <span>Campaign:</span>
                        <small>
                          {new Date(poster.start_date).toLocaleDateString()} -{" "}
                          {new Date(poster.end_date).toLocaleDateString()}
                        </small>
                      </div>
                    )}

                    {isPending && (
                      <button
                        onClick={() => handleCheckout(poster.id)}
                        disabled={payingPosterId === poster.id}
                        className="pay-now-btn"
                      >
                        <CreditCard size={14} />{" "}
                        {payingPosterId === poster.id ? "Processing..." : "Pay ₹30 Now"}
                      </button>
                    )}

                    {(isPending || isExpired) && (
                      <button
                        onClick={() => handleDeletePoster(poster.id)}
                        disabled={deletingPosterId === poster.id}
                        className="delete-poster-btn"
                      >
                        {deletingPosterId === poster.id ? "Deleting..." : "Delete Campaign"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
