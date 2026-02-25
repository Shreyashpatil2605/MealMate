import React, { useEffect } from "react";
import "./WelcomePopup.css";
import { assets } from "../../assets/frontend_assets/assets";

const WelcomePopup = ({ userName, onClose }) => {
  useEffect(() => {
    // Auto close after 3 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="welcome-overlay">
      <div className="welcome-popup">
        <div className="welcome-icon">
          <img src={assets.parcel_icon || assets.order_icon} alt="welcome" />
        </div>
        <div className="welcome-content">
          <h2>Welcome! 👋</h2>
          <p>
            Welcome back, <span className="user-name">{userName}</span>!
          </p>
          <p className="welcome-message">
            Happy to have you here. Enjoy your food!
          </p>
        </div>
        <button className="welcome-close-btn" onClick={onClose}>
          Let's Eat! 🍕
        </button>
      </div>
    </div>
  );
};

export default WelcomePopup;
