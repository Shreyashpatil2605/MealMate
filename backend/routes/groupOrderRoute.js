import express from "express";
import {
  createGroupOrder,
  joinGroupOrder,
  addItemToGroupOrder,
  removeItemFromGroupOrder,
  updateItemQuantity,
  getGroupOrderDetails,
  finalizeGroupOrder,
  leaveGroupOrder,
  shareGroupLinkSms,
  checkTwilioConfig,
  getChatMessages,
  completeGroupOrder,
} from "../controllers/groupOrderController.js";

const groupOrderRoute = express.Router();

groupOrderRoute.post("/create", createGroupOrder);
groupOrderRoute.post("/join", joinGroupOrder);
groupOrderRoute.post("/add-item", addItemToGroupOrder);
groupOrderRoute.post("/remove-item", removeItemFromGroupOrder);
groupOrderRoute.post("/update-quantity", updateItemQuantity);
groupOrderRoute.post("/details", getGroupOrderDetails);
groupOrderRoute.post("/finalize", finalizeGroupOrder);
groupOrderRoute.post("/complete", completeGroupOrder);
groupOrderRoute.post("/leave", leaveGroupOrder);
groupOrderRoute.post("/share-sms", shareGroupLinkSms);
groupOrderRoute.get("/check-twilio", checkTwilioConfig);
groupOrderRoute.post("/chat-messages", getChatMessages);

export default groupOrderRoute;
