
import React, { useState } from "react";
import "./Sidebar.css";
import { NavLink } from "react-router-dom";
import { FileText, LayoutGrid, Menu, X } from "lucide-react";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="upload-sidebar-toggle"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={isOpen ? "Close prescription menu" : "Open prescription menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={18} strokeWidth={2.2} /> : <Menu size={18} strokeWidth={2.2} />}
        <span>Menu</span>
      </button>

      {isOpen ? (
        <button
          type="button"
          className="upload-sidebar-backdrop"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu overlay"
        />
      ) : null}

      <aside className={`upload-sidebar ${isOpen ? "open" : ""}`}>
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
            onClick={() => setIsOpen(false)}
          >
            <FileText size={18} strokeWidth={2} />
            <span>Upload Prescription</span>
          </NavLink>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
