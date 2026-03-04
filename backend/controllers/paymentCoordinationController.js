import paymentCoordinationModel from "../models/paymentCoordinationModel.js";
import groupOrderModel from "../models/groupOrderModel.js";
import orderModel from "../models/orderModel.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper to emit real-time socket updates
const emitPaymentUpdate = (io, groupCode, event, data) => {
  if (io) {
    io.to(groupCode).emit(event, data);
  }
};

// Initialize payment coordination for a group order
const initializePaymentCoordination = async (req, res) => {
  try {
    const { groupCode, splitMethod = "equal", totalAmount } = req.body;

    if (!groupCode || !totalAmount) {
      return res.json({
        success: false,
        message: "Group code and total amount required",
      });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });
    if (!groupOrder) {
      return res.json({
        success: false,
        message: "Group order not found",
      });
    }

    // Check if coordination already exists
    let paymentCoord = await paymentCoordinationModel.findOne({ groupCode });
    if (paymentCoord) {
      return res.json({
        success: false,
        message: "Payment coordination already initialized",
      });
    }

    // Calculate split amounts based on method
    const memberCount = groupOrder.members.length;
    const splitAmounts = calculateSplitAmounts(
      totalAmount,
      groupOrder.items,
      splitMethod,
      groupOrder.members,
    );

    // Create payment entries for each member
    const payments = Object.entries(splitAmounts).map(([userId, amount]) => {
      const member = groupOrder.members.find((m) => m.userId === userId);
      return {
        userId,
        userName: member?.userName || "Unknown",
        email: member?.email || "",
        phoneNumber: member?.phoneNumber || "",
        amount,
        status: "pending",
        paymentMethod: "stripe",
      };
    });

    const newPaymentCoord = new paymentCoordinationModel({
      groupCode,
      groupOrderId: groupOrder._id,
      totalAmount,
      splitMethod,
      payments,
      status: "initiated",
      settlementDetails: {
        startedAt: new Date(),
      },
    });

    await newPaymentCoord.save();

    // Emit socket event
    const io = req.app.get("io");
    emitPaymentUpdate(io, groupCode, "payment-coordination-initialized", {
      groupCode,
      coordination: newPaymentCoord,
      splitAmounts,
    });

    return res.json({
      success: true,
      message: "Payment coordination initialized",
      data: {
        coordination: newPaymentCoord,
        splitAmounts,
      },
    });
  } catch (error) {
    console.error("Error initializing payment coordination:", error);
    return res.json({
      success: false,
      message: "Error initializing payment coordination",
    });
  }
};

// Calculate split amounts based on split method
const calculateSplitAmounts = (totalAmount, items, splitMethod, members) => {
  const splitAmounts = {};

  if (splitMethod === "equal") {
    // Equal split among all members
    const perPersonAmount =
      Math.round((totalAmount / members.length) * 100) / 100;
    members.forEach((member) => {
      splitAmounts[member.userId] = perPersonAmount;
    });
  } else if (splitMethod === "proportional") {
    // Split based on items ordered by each person
    const userTotals = {};
    items.forEach((item) => {
      if (!userTotals[item.userId]) {
        userTotals[item.userId] = 0;
      }
      userTotals[item.userId] += (item.price || 0) * (item.quantity || 1);
    });

    members.forEach((member) => {
      const userTotal = userTotals[member.userId] || 0;
      splitAmounts[member.userId] = userTotal;
    });
  } else if (splitMethod === "custom") {
    // Placeholder for custom split logic
    const perPersonAmount =
      Math.round((totalAmount / members.length) * 100) / 100;
    members.forEach((member) => {
      splitAmounts[member.userId] = perPersonAmount;
    });
  }

  return splitAmounts;
};

// Get payment coordination status
const getPaymentCoordinationStatus = async (req, res) => {
  try {
    const { groupCode } = req.body;

    if (!groupCode) {
      return res.json({
        success: false,
        message: "Group code required",
      });
    }

    const coordination = await paymentCoordinationModel.findOne({ groupCode });

    if (!coordination) {
      return res.json({
        success: false,
        message: "Payment coordination not found",
      });
    }

    // Calculate stats
    const stats = {
      ...coordination.toObject(),
      stats: {
        totalPayments: coordination.payments.length,
        completedPayments: coordination.payments.filter(
          (p) => p.status === "completed",
        ).length,
        pendingPayments: coordination.payments.filter(
          (p) => p.status === "pending",
        ).length,
        failedPayments: coordination.payments.filter(
          (p) => p.status === "failed",
        ).length,
        processingPayments: coordination.payments.filter(
          (p) => p.status === "processing",
        ).length,
        completedAmount: coordination.payments
          .filter((p) => p.status === "completed")
          .reduce((sum, p) => sum + (p.amount || 0), 0),
        pendingAmount: coordination.payments
          .filter((p) => p.status === "pending")
          .reduce((sum, p) => sum + (p.amount || 0), 0),
        completionPercentage: Math.round(
          (coordination.payments.filter((p) => p.status === "completed")
            .length /
            coordination.payments.length) *
            100,
        ),
      },
    };

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting payment status:", error);
    return res.json({
      success: false,
      message: "Error getting payment status",
    });
  }
};

// Update payment status
const updatePaymentStatus = async (req, res) => {
  try {
    const { groupCode, userId, status, transactionId, receiptUrl } = req.body;

    if (!groupCode || !userId || !status) {
      return res.json({
        success: false,
        message: "Group code, user ID, and status required",
      });
    }

    const coordination = await paymentCoordinationModel.findOne({ groupCode });

    if (!coordination) {
      return res.json({
        success: false,
        message: "Payment coordination not found",
      });
    }

    // Find and update the payment
    const paymentIndex = coordination.payments.findIndex(
      (p) => p.userId === userId,
    );

    if (paymentIndex === -1) {
      return res.json({
        success: false,
        message: "Payment record not found",
      });
    }

    // Update payment status
    coordination.payments[paymentIndex].status = status;

    if (status === "completed") {
      coordination.payments[paymentIndex].completedAt = new Date();
      coordination.payments[paymentIndex].transactionId = transactionId;
      coordination.payments[paymentIndex].receiptUrl = receiptUrl;
    }

    if (status === "failed") {
      coordination.payments[paymentIndex].failureReason =
        req.body.failureReason || "Unknown error";
    }

    // Update coordination status
    const allCompleted = coordination.payments.every(
      (p) => p.status === "completed",
    );
    const anyCompleted = coordination.payments.some(
      (p) => p.status === "completed",
    );
    const anyFailed = coordination.payments.some((p) => p.status === "failed");

    if (allCompleted) {
      coordination.status = "completed";
      coordination.settlementDetails.completedAt = new Date();
      coordination.settlementDetails.allPaymentsReceived = true;
    } else if (anyCompleted) {
      coordination.status = "in-progress";
    }

    // Calculate completion percentage
    const completedCount = coordination.payments.filter(
      (p) => p.status === "completed",
    ).length;
    coordination.completionPercentage = Math.round(
      (completedCount / coordination.payments.length) * 100,
    );

    // Add to activity log
    coordination.activityLog.push({
      action: "status_update",
      userId,
      userName: coordination.payments[paymentIndex].userName,
      details: { status, transactionId },
    });

    await coordination.save();

    // Emit socket event for real-time update
    const io = req.app.get("io");
    emitPaymentUpdate(io, groupCode, "payment-status-updated", {
      groupCode,
      userId,
      status,
      completionPercentage: coordination.completionPercentage,
      overallStatus: coordination.status,
    });

    return res.json({
      success: true,
      message: "Payment status updated",
      data: {
        coordination,
        completionPercentage: coordination.completionPercentage,
      },
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return res.json({
      success: false,
      message: "Error updating payment status",
    });
  }
};

// Send payment reminder
const sendPaymentReminder = async (req, res) => {
  try {
    const { groupCode, userId } = req.body;

    if (!groupCode || !userId) {
      return res.json({
        success: false,
        message: "Group code and user ID required",
      });
    }

    const coordination = await paymentCoordinationModel.findOne({ groupCode });

    if (!coordination) {
      return res.json({
        success: false,
        message: "Payment coordination not found",
      });
    }

    const paymentIndex = coordination.payments.findIndex(
      (p) => p.userId === userId,
    );

    if (paymentIndex === -1) {
      return res.json({
        success: false,
        message: "Payment record not found",
      });
    }

    const payment = coordination.payments[paymentIndex];

    if (payment.status === "completed") {
      return res.json({
        success: false,
        message: "Payment already completed",
      });
    }

    // Update reminder count and timestamp
    payment.reminderCount = (payment.reminderCount || 0) + 1;
    payment.lastReminderSentAt = new Date();

    // Add to notification log
    coordination.notificationLog.push({
      userId,
      userName: payment.userName,
      type: "reminder",
      message: `Payment reminder sent. Amount: ${payment.amount}`,
      delivered: true,
    });

    // Add to activity log
    coordination.activityLog.push({
      action: "reminder_sent",
      userId,
      userName: payment.userName,
      details: { reminderCount: payment.reminderCount, amount: payment.amount },
    });

    await coordination.save();

    // Emit socket event
    const io = req.app.get("io");
    emitPaymentUpdate(io, groupCode, "payment-reminder-sent", {
      groupCode,
      userId,
      amount: payment.amount,
      reminderCount: payment.reminderCount,
    });

    return res.json({
      success: true,
      message: "Payment reminder sent",
      data: {
        payment,
        reminderCount: payment.reminderCount,
      },
    });
  } catch (error) {
    console.error("Error sending payment reminder:", error);
    return res.json({
      success: false,
      message: "Error sending payment reminder",
    });
  }
};

// Get payment history
const getPaymentHistory = async (req, res) => {
  try {
    const { groupCode } = req.body;

    if (!groupCode) {
      return res.json({
        success: false,
        message: "Group code required",
      });
    }

    const coordination = await paymentCoordinationModel.findOne({ groupCode });

    if (!coordination) {
      return res.json({
        success: false,
        message: "Payment coordination not found",
      });
    }

    return res.json({
      success: true,
      data: {
        paymentHistory: coordination.paymentHistory || [],
        activityLog: coordination.activityLog || [],
        notificationLog: coordination.notificationLog || [],
      },
    });
  } catch (error) {
    console.error("Error getting payment history:", error);
    return res.json({
      success: false,
      message: "Error getting payment history",
    });
  }
};

// Get detailed payment breakdown
const getPaymentBreakdown = async (req, res) => {
  try {
    const { groupCode } = req.body;

    if (!groupCode) {
      return res.json({
        success: false,
        message: "Group code required",
      });
    }

    const coordination = await paymentCoordinationModel.findOne({ groupCode });
    const groupOrder = await groupOrderModel.findOne({ groupCode });

    if (!coordination || !groupOrder) {
      return res.json({
        success: false,
        message: "Group order or coordination not found",
      });
    }

    const breakdown = {
      totalAmount: coordination.totalAmount,
      splitMethod: coordination.splitMethod,
      members: groupOrder.members.map((member) => {
        const payment = coordination.payments.find(
          (p) => p.userId === member.userId,
        );
        const items = groupOrder.items.filter(
          (item) => item.userId === member.userId,
        );

        return {
          userId: member.userId,
          userName: member.userName,
          amount: payment?.amount || 0,
          status: payment?.status || "pending",
          items,
          itemCount: items.length,
          itemTotal: items.reduce(
            (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
            0,
          ),
        };
      }),
    };

    return res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    console.error("Error getting payment breakdown:", error);
    return res.json({
      success: false,
      message: "Error getting payment breakdown",
    });
  }
};

// Handle payment reconciliation
const reconcilePayments = async (req, res) => {
  try {
    const { groupCode } = req.body;

    if (!groupCode) {
      return res.json({
        success: false,
        message: "Group code required",
      });
    }

    const coordination = await paymentCoordinationModel.findOne({ groupCode });

    if (!coordination) {
      return res.json({
        success: false,
        message: "Payment coordination not found",
      });
    }

    // Verify payments with Stripe
    const updatedPayments = [];
    for (const payment of coordination.payments) {
      if (payment.status === "processing" && payment.stripePaymentIntentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            payment.stripePaymentIntentId,
          );

          if (paymentIntent.status === "succeeded") {
            payment.status = "completed";
            payment.completedAt = new Date();
          } else if (paymentIntent.status === "payment_failed") {
            payment.status = "failed";
            payment.failureReason = paymentIntent.last_payment_error?.message;
          }
        } catch (error) {
          console.error("Error verifying payment:", error);
        }
      }
      updatedPayments.push(payment);
    }

    coordination.payments = updatedPayments;

    // Update overall status
    const allCompleted = coordination.payments.every(
      (p) => p.status === "completed",
    );
    if (allCompleted) {
      coordination.status = "completed";
      coordination.settlementDetails.completedAt = new Date();
      coordination.settlementDetails.allPaymentsReceived = true;
    }

    await coordination.save();

    // Emit socket event
    const io = req.app.get("io");
    emitPaymentUpdate(io, groupCode, "payments-reconciled", {
      groupCode,
      coordination,
    });

    return res.json({
      success: true,
      message: "Payments reconciled",
      data: coordination,
    });
  } catch (error) {
    console.error("Error reconciling payments:", error);
    return res.json({
      success: false,
      message: "Error reconciling payments",
    });
  }
};

export {
  initializePaymentCoordination,
  getPaymentCoordinationStatus,
  updatePaymentStatus,
  sendPaymentReminder,
  getPaymentHistory,
  getPaymentBreakdown,
  reconcilePayments,
};
