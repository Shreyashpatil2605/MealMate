import React, { useContext, useEffect, useState } from "react";
import "./Recommendations.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const Recommendations = () => {
  const { url, token, userData } = useContext(StoreContext);
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState({ lat: 24.8607, lon: 67.0011 });
  const [error, setError] = useState(null);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

  // Dietary preference options
  const dietaryOptions = [
    { id: "vegetarian", label: "Vegetarian" },
    { id: "vegan", label: "Vegan" },
    { id: "gluten-free", label: " Gluten-Free" },
    { id: "dairy-free", label: " Dairy-Free" },
    { id: "nut-free", label: " Nut-Free" },
    { id: "halal", label: " Halal" },
    { id: "kosher", label: " Kosher" },
  ];

  const [selectedPreferences, setSelectedPreferences] = useState([]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (err) => {
          console.log("Geolocation error, using default:", err);
        },
      );
    }
  }, []);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        const response = await axios.post(url + "/api/recommendation/get", {
          lat: location.lat,
          lon: location.lon,
          userId: userData?._id || null,
          limit: 12,
        });

        if (response.data.success) {
          console.log("Recommendations API response:", response.data.data);
          console.log("Recently viewed:", response.data.data.recentlyViewed);
          setRecommendations(response.data.data);
          setError(null);
        } else {
          setError(response.data.message || "Failed to load recommendations");
        }
      } catch (err) {
        console.error(
          "Error fetching recommendations:",
          err.response || err.message,
        );
        setError(
          err.response?.data?.message || "Error loading recommendations",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [url, location, userData?._id]);

  // Handle preference selection
  const handlePreferenceToggle = (prefId) => {
    setSelectedPreferences((prev) =>
      prev.includes(prefId)
        ? prev.filter((p) => p !== prefId)
        : [...prev, prefId],
    );
  };

  // Save dietary preferences
  const savePreferences = async () => {
    try {
      // Check if user is logged in
      if (!token) {
        toast.error("Please login to save preferences");
        return;
      }

      if (selectedPreferences.length === 0) {
        toast.warning("Please select at least one preference");
        return;
      }

      // Use token from context to identify user
      const response = await axios.post(
        url + "/api/recommendation/preferences",
        {
          preferences: selectedPreferences,
        },
        {
          headers: {
            token: token, // Send token in header instead of userId in body
          },
        },
      );

      if (response.data.success) {
        toast.success("Preferences saved successfully!");
        setShowPreferencesModal(false);
        // Refresh recommendations after 500ms to show updated preferences
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        toast.error(response.data.message || "Failed to save preferences");
      }
    } catch (err) {
      console.error("Error saving preferences:", err);
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Error saving preferences";
      toast.error(errorMsg);
    }
  };

  // Track food view
  const handleFoodClick = async (foodId) => {
    if (userData?._id && foodId) {
      try {
        console.log(
          "Tracking food view - foodId:",
          foodId,
          "userId:",
          userData._id,
        );
        const trackResponse = await axios.post(
          url + "/api/recommendation/track-view",
          {
            userId: userData._id,
            foodId,
          },
        );
        console.log("Track response:", trackResponse.data);
      } catch (err) {
        console.error("Error tracking view:", err);
      }
    } else {
      console.log("Cannot track view - userData or foodId missing", {
        userId: userData?._id,
        foodId,
      });
    }
  };

  if (loading) {
    return (
      <div className="recommendations-container">
        <div className="loading">Loading recommendations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="recommendations-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!recommendations) {
    return null;
  }

  const {
    recommendations: recs,
    isNewUser,
    dietaryPreferences,
    recentlyViewed,
  } = recommendations;
  // Render recently viewed section
  const renderRecentlyViewed = () => {
    console.log("Recently viewed data:", recentlyViewed);
    if (!recentlyViewed || recentlyViewed.length === 0) {
      console.log("No recently viewed items to display");
      return null;
    }
    return (
      <div className="recently-viewed-section">
        <h3>👀 Recently Viewed</h3>
        <div className="recently-viewed-grid">
          {recentlyViewed.map((item, idx) => (
            <div key={item._id || idx} className="recently-viewed-card">
              <div className="recently-viewed-image">
                {item.image ? (
                  <img src={url + "/images/" + item.image} alt={item.name} />
                ) : (
                  <div className="food-placeholder">🍽️</div>
                )}
              </div>
              <div className="recently-viewed-content">
                <h4
                  onClick={() => {
                    handleFoodClick(item._id);
                    navigate(`/search?q=${encodeURIComponent(item.name)}`);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {item.name}
                </h4>
                {item.price && <p className="food-price">₹{item.price}</p>}
                {item.rating > 0 && (
                  <span className="rating-badge">
                    ⭐ {item.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="recommendations-container">
      <h1 className="recommendations-title">Smart Food Recommendations</h1>

      {/* Cold-start handling - New user welcome */}
      {isNewUser && (
        <div className="cold-start-banner">
          <div className="cold-start-content">
            <h2>👋 Welcome! Let's personalize your experience</h2>
            <p>Set your dietary preferences to get better recommendations</p>
            <button
              className="cold-start-btn"
              onClick={() => {
                if (!token) {
                  toast.warning("Please login first to set preferences");
                  return;
                }
                setShowPreferencesModal(true);
              }}
            >
              Set Preferences
            </button>
          </div>
        </div>
      )}

      {/* Context message */}
      <div className="recommendations-context">
        <p className="context-message">{recommendations.contextMessage}</p>
      </div>

      {/* User's dietary preferences display */}
      {dietaryPreferences && dietaryPreferences.length > 0 && (
        <div className="user-preferences">
          <span className="preferences-label">Your preferences:</span>
          {dietaryPreferences.map((pref) => (
            <span key={pref} className="preference-badge">
              {pref}
            </span>
          ))}
        </div>
      )}

      {/* User order history */}
      {recommendations.userHistory &&
        recommendations.userHistory.length > 0 && (
          <div className="user-history">
            <h3>⭐ Your Favorites</h3>
            <div className="history-items">
              {recommendations.userHistory.map((food, index) => (
                <span key={index} className="history-tag">
                  {food}
                </span>
              ))}
            </div>
          </div>
        )}

      {/* Recently Viewed Section */}
      {renderRecentlyViewed()}

      {/* Recommendations grid */}
      <div className="recommendations-grid">
        {recs &&
          recs.map((item, index) => {
            // Handle both string and object recommendations
            const foodName = typeof item === "string" ? item : item.name;
            const foodId = typeof item === "object" ? item._id : null;
            const foodPrice = typeof item === "object" ? item.price : null;
            const foodImage = typeof item === "object" ? item.image : null;
            const foodRating = typeof item === "object" ? item.rating : 0;
            const reasons =
              typeof item === "object" && item.reasons ? item.reasons : [];

            return (
              <div key={index} className="recommendation-card">
                <div className="recommendation-image">
                  {foodImage ? (
                    <img src={url + "/images/" + foodImage} alt={foodName} />
                  ) : (
                    <div className="food-placeholder">🍽️</div>
                  )}
                  <span className="recommendation-rank">#{index + 1}</span>
                  {foodRating > 0 && (
                    <span className="rating-badge">
                      ⭐ {foodRating.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="recommendation-content">
                  <h3
                    onClick={() => {
                      handleFoodClick(foodId);
                      navigate(`/search?q=${encodeURIComponent(foodName)}`);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {foodName}
                  </h3>
                  {foodPrice && <p className="food-price">₹{foodPrice}</p>}

                  {/* Explainable reasons */}
                  <div className="recommendation-reasons">
                    {reasons.length > 0 ? (
                      reasons.slice(0, 2).map((reason, idx) => (
                        <span key={idx} className="reason-tag">
                          {reason}
                        </span>
                      ))
                    ) : (
                      <span className="reason-tag">
                        Perfect for {recommendations.timeOfDay}
                      </span>
                    )}
                  </div>

                  <button
                    className="recommendation-btn"
                    onClick={() => {
                      handleFoodClick(foodId);
                      navigate(`/search?q=${encodeURIComponent(foodName)}`);
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Weather info */}
      <div className="recommendations-weather">
        {recommendations.weatherData && (
          <div className="weather-info">
            <h4>Current Weather</h4>
            <p>
              <strong>Condition:</strong> {recommendations.weatherData.main}
            </p>
            <p>
              <strong>Temperature:</strong> {recommendations.temperature}°C
            </p>
            <p>
              <strong>Description:</strong>{" "}
              {recommendations.weatherData.description}
            </p>
          </div>
        )}
      </div>

      {/* Dietary preferences modal for cold-start */}
      {showPreferencesModal && (
        <div className="preferences-modal-overlay">
          <div className="preferences-modal">
            <h2>🍽️ Set Your Dietary Preferences</h2>
            {!token ? (
              <div className="login-required-message">
                <p>Please login to save your dietary preferences</p>
                <button
                  className="skip-btn"
                  onClick={() => setShowPreferencesModal(false)}
                >
                  OK
                </button>
              </div>
            ) : (
              <>
                <p>Select all that apply to you:</p>
                <div className="preferences-options">
                  {dietaryOptions.map((option) => (
                    <label key={option.id} className="preference-option">
                      <input
                        type="checkbox"
                        checked={selectedPreferences.includes(option.id)}
                        onChange={() => handlePreferenceToggle(option.id)}
                      />
                      <span className="option-icon">{option.icon}</span>
                      <span className="option-label">{option.label}</span>
                    </label>
                  ))}
                </div>
                <div className="modal-actions">
                  <button
                    className="skip-btn"
                    onClick={() => setShowPreferencesModal(false)}
                  >
                    Skip
                  </button>
                  <button className="save-btn" onClick={savePreferences}>
                    Save Preferences
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Recommendations;
