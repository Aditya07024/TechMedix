import React, { useState } from "react";
import "./SearchBar.css";
import { useNavigate } from "react-router-dom";
import Button from '@mui/material/Button';
import Aipop from "../AiPop/Aipop";
import next from "../../assets/next.png";

const SearchBar = () => {
  const [medicine, setMedicine] = useState("");
  const [solution, setSolution] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!medicine && !solution) {
      alert("Please enter either medicine name or solution");
      return;
    }
    navigate("/search", { state: { medicine, solution } });
  };

  return (
    <div className="main">
      
      <div className="box" id="search-for-medicine">
        
        <form className="search-box" onSubmit={handleSubmit}>
          <h3>Search and Select your medicine to Search</h3>
          <div className="search-inputs">
            <div className="search-by-medicine">
              <input
                type="text"
                placeholder="Name of medicine"
                value={medicine}
                onChange={(e) => setMedicine(e.target.value)}
              />
            </div>
            
          </div>

          <button type="submit" className="search-btn">
            Search &gt;
          </button>
        </form>
        <div className="right-div">
              <img
                src={next}
                alt="medicine icon"
                className="medicine-icon"
              />
              
            </div>
      </div>
      
    </div>
  );
};

export default SearchBar;
