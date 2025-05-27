import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import "./Search.css";
import { StoreContext } from "../../context/StoreContext";
import { useContext } from "react";
import { assets } from "../../assets/assets";

const Search = () => {
  const location = useLocation();
  const { product_list } = useContext(StoreContext);
  const [medicine, setMedicine] = useState(location.state?.medicine || "");
  const [solution, setSolution] = useState(location.state?.solution || "");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    handleSearch();
  }, []);

  const handleSearch = (e) => {
    e?.preventDefault();
    const filtered = product_list.filter((product) => {
      const matchMedicine = product.name
        .toLowerCase()
        .includes(medicine.toLowerCase());
      const matchSolution = product.description
        .toLowerCase()
        .includes(solution.toLowerCase());
      return medicine ? matchMedicine : solution ? matchSolution : false;
    });
    setSearchResults(filtered);
  };

  const selectedProductData = product_list.find(
    (product) => product._id === selectedProduct
  );

  return (
    <div className="search-page">
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
                placeholder="Search by salt/solution"
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
              />
            </div>
            <button type="submit" className="search-submit">
              Search
            </button>
          </div>
        </form>
      </div>

      <div className="search-results">
        <h3>
          Search Results{" "}
          {searchResults.length > 0 && `(${searchResults.length})`}
        </h3>
        <div className="results-grid">
          <div className="grid-left">
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <div className="all-medicine">
                  <p onClick={() => setSelectedProduct(item._id)}>
                    {item.name}
                  </p>
                </div>
              ))
            ) : (
              <div className="no-results">
                <img src={assets.search_icon} alt="" />
                <p>No products found matching your search criteria</p>
              </div>
            )}
          </div>
          <div className="grid-right">
            {selectedProductData ? (
              <div className="product-vieww">
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
                    <div className="product-view-rating">
                      <img src={assets.rating_starts} alt="rating" />
                      <p>(122)</p>
                    </div>
                    <div className="product-view-price">
                      <h2>${selectedProductData.price}</h2>
                      <p>{selectedProductData.description}</p>
                    </div>
                    <div className="product-view-category">
                      <span>Category:</span> {selectedProductData.category}
                    </div>
                    <div className="product-view-info">
                      <h3>Product Information</h3>
                      <p>
                        Lorem ipsum dolor sit amet consectetur adipisicing elit.
                        Maxime mollitia, molestiae quas vel sint commodi
                        repudiandae consequuntur voluptatum laborum numquam
                        blanditiis harum quisquam.
                      </p>
                    </div>
                    <div className="product-view-actions">
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              ""
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Search;
