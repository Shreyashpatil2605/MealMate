import express from "express";
import { getRecommendations } from "../controllers/recommendationController.js";

const recommendationRoute = express.Router();

recommendationRoute.post("/get", getRecommendations);

export default recommendationRoute;
