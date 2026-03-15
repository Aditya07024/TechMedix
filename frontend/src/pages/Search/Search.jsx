const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Search.css";
import { StoreContext } from "../../context/StoreContext";
import { assets } from "../../assets/assets";
import axios from "axios";
import Button from "@mui/material/Button";
import Aipop from "../../components/AiPop/Aipop";

const Search = () => {
  const [askAi, setAskAi] = useState(false);
  const location = useLocation();
  const { product_list } = useContext(StoreContext);
  const [medicine, setMedicine] = useState(location.state?.medicine || "");
  const [solution, setSolution] = useState(location.state?.solution || "");
  const prescriptionId = location.state?.prescriptionId;
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyResult, setSafetyResult] = useState(null);
  const [safetyError, setSafetyError] = useState(null);
  const [priceInsights, setPriceInsights] = useState(null);
  const [priceInsightsLoading, setPriceInsightsLoading] = useState(false);
  const [priceCheckResult, setPriceCheckResult] = useState(null);
  const [priceCheckLoading, setPriceCheckLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const product = location.state?.product;
  const [ifLogin, setIfLogin] = useState(false);

  useEffect(() => {
    if (medicine || solution) {
      handleSearch();
    }
    const checkLogin = async () => {
      try {
        const res = await axios.get(`${API_URL}/auth/status`, {
          withCredentials: true,
        });
        setIfLogin(res.data.ifLogin); // update state
      } catch (err) {
        setIfLogin(false); // fallback
      }
    };

    checkLogin();
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!medicine && !solution) {
      setError("Please enter either a medicine name or solution");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/api/medicines/search`, {
        params: { medicine: medicine || "", solution: solution || "" },
        withCredentials: true,
      });

      const { medicineData, similarMedicines } = response.data;
      const saltName =
        medicineData?.salt ||
        (similarMedicines.length > 0 ? similarMedicines[0].salt : "");

      if (medicineData) {
        setSelectedProduct(medicineData._id);
        setSolution(saltName);
        setSearchResults([medicineData, ...similarMedicines]);
      } else if (similarMedicines?.length > 0) {
        setSearchResults(similarMedicines);
        setSelectedProduct(similarMedicines[0]._id);
        setSolution(saltName);
      } else {
        setSearchResults([]);
        setSelectedProduct(null);
        setError("No medicines found");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch medicine data");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    if (selectedProductData?._id) {
      navigate(`/medicines/${selectedProductData._id}`, {
        state: { product: selectedProductData },
      });
    }
  };
  const handleDeleteClick = async () => {
    if (!selectedProductData?._id) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this medicine?"
    );
    if (!confirmDelete) return;

    try {
      await axios.delete(`${API_URL}/medicines/${selectedProductData._id}`);
      alert("Medicine deleted successfully");
      // Remove deleted item from the search results
      setSearchResults((prev) =>
        prev.filter((med) => med._id !== selectedProductData._id)
      );
      setSelectedProduct(null);
    } catch (err) {
      console.error("Failed to delete medicine:", err);
      alert("Failed to delete medicine");
    }
  };

  const selectedProductData = searchResults.find(
    (item) => item._id === selectedProduct
  );

  const handleSafetyCheck = async () => {
    try {
      setSafetyLoading(true);
      setSafetyError(null);
      setSafetyResult(null);
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user?.id) {
        setSafetyError("User not logged in");
        return;
      }
      // Prefer checking by salt when available; fall back to product name
      const candidate = (solution || selectedProductData?.name || medicine || "").trim();
      if (!candidate) {
        setSafetyError("Select a medicine first");
        return;
      }

      const endpoint = prescriptionId
        ? `/api/prescriptions/${prescriptionId}/safety-check`
        : `/api/prescriptions/safety-check-latest`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: "include",
        body: JSON.stringify({ candidate_medicine: candidate }),
      });
      const data = await res.json();
      if (data?.success) {
        setSafetyResult(data.data);
      } else {
        setSafetyError(data?.error || "Safety check failed");
      }
    } catch (err) {
      setSafetyError("Failed to run safety check");
    } finally {
      setSafetyLoading(false);
    }
  };

  const formatWarning = (w) => {
    if (typeof w === "string") return w;
    const parts = [w.medicine_1, w.medicine_2].filter(Boolean);
    if (parts.length) return `${parts.join(" + ")}: ${w.description || ""}`;
    return w.description || JSON.stringify(w);
  };

  const fetchPriceInsights = async () => {
    if (!selectedProductData?.name) return;
    setPriceInsightsLoading(true);
    setPriceInsights(null);
    try {
      const res = await fetch(
        `${API_URL}/api/medicines/${encodeURIComponent(selectedProductData.name)}/price-insights`
      );
      const data = await res.json();
      if (data?.success) setPriceInsights(data.data);
    } catch (_) {
      setPriceInsights(null);
    } finally {
      setPriceInsightsLoading(false);
    }
  };

  const handlePriceCheck = async () => {
    if (!prescriptionId) return;
    setPriceCheckLoading(true);
    setPriceCheckResult(null);
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const res = await fetch(`/api/prescriptions/${prescriptionId}/price-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      const data = await res.json();
      if (data?.success) setPriceCheckResult(data.data);
    } catch (_) {
      setPriceCheckResult(null);
    } finally {
      setPriceCheckLoading(false);
    }
  };

  return (
    <div className="search-page">
      {askAi && <Aipop setShowAiPop={setAskAi} />}
      <div className="div-up">
        <div className="search-section">
          <h2>Search Medicines</h2>
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-inputs-container">
              <div className="search-input-group">
                <img src={assets.search_icon} alt="" className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by medicine name"
                  value={medicine}
                  onChange={(e) => setMedicine(e.target.value)}
                />
              </div>
              <span className="search-divider">or</span>
              <div className="search-input-group">
                <img src={assets.search_icon} alt="" className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by solution"
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  readOnly={!!medicine}
                />
              </div>
              <button
                type="submit"
                className="search-submit"
                disabled={loading}
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>
        </div>
        <div className="ai-div">
          <div className="heading-div">
            <h1>Ask to AI Doctor about your medicine</h1>
            <Button variant="outlined" onClick={() => setAskAi(true)}>
              Click Here
            </Button>
          </div>
        </div>
      </div>

      <div className="search-results">
        {error && <div className="error-message">{error}</div>}

        <h3>
          Similar Medicines{" "}
          {searchResults.length > 0 && `(${searchResults.length})`}
        </h3>
        <div className="results-grid">
          <div className="grid-left">
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <div
                  key={item._id}
                  className={`medicine-item ${
                    selectedProduct === item._id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedProduct(item._id)}
                >
                  <div className="medicine-content">
                    <div className="medicine-info">
                      <h4>{item.name}</h4>
                      <p className="price">₹{item.price}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-results">
                <img src={assets.search_icon} alt="" />
                <p>No medicines found matching your search criteria</p>
              </div>
            )}
          </div>

          <div className="grid-right">
            {selectedProductData ? (
              <div className="product-view">
                <div className="product-view-container">
                  <div className="product-view-left">
                    <div className="product-view-img">
                      <img
                        src={selectedProductData.image}
                        alt={selectedProductData.name}
                      />
                    </div>
                  </div>
                  <div className="product-view-right">
                    <h1>{selectedProductData.name}</h1>
                    <div className="product-view-price">
                      <h2>₹{selectedProductData.price}</h2>
                    </div>
                    <div className="product-view-category">
                      <span>Salt:</span> {solution}
                    </div>
                    {/* {ifLogin && (
                      <div className="editanddeletebutton">
                        <Button onClick={handleEditClick} variant="outlined">
                          Edit Medicine
                        </Button>
                        <Button
                          onClick={handleDeleteClick}
                          variant="outlined"
                          color="error"
                        >
                          Delete Medicine
                        </Button>
                      </div>
                    )} */}
                    <div className="product-view-price">
                      <a
                        href={selectedProductData.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <button className="buy-button">Buy Now</button>
                      </a>
                    </div>
                    <div className="safety-check-section">
                      <button
                        type="button"
                        className="safety-check-btn"
                        onClick={handleSafetyCheck}
                        disabled={safetyLoading}
                      >
                        {safetyLoading ? "Running Safety Check..." : "Run Safety Check"}
                      </button>
                      {/* {prescriptionId && (
                        <button
                          type="button"
                          className="price-check-btn"
                          onClick={handlePriceCheck}
                          disabled={priceCheckLoading}
                        >
                          {priceCheckLoading ? "Checking..." : "💰 Run Price Check"}
                        </button>
                      )} */}
                      {!prescriptionId && (
                        <p className="safety-hint">No open prescription found. We’ll use your latest prescription automatically.</p>
                      )}
                      {safetyError && (
                        <p className="safety-error">{safetyError}</p>
                      )}
                      {safetyResult?.warnings?.length > 0 && (
                        <div className="safety-warnings">
                          <h4>⚠️ Safety Warnings</h4>
                          <ul>
                            {safetyResult.warnings.map((w, idx) => (
                              <li key={idx}>{formatWarning(w)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {safetyResult && (!safetyResult.warnings || safetyResult.warnings.length === 0) && (
                        <p className="safety-safe">✅ No safety issues detected.</p>
                      )}
                      {priceCheckResult && (
                        <div className="price-check-result">
                          <h4>💰 Price Check Result</h4>
                          <p>Original: ₹{priceCheckResult.total_original_price} → Best: ₹{priceCheckResult.total_replaced_price}</p>
                          <p className="savings">Savings: ₹{priceCheckResult.savings}</p>
                          {priceCheckResult.replacements?.length > 0 && (
                            <ul>
                              {priceCheckResult.replacements.map((r, i) => (
                                <li key={i}>{r.original} → {r.replaced_with} (save ₹{r.savings})</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="price-insights-section">
                      <button
                        type="button"
                        className="price-insights-btn"
                        onClick={fetchPriceInsights}
                        disabled={priceInsightsLoading}
                      >
                        {priceInsightsLoading ? "Loading..." : "📊 View Price Insights"}
                      </button>
                      {priceInsights && (
                        <div className="price-insights-card">
                          <div className="price-insight-row">
                            <span className="insight-label">Trend:</span>
                            <span className={`insight-value trend-${priceInsights.trend}`}>
                              {priceInsights.trend === "rising" && "↗ Rising"}
                              {priceInsights.trend === "falling" && "↘ Falling"}
                              {priceInsights.trend === "stable" && "→ Stable"}
                            </span>
                          </div>
                          <div className="price-insight-row">
                            <span className="insight-label">Recommendation:</span>
                            <span className={`insight-value rec-${priceInsights.recommendation}`}>
                              {priceInsights.recommendation === "buy_now" && "✓ Good time to buy"}
                              {priceInsights.recommendation === "wait" && "⏳ Consider waiting"}
                              {priceInsights.recommendation === "monitor" && "👀 Monitor prices"}
                            </span>
                          </div>
                          {priceInsights.avgPrice != null && (
                            <div className="price-insight-row">
                              <span className="insight-label">30-day avg:</span>
                              <span className="insight-value">₹{priceInsights.avgPrice}</span>
                            </div>
                          )}
                          {priceInsights.dataPoints > 0 && (
                            <p className="insight-hint">Based on {priceInsights.dataPoints} data point(s)</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="product-view-info">
                      <h3>Product Information</h3>
                      {selectedProductData.medicine_desc && (
                        <div className="info-section">
                          <p>{selectedProductData.medicine_desc}</p>
                        </div>
                      )}
                      {selectedProductData.benefits && (
                        <div className="info-section">
                          <h4>Benefits</h4>
                          <p>{selectedProductData.benefits}</p>
                        </div>
                      )}
                      {selectedProductData.sideeffects && (
                        <div className="info-section">
                          <h4>Side Effects</h4>
                          <p>{selectedProductData.sideeffects}</p>
                        </div>
                      )}
                      {selectedProductData.usage && (
                        <div className="info-section">
                          <h4>Usage Instructions</h4>
                          <p>{selectedProductData.usage}</p>
                        </div>
                      )}
                      {selectedProductData.working && (
                        <div className="info-section">
                          <h4>How it Works</h4>
                          <p>{selectedProductData.working}</p>
                        </div>
                      )}
                      {selectedProductData.safetyadvice && (
                        <div className="info-section">
                          <h4>Safety Advice</h4>
                          <p>{selectedProductData.safetyadvice}</p>
                        </div>
                      )}
                      {!selectedProductData.medicine_desc &&
                        !selectedProductData.benefits &&
                        !selectedProductData.sideeffects &&
                        !selectedProductData.usage &&
                        !selectedProductData.working &&
                        !selectedProductData.safetyadvice && (
                          <p>No detailed information available.</p>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-product-selected">
                <img src={assets.search_icon} alt="" />
                <p>Select a medicine to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Search;
