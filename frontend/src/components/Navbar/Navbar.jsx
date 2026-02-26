import React, { useContext, useState } from "react";
import "./Navbar.css";
import { assets } from "../../assets/frontend_assets/assets";
import { Link, useNavigate } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";

const Navbar = ({ setShowLogin }) => {
  const [menu, setMenu] = useState("home");
  const [collapsed, setCollapsed] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const { getTotalCartAmount, token, setToken } = useContext(StoreContext);
  const navigate = useNavigate();

  // add/remove class on body so parent .app can adjust
  React.useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
  }, [collapsed]);

  // close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".navbar-profile")) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    toast.success("Logout Successfully");
    navigate("/");
  };

  return (
    <div className={`navbar ${collapsed ? "collapsed" : ""}`}>
      {/* toggle button */}
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? "›" : "‹"}
      </button>

      <Link to="/">
        <img src={assets.logo} alt="" className="logo" />
      </Link>
      <ul className="navbar-menu">
        <li
          onClick={() => {
            setMenu("home");
            navigate("/");
            window.scrollTo(0, 0);
          }}
          className={menu === "home" ? "active" : ""}
        >
          home
        </li>
        <li>
          <a
            href="#explore-menu"
            onClick={() => setMenu("menu")}
            className={menu === "menu" ? "active" : ""}
          >
            menu
          </a>
        </li>
        <li
          onClick={() => {
            setMenu("recommendations");
            navigate("/recommendations");
            window.scrollTo(0, 0);
          }}
          className={menu === "recommendations" ? "active" : ""}
        >
          suggestions
        </li>
        <li
          onClick={() => {
            setMenu("group");
            navigate("/group-order");
            window.scrollTo(0, 0);
          }}
          className={menu === "group" ? "active" : ""}
        >
          group order
        </li>
        <li>
          <a
            href="#app-download"
            onClick={() => setMenu("mobile-app")}
            className={menu === "mobile-app" ? "active" : ""}
          >
            mobile-app
          </a>
        </li>
        <li>
          <a
            href="#footer"
            onClick={() => setMenu("contact-us")}
            className={menu === "contact-us" ? "active" : ""}
          >
            contact us
          </a>
        </li>
        <li className="navbar-dropdown">
          <span className={menu === "past-orders" ? "active" : ""} onClick={() => setMenu("past-orders")}>
            Past Orders ▾
          </span>
          <ul className="navbar-dropdown-menu">
            <li onClick={() => {
              navigate("/myorders");
              window.scrollTo(0, 0);
            }}>Your Order History</li>
            <li onClick={() => {
              navigate("/group-order");
              window.scrollTo(0, 0);
            }}>Your Group Orders History</li>
          </ul>
        </li>
      </ul>
      <div className="navbar-right">
        <img src={assets.search_icon} alt="" />
        <div className="navbar-search-icon">
          <Link to="/cart">
            <img src={assets.basket_icon} alt="" />
          </Link>
          <div className={getTotalCartAmount() === 0 ? "" : "dot"}></div>
        </div>
        {!token ? (
          <button onClick={() => setShowLogin(true)}>sign in</button>
        ) : (
          <div
            className="navbar-profile"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
          >
            <img src={assets.profile_icon} alt="" />
            <ul
              className={`nav-profile-dropdown ${profileDropdownOpen ? "active" : ""}`}
            >
              <li
                onClick={() => {
                  navigate("/myorders");
                  setProfileDropdownOpen(false);
                }}
              >
                {" "}
                <img src={assets.bag_icon} alt="" />
                <p>Orders</p>
              </li>
              <hr />
              <li
                onClick={() => {
                  logout();
                  setProfileDropdownOpen(false);
                }}
              >
                {" "}
                <img src={assets.logout_icon} alt="" />
                <p>Logout</p>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;
