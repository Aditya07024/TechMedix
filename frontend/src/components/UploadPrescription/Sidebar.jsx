
import React from "react";
import "./Sidebar.css";
import { NavLink } from "react-router-dom";
import { FileText, LayoutGrid } from "lucide-react";

const Sidebar = () => {
  return (
    <aside className="upload-sidebar">
      <div className="upload-sidebar-brand">
        <LayoutGrid size={18} strokeWidth={2} />
        <span>Prescription Desk</span>
      </div>

      <nav className="upload-sidebar-menu">
        <NavLink
          to="/upload-prescription"
          className={({ isActive }) =>
            `upload-sidebar-item ${isActive ? "active" : ""}`
          }
        >
          <FileText size={18} strokeWidth={2} />
          <span>Upload Prescription</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
