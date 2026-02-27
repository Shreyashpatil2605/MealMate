import express from "express";
import {
  getRecommendations,
  trackRecentlyViewed,
  getPopularItems,
  updateDietaryPreferences,
} from "../controllers/recommendationController.js";

const recommendationRoute = express.Router();

// Main recommendation endpoint
recommendationRoute.post("/get", getRecommendations);

// Track recently viewed items
recommendationRoute.post("/track-view", trackRecentlyViewed);

// Get popular items
recommendationRoute.get("/popular", getPopularItems);

// Update dietary preferences
recommendationRoute.post("/preferences", updateDietaryPreferences);

export default recommendationRoute;
