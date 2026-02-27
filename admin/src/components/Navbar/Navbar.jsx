import React, { useContext } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const Navbar = () => {
  const { setToken, setAdmin } = useContext(StoreContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear authentication data
    localStorage.removeItem("token");
    localStorage.removeItem("admin");
    localStorage.removeItem("adminName");
    setToken("");
    setAdmin(false);
    toast.success("Logged out successfully");
    // Reload page to show login popup
    window.location.href = "/";
  };

  return (
    <div className="navbar">
      <img className="logo" src={assets.logo} alt="" />
      <div className="admin-title">🍕 MealMate Admin Panel</div>
      <div className="navbar-actions">
        <button className="logout-btn" onClick={handleLogout} title="Logout">
          🚪 Logout
        </button>
        <img className="profile" src={assets.profile_image} alt="" />
      </div>
    </div>
  );
};

export default Navbar;
