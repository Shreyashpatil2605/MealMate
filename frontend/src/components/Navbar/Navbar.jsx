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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { getTotalCartAmount, token, setToken, food_list } =
    useContext(StoreContext);
  const navigate = useNavigate();

  // Filter food items based on search query
  const filteredFood = searchQuery
    ? food_list
        ?.filter(
          (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category?.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  const handleSearchClick = () => {
    setSearchOpen(!searchOpen);
    setSearchQuery("");
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      setSearchOpen(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const handleFoodClick = (item) => {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/search?q=${encodeURIComponent(item.name)}`);
  };

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
            setMenu("group-order");
            navigate("/group-order");
            window.scrollTo(0, 0);
          }}
          className={menu === "group-order" ? "active" : ""}
        >
          Group Order
        </li>
        <li className="navbar-dropdown">
          <span
            className={menu === "past-orders" ? "active" : ""}
            onClick={() => setMenu("past-orders")}
          >
            Past Orders ▾
          </span>
          <ul className="navbar-dropdown-menu">
            <li
              onClick={() => {
                navigate("/myorders");
                window.scrollTo(0, 0);
              }}
            >
              Your Order History
            </li>
          </ul>
        </li>
      </ul>
      <div className="navbar-right">
        <div className="search-container" style={{ position: "relative" }}>
          <img
            src={assets.search_icon}
            alt="Search"
            onClick={handleSearchClick}
            style={{ cursor: "pointer" }}
          />
          {searchOpen && (
            <div
              className="search-dropdown"
              style={{
                position: "absolute",
                bottom: "100%",
                left: "100%",
                width: "250px",
                background: "#1a1a1a",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                borderRadius: "8px",
                padding: "10px",
                zIndex: 1000,
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                marginLeft: "10px",
                marginBottom: "10px",
              }}
            >
              <input
                type="text"
                placeholder="Search food... (Press Enter)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoFocus
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  borderRadius: "6px",
                  background: "#2a2a2a",
                  color: "#fff",
                  outline: "none",
                  marginBottom: "10px",
                }}
              />
              {filteredFood.length > 0 ? (
                <div className="search-results">
                  {filteredFood.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => handleFoodClick(item)}
                      style={{
                        padding: "8px",
                        cursor: "pointer",
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <p style={{ margin: 0, color: "#fff", fontSize: "14px" }}>
                        {item.name}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "#22c55e",
                          fontSize: "12px",
                        }}
                      >
                        ₹{item.price}
                      </p>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <p style={{ color: "#999", fontSize: "12px", margin: 0 }}>
                  No items found
                </p>
              ) : null}
            </div>
          )}
        </div>
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
