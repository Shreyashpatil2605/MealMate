import express from "express";
import {
  initializePaymentCoordination,
  getPaymentCoordinationStatus,
  updatePaymentStatus,
  sendPaymentReminder,
  getPaymentHistory,
  getPaymentBreakdown,
  reconcilePayments,
} from "../controllers/paymentCoordinationController.js";

const paymentCoordinationRoute = express.Router();

// Initialize payment coordination for a group order
paymentCoordinationRoute.post("/initialize", initializePaymentCoordination);

// Get payment coordination status
paymentCoordinationRoute.post("/status", getPaymentCoordinationStatus);

// Update payment status (when payment is completed/failed)
paymentCoordinationRoute.post("/update-status", updatePaymentStatus);

// Send payment reminder to a user
paymentCoordinationRoute.post("/send-reminder", sendPaymentReminder);

// Get payment history and logs
paymentCoordinationRoute.post("/history", getPaymentHistory);

// Get detailed payment breakdown per user
paymentCoordinationRoute.post("/breakdown", getPaymentBreakdown);

// Reconcile all payments (verify with Stripe, etc.)
paymentCoordinationRoute.post("/reconcile", reconcilePayments);

export default paymentCoordinationRoute;
