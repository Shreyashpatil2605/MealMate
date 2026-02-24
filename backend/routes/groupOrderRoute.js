import express from "express";
import {
  createGroupOrder,
  joinGroupOrder,
  addItemToGroupOrder,
  removeItemFromGroupOrder,
  getGroupOrderDetails,
  finalizeGroupOrder,
  leaveGroupOrder,
  shareGroupLinkSms,
} from "../controllers/groupOrderController.js";

const groupOrderRoute = express.Router();

groupOrderRoute.post("/create", createGroupOrder);
groupOrderRoute.post("/join", joinGroupOrder);
groupOrderRoute.post("/add-item", addItemToGroupOrder);
groupOrderRoute.post("/remove-item", removeItemFromGroupOrder);
groupOrderRoute.post("/details", getGroupOrderDetails);
groupOrderRoute.post("/finalize", finalizeGroupOrder);
groupOrderRoute.post("/leave", leaveGroupOrder);
groupOrderRoute.post("/share-sms", shareGroupLinkSms);

export default groupOrderRoute;
