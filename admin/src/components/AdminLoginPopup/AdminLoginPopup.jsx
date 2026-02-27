import React, { useState, useContext } from "react";
import "./AdminLoginPopup.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";

const AdminLoginPopup = ({ isVisible }) => {
  const { apiUrl, setToken, setAdmin } = useContext(StoreContext);
  const [email, setEmail] = useState("admin@food.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${apiUrl}/api/user/login`, {
        email,
        password,
      });

      if (response.data.success) {
        // Check if user is an admin (role should be "admin")
        if (response.data.role !== "admin") {
          toast.error("Only administrators can access this section");
          setPassword("");
          setLoading(false);
          return;
        }

        // Set authentication data
        setToken(response.data.token);
        setAdmin(true);
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("admin", "true");
        localStorage.setItem("adminName", response.data.name || "Admin");

        toast.success("Admin login successful!");
      } else {
        toast.error(response.data.message || "Login failed");
        setPassword("");
      }
    } catch (error) {
      console.error("Login error:", error);
      const errorMsg =
        error.response?.data?.message || "An error occurred during login";
      toast.error(errorMsg);
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="admin-login-overlay">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <h1>🍕 MealMate Admin</h1>
          <p>Administrator Access Required</p>
        </div>

        <form onSubmit={handleLogin} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter admin email"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="admin-login-btn" disabled={loading}>
            {loading ? "Logging in..." : "Login as Admin"}
          </button>
        </form>

        <div className="admin-login-info">
          <p>
            <strong>Demo Credentials:</strong>
          </p>
          <p>Email: admin@food.com</p>
          <p>Contact your administrator for access</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPopup;
