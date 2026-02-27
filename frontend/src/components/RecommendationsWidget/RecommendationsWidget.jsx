import React, { useContext, useEffect, useState } from "react";
import "./RecommendationsWidget.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const RecommendationsWidget = () => {
  const { url, token, food_list, addToCart } = useContext(StoreContext);
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState({ lat: 24.8607, lon: 67.0011 });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        () => {},
      );
    }
  }, []);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await axios.post(url + "/api/recommendation/get", {
          lat: location.lat,
          lon: location.lon,
        });
        if (response.data.success) {
          setRecommendations(response.data.data);
        }
      } catch (err) {
        console.error(
          "Widget error fetching recommendations:",
          err.response || err.message,
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [url, location]);

  if (loading || !recommendations) return null;

  // Find food items matching recommendations
  const recommendedItems = recommendations.recommendations
    .slice(0, 4)
    .map((recommendation) =>
      food_list.find(
        (f) => f.name.toLowerCase() === recommendation.name.toLowerCase(),
      ),
    )
    .filter(Boolean);

  return (
    <div className="recommendations-widget">
      <div className="widget-header">
        <h3>Smart Suggestions</h3>
        <p className="widget-context">{recommendations.contextMessage}</p>
      </div>

      <div className="widget-items">
        {recommendedItems.map((item) => (
          <div key={item._id} className="widget-item">
            <div className="item-info">
              <h4>{item.name}</h4>
              <p className="item-category">{item.category}</p>
              <p className="item-price">${item.price}</p>
            </div>
            <button
              className="widget-add-btn"
              onClick={() => addToCart(item._id)}
            >
              +
            </button>
          </div>
        ))}
      </div>

      <button
        className="widget-view-all"
        onClick={() => navigate("/recommendations")}
      >
        View All Recommendations →
      </button>
    </div>
  );
};

export default RecommendationsWidget;
