import React from "react";
import "./Footer.css";
import { assets } from "../../assets/frontend_assets/assets";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <div className="footer" id="footer">
      <div className="footer-content">
        <div className="footer-content-left">
          <img src={assets.logo} alt="" />
          <p>The Best Choice</p>
          <div className="footer-social-icons">
            <img src={assets.facebook_icon} alt="" />
            <img src={assets.twitter_icon} alt="" />
            <img src={assets.linkedin_icon} alt="" />
          </div>
        </div>
        <div className="footer-content-center">
          <h2>Quick Links</h2>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/menu">Menu</Link>
            </li>
            <li>
              <Link to="/recommendations">Suggestions</Link>
            </li>
          </ul>
        </div>
        <div className="footer-content-right">
          <h2>Past Orders</h2>
          <ul>
            <li>
              <Link to="/myorders">Order History</Link>
            </li>
          </ul>
        </div>
        <div className="footer-content-contact">
          <h2>Contact Us</h2>
          <ul>
            <li>
              <Link to="/app-download">Mobile App</Link>
            </li>
            <li>
              <a href="mailto:contact@tomato.com">Contact Us</a>
            </li>
            <li>+92-308-4900522</li>
            <li>contact@tomato.com</li>
          </ul>
        </div>
      </div>
      <hr />
      <p className="footer-copyright">
        Copyright 2024 @ Tomato.com - All Right Reserved.
      </p>
    </div>
  );
};

export default Footer;
