import React, { useContext, useState, useEffect } from "react";
import Navbar from "./components/Navbar/Navbar";
import Sidebar from "./components/Sidebar/Sidebar";
import { Route, Routes } from "react-router-dom";
import Add from "./pages/Add/Add";
import List from "./pages/List/List";
import Orders from "./pages/Orders/Orders";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminLoginPopup from "./components/AdminLoginPopup/AdminLoginPopup";
import { StoreContext } from "./context/StoreContext";

const App = () => {
  const url = "http://localhost:4000";
  const { token, admin } = useContext(StoreContext);
  const [showLoginPopup, setShowLoginPopup] = useState(!token || !admin);

  // Update login popup visibility when authentication state changes
  useEffect(() => {
    if (token && admin) {
      setShowLoginPopup(false);
    } else {
      setShowLoginPopup(true);
    }
  }, [token, admin]);

  // Show login popup if user is not authenticated as admin
  const isAuthenticatedAdmin = token && admin;

  return (
    <div>
      <ToastContainer />

      {/* Show login popup if not authenticated */}
      <AdminLoginPopup isVisible={showLoginPopup} />

      {/* Only show admin interface if authenticated */}
      {isAuthenticatedAdmin && (
        <>
          <Navbar />
          <hr />
          <div className="app-content">
            <Sidebar />
            <Routes>
              <Route path="/" element={<Add url={url} />} />
              <Route path="/add" element={<Add url={url} />} />
              <Route path="/list" element={<List url={url} />} />
              <Route path="/orders" element={<Orders url={url} />} />
            </Routes>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
