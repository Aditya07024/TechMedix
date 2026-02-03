
import React from "react";
import "./Sidebar.css";
import { NavLink } from "react-router-dom";

const Sidebar = ({ active, setActive }) => {
  return (
    <div className="upload-sidebar">
      <h3>Menu</h3>

      <ul>
        <NavLink
          to="/upload-prescription"
          
        >
          Upload Prescription
        </NavLink>
      </ul>
    </div>
  );
};

export default Sidebar;
