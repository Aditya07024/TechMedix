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
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const product = location.state?.product;

  useEffect(() => {
    if (medicine || solution) {
      handleSearch();
    }
    // eslint-disable-next-line
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
      const response = await axios.get(`/api/medicines/search`, {
        params: {
          medicine: medicine || "",
          solution: solution || "",
        },
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
    navigate(`/medicines/${selectedProductData._id}`, { state: { product: selectedProductData } });
  }
};
  const handleDeleteClick = async () => {
  if (!selectedProductData?._id) return;

  const confirmDelete = window.confirm("Are you sure you want to delete this medicine?");
  if (!confirmDelete) return;

  try {
    await axios.delete(`http://localhost:8080/medicines/${selectedProductData._id}`);
    alert("Medicine deleted successfully");
    // Remove deleted item from the search results
    setSearchResults(prev => prev.filter(med => med._id !== selectedProductData._id));
    setSelectedProduct(null);
  } catch (err) {
    console.error("Failed to delete medicine:", err);
    alert("Failed to delete medicine");
  }
};

  const selectedProductData = searchResults.find(
    (item) => item._id === selectedProduct
  );

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
            <h1>Ask to ChatGpt</h1>
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
                    <div className="editanddeletebutton">
                      <Button onClick={handleEditClick} variant="outlined">
                      Edit Medicine
                    </Button>
                    <Button onClick={handleDeleteClick} variant="outlined" color="error">
  Delete Medicine
</Button>
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
