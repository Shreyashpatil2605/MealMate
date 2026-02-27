import React, { useContext, useEffect, useState } from "react";
import "./Recommendations.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { assets } from "../../assets/frontend_assets/assets";

const Recommendations = () => {
  const { url, token } = useContext(StoreContext);
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState({ lat: 24.8607, lon: 67.0011 }); // Default: Karachi
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get user's geolocation
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
        console.log("Fetching recommendations with location:", location);
        const response = await axios.post(url + "/api/recommendation/get", {
          lat: location.lat,
          lon: location.lon,
          userId: token ? "user_id" : null,
        });

        console.log("Recommendations response:", response.data);

        if (response.data.success) {
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
  }, [url, location, token]);

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

  return (
    <div className="recommendations-container">
      <h1 className="recommendations-title">Smart Food Recommendations</h1>

      <div className="recommendations-context">
        <p className="context-message">{recommendations.contextMessage}</p>
      </div>

      {recommendations.userHistory &&
        recommendations.userHistory.length > 0 && (
          <div className="user-history">
            <h3>Your Favorites</h3>
            <div className="history-items">
              {recommendations.userHistory.map((food, index) => (
                <span key={index} className="history-tag">
                  {food}
                </span>
              ))}
            </div>
          </div>
        )}

      <div className="recommendations-grid">
        {recommendations.recommendations.map((food, index) => (
          <div key={index} className="recommendation-card">
            <div className="recommendation-header">
              <h3
                onClick={() =>
                  navigate(`/search?q=${encodeURIComponent(food)}`)
                }
                style={{ cursor: "pointer" }}
              >
                {food}
              </h3>
              <span className="recommendation-rank">#{index + 1}</span>
            </div>
            <p className="recommendation-reason">
              Perfect for {recommendations.timeOfDay} during{" "}
              {recommendations.weatherCondition} weather
            </p>
            <button
              className="recommendation-btn"
              onClick={() => navigate(`/search?q=${encodeURIComponent(food)}`)}
            >
              View in Search
            </button>
          </div>
        ))}
      </div>

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
    </div>
  );
};

export default Recommendations;
