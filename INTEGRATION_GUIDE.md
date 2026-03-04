// Integration Script: How to Update groupOrderController.js
// This file shows the exact changes needed to integrate payment coordination

// IMPORTANT: This is a reference file
// Copy the relevant parts into your actual groupOrderController.js

// ============================================================================
// STEP 1: Add this import at the top of groupOrderController.js
// ============================================================================

import paymentCoordinationModel from "../models/paymentCoordinationModel.js";
import PaymentReminderService from "../utils/paymentReminderService.js";

// ============================================================================
// STEP 2: Update the finalizeGroupOrder function
// ============================================================================

// Find this section in your finalizeGroupOrder function (around line 600-700):
// It should be after you process split payments and before the final return

// REPLACE THIS OLD CODE:
/\*
// Default: split payments
console.log("Processing split payments mode");
groupOrder.orders = []; // Initialize orders array
for (const [userId, data] of Object.entries(splitByUser)) {
// ... existing code to create orders and stripe sessions ...
}

    await groupOrder.save();

    return res.json({
      success: true,
      message: "Group order finalized with payments",
      data: { groupOrder, paymentSessions },
    });

\*/

// WITH THIS NEW CODE:

/\*
// Default: split payments
console.log("Processing split payments mode");
groupOrder.orders = []; // Initialize orders array
for (const [userId, data] of Object.entries(splitByUser)) {
// ... existing code to create orders and stripe sessions ...
}

    // ========== NEW: Initialize Payment Coordination ==========
    try {
      // Create payment coordination record
      const paymentCoord = new paymentCoordinationModel({
        groupCode,
        groupOrderId: groupOrder._id,
        totalAmount: grandTotal,
        splitMethod: req.body.splitMethod || "proportional",
        payments: groupOrder.orders.map((order) => ({
          userId: order.userId,
          userName: splitByUser[order.userId]?.userName || "Unknown",
          email: splitByUser[order.userId]?.email || "",
          phoneNumber: splitByUser[order.userId]?.phoneNumber || "",
          orderId: order.orderId,
          amount: order.amount,
          status: "pending",
          paymentMethod: "stripe",
          stripeSessionId: order.sessionUrl ? extractSessionId(order.sessionUrl) : null,
        })),
        status: "initiated",
        settlementDetails: {
          startedAt: new Date(),
        },
      });

      await paymentCoord.save();
      console.log(`Payment coordination initialized for group ${groupCode}`);

      // Update group order with payment coordination reference
      groupOrder.paymentCoordinationId = paymentCoord._id;
      groupOrder.paymentSettings = {
        splitMethod: req.body.splitMethod || "proportional",
        autoReminder: true,
        reminderIntervalHours: 2,
      };
      groupOrder.settlement = {
        totalAmount: grandTotal,
        completedAmount: 0,
        pendingAmount: grandTotal,
        completionPercentage: 0,
      };

      // Emit socket event for payment coordination
      const io = req.app.get("io");
      if (io) {
        io.to(groupCode).emit("payment-coordination-initialized", {
          groupCode,
          coordination: paymentCoord,
          paymentSessions,
        });
      }
    } catch (paymentError) {
      console.error("Error initializing payment coordination:", paymentError);
      // Continue even if coordination fails - don't block order creation
    }
    // ========================================================

    await groupOrder.save();

    return res.json({
      success: true,
      message: "Group order finalized with payment coordination",
      data: { groupOrder, paymentSessions },
    });

\*/

// ============================================================================
// STEP 3: Add this helper function to extract Stripe session ID
// ============================================================================

const extractSessionId = (sessionUrl) => {
if (!sessionUrl) return null;
const match = sessionUrl.match(/session_id=([^&]+)/);
return match ? match[1] : null;
};

// ============================================================================
// STEP 4: Update the completeGroupOrder function
// ============================================================================

// Find the existing completeGroupOrder and update it to sync with PaymentCoordination:

/\*
const completeGroupOrder = async (req, res) => {
try {
const { groupCode, orderId } = req.body;

    if (!groupCode || !orderId) {
      return res.json({
        success: false,
        message: "Group code and order ID required",
      });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });
    if (!groupOrder) {
      return res.json({ success: false, message: "Group order not found" });
    }

    // Find and mark the specific order as paid
    const order = groupOrder.orders.find(
      (o) => o.orderId === orderId || o.orderId.toString() === orderId,
    );
    if (order) {
      order.paid = true;
    }

    // ========== NEW: Update Payment Coordination ==========
    if (groupOrder.paymentCoordinationId) {
      const coordination = await paymentCoordinationModel.findByIdAndUpdate(
        groupOrder.paymentCoordinationId,
        {
          $set: {
            "payments.$[elem].status": "completed",
            "payments.$[elem].completedAt": new Date(),
          },
        },
        {
          arrayFilters: [{ "elem.orderId": orderId || order?.userId }],
          new: true,
        }
      );

      if (coordination) {
        // Calculate new completion percentage
        const completedCount = coordination.payments.filter(
          (p) => p.status === "completed",
        ).length;
        coordination.completionPercentage = Math.round(
          (completedCount / coordination.payments.length) * 100,
        );

        // Check if all payments are complete
        const allCompleted = coordination.payments.every(
          (p) => p.status === "completed",
        );
        if (allCompleted) {
          coordination.status = "completed";
          coordination.settlementDetails.completedAt = new Date();
          coordination.settlementDetails.allPaymentsReceived = true;
        } else {
          coordination.status = "in-progress";
        }

        await coordination.save();

        // Update group order settlement
        if (groupOrder.settlement) {
          groupOrder.settlement.completedAmount = coordination.payments
            .filter((p) => p.status === "completed")
            .reduce((sum, p) => sum + p.amount, 0);
          groupOrder.settlement.pendingAmount =
            coordination.totalAmount - groupOrder.settlement.completedAmount;
          groupOrder.settlement.completionPercentage =
            coordination.completionPercentage;
          groupOrder.settlement.allPaymentsReceived = allCompleted;
        }

        // Notify all members via socket
        const io = req.app.get("io");
        if (io) {
          io.to(groupCode).emit("payment-status-updated", {
            groupCode,
            orderId,
            status: "completed",
            completionPercentage: coordination.completionPercentage,
            overallStatus: coordination.status,
          });

          // If settlement complete, notify
          if (allCompleted) {
            await PaymentReminderService.notifySettlementComplete(
              groupCode,
              io
            );
          }
        }
      }
    }
    // ========================================================

    // Check if all members have paid
    const allPaid = groupOrder.orders.every((o) => o.paid === true);
    if (allPaid) {
      groupOrder.status = "completed";
    }

    await groupOrder.save();

    const io = req.app.get("io");
    if (io) {
      emitGroupUpdate(io, groupCode, "order-completed", {
        groupCode,
        orderId,
        allPaid,
        status: groupOrder.status,
      });
    }

    return res.json({
      success: true,
      message: "Order payment marked as complete",
      data: { groupOrder, allPaid },
    });

} catch (error) {
console.error("Error completing group order:", error);
return res.json({
success: false,
message: "Error completing group order",
});
}
};
\*/

// ============================================================================
// STEP 5: Add new endpoint for payment status webhook from Stripe
// ============================================================================

// Add this to groupOrderRoute.js or create a webhook route:

/\*
const handlePaymentWebhook = async (req, res) => {
try {
const { orderId, status, transactionId, receiptUrl } = req.body;

    // Find the order
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    // Find associated group order
    const groupOrder = await groupOrderModel.findOne({
      "orders.orderId": orderId,
    });

    if (groupOrder && groupOrder.paymentCoordinationId) {
      // Update payment coordination
      const coordination = await paymentCoordinationModel.findById(
        groupOrder.paymentCoordinationId,
      );

      if (coordination) {
        const paymentIndex = coordination.payments.findIndex(
          (p) => p.orderId === orderId,
        );

        if (paymentIndex !== -1) {
          coordination.payments[paymentIndex].status = status;
          if (status === "completed") {
            coordination.payments[paymentIndex].completedAt = new Date();
            coordination.payments[paymentIndex].transactionId = transactionId;
            coordination.payments[paymentIndex].receiptUrl = receiptUrl;

            // Send notification
            const io = req.app.get("io");
            await PaymentReminderService.notifyPaymentCompletion(
              groupOrder.groupCode,
              coordination.payments[paymentIndex].userId,
              coordination.payments[paymentIndex].userName,
              coordination.payments[paymentIndex].amount,
              io,
            );
          } else if (status === "failed") {
            await PaymentReminderService.notifyPaymentFailure(
              groupOrder.groupCode,
              coordination.payments[paymentIndex].userId,
              coordination.payments[paymentIndex].userName,
              coordination.payments[paymentIndex].amount,
              req.body.failureReason,
              req.app.get("io"),
            );
          }

          await coordination.save();
        }
      }
    }

    return res.json({
      success: true,
      message: "Payment webhook processed",
    });

} catch (error) {
console.error("Error processing payment webhook:", error);
return res.json({
success: false,
message: "Error processing webhook",
});
}
};

// Add to routes:
groupOrderRoute.post("/webhook/payment-status", handlePaymentWebhook);
\*/

// ============================================================================
// STEP 6: Optional - Add manual sync endpoint
// ============================================================================

/\*
const syncPaymentCoordination = async (req, res) => {
try {
const { groupCode } = req.body;

    if (!groupCode) {
      return res.json({
        success: false,
        message: "Group code required",
      });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });
    if (!groupOrder) {
      return res.json({
        success: false,
        message: "Group order not found",
      });
    }

    if (!groupOrder.paymentCoordinationId) {
      return res.json({
        success: false,
        message: "No payment coordination found",
      });
    }

    // Re-sync settlement data
    const coordination = await paymentCoordinationModel.findById(
      groupOrder.paymentCoordinationId,
    );

    groupOrder.settlement = {
      totalAmount: coordination.totalAmount,
      completedAmount: coordination.payments
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + p.amount, 0),
      pendingAmount: coordination.payments
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + p.amount, 0),
      completionPercentage: coordination.completionPercentage,
    };

    await groupOrder.save();

    return res.json({
      success: true,
      message: "Payment coordination synced",
      data: groupOrder,
    });

} catch (error) {
console.error("Error syncing payment coordination:", error);
return res.json({
success: false,
message: "Error syncing payment coordination",
});
}
};

// Add to routes:
groupOrderRoute.post("/sync-payment-coordination", syncPaymentCoordination);
\*/

// ============================================================================
// END OF INTEGRATION GUIDE
// ============================================================================
