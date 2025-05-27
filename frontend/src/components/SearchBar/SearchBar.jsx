import React, { useState } from "react";
import "./SearchBar.css";
import { useNavigate } from "react-router-dom";

const SearchBar = () => {
  const [medicine, setMedicine] = useState("");
  const [solution, setSolution] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate("/search", { state: { medicine, solution } });
  };

  return (
    <div className="box" id="search-for-medicine">
      <h3>Search your medicine</h3>
      <form className="search-box" onSubmit={handleSubmit}>
        <div className="search-inputs">
          <div className="search-by-medicine">
            <input
              type="text"
              placeholder="Name of medicine"
              value={medicine}
              onChange={(e) => setMedicine(e.target.value)}
            />
          </div>
          <p>or</p>
          <div className="search-by-salt">
            <input
              type="text"
              placeholder="Name of Solution"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="search-btn">
          Search &gt;
        </button>
      </form>
    </div>
  );
};

export default SearchBar;
