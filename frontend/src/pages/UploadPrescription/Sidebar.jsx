import React from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const Sidebar = () => {
  return (
    <div className="sidebar">
      <h2 className="sidebar-title">Prescription</h2>

      <nav className="sidebar-menu">
        <NavLink
          to="/prescription-details"
          className={({ isActive }) =>
            isActive ? "sidebar-item active" : "sidebar-item"
          }
        >
          Prescription Details
        </NavLink>

        {/* <NavLink
          to="/safety-report"
          className={({ isActive }) =>
            isActive ? "sidebar-item active" : "sidebar-item"
          }
        >
          Safety Report
        </NavLink> */}
      </nav>
    </div>
  );
};

export default Sidebar;
