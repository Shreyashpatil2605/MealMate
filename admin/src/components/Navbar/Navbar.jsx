import React, { useContext } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";

const Navbar = () => {
  return (
    <div className="navbar">
      <img className="logo" src={assets.logo} alt="" />
      <div className="admin-title">MealMate Admin Panel</div>
      <img className="profile" src={assets.profile_image} alt="" />
    </div>
  );
};

export default Navbar;
