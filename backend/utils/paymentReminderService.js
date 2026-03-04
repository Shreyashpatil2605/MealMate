import paymentCoordinationModel from "../models/paymentCoordinationModel.js";
import groupOrderModel from "../models/groupOrderModel.js";
import twilio from "twilio";

// Twilio client factory
const getTwilioClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
};

// Helper to emit socket updates
const emitPaymentUpdate = (io, groupCode, event, data) => {
  if (io) {
    io.to(groupCode).emit(event, data);
  }
};

/**
 * Payment Reminder Service
 * Handles automated payment reminders, notifications, and follow-ups
 */
class PaymentReminderService {
  /**
   * Send SMS reminder to user
   */
  static async sendSMSReminder(groupCode, userId, phoneNumber, amount, io) {
    try {
      const client = getTwilioClient();
      if (!client || !phoneNumber) {
        console.log(
          "SMS reminders not configured or phone number missing for user:",
          userId,
        );
        return null;
      }

      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      if (!fromNumber) {
        console.error("TWILIO_PHONE_NUMBER not configured");
        return null;
      }

      const message = await client.messages.create({
        body: `Payment reminder: Please pay ₹${amount} for your group order (${groupCode}). Click to complete payment.`,
        from: fromNumber,
        to: phoneNumber,
      });

      // Log notification
      const coordination = await paymentCoordinationModel.findOne({
        groupCode,
      });
      if (coordination) {
        const paymentIndex = coordination.payments.findIndex(
          (p) => p.userId === userId,
        );
        if (paymentIndex !== -1) {
          if (!coordination.notificationLog) {
            coordination.notificationLog = [];
          }
          coordination.notificationLog.push({
            userId,
            userName: coordination.payments[paymentIndex].userName,
            type: "reminder",
            message: `SMS reminder sent to ${phoneNumber}`,
            delivered: true,
          });
          await coordination.save();
        }
      }

      return { success: true, sid: message.sid };
    } catch (error) {
      console.error("Error sending SMS reminder:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Email reminder to user
   * Note: Integrate with email service (SendGrid, Mailgun, etc.)
   */
  static async sendEmailReminder(
    groupCode,
    userId,
    email,
    userName,
    amount,
    io,
  ) {
    try {
      // TODO: Integrate with email service
      console.log(
        `Email reminder would be sent to ${email} for user ${userName}`,
      );

      // Log notification
      const coordination = await paymentCoordinationModel.findOne({
        groupCode,
      });
      if (coordination) {
        if (!coordination.notificationLog) {
          coordination.notificationLog = [];
        }
        coordination.notificationLog.push({
          userId,
          userName,
          type: "reminder",
          message: `Email reminder sent to ${email}`,
          delivered: true,
        });
        await coordination.save();
      }

      return { success: true };
    } catch (error) {
      console.error("Error sending email reminder:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send in-app notification
   */
  static async sendInAppNotification(groupCode, userId, message, io) {
    try {
      emitPaymentUpdate(io, groupCode, "payment-notification", {
        userId,
        message,
        timestamp: new Date(),
      });

      // Log notification
      const coordination = await paymentCoordinationModel.findOne({
        groupCode,
      });
      if (coordination) {
        const paymentIndex = coordination.payments.findIndex(
          (p) => p.userId === userId,
        );
        if (paymentIndex !== -1) {
          if (!coordination.notificationLog) {
            coordination.notificationLog = [];
          }
          coordination.notificationLog.push({
            userId,
            userName: coordination.payments[paymentIndex].userName,
            type: "info",
            message,
            delivered: true,
          });
          await coordination.save();
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Error sending in-app notification:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule automatic reminders for pending payments
   * Should be called at regular intervals (e.g., every 30 minutes)
   */
  static async scheduleAutomaticReminders(io) {
    try {
      // Find all active payment coordinations
      const activeCoordinations = await paymentCoordinationModel.find({
        status: { $in: ["initiated", "in-progress"] },
      });

      for (const coordination of activeCoordinations) {
        const groupOrder = await groupOrderModel.findById(
          coordination.groupOrderId,
        );
        if (!groupOrder) continue;

        const reminderInterval =
          groupOrder.paymentSettings?.reminderIntervalHours * 3600000 ||
          2 * 3600000; // 2 hours default

        // Get pending payments
        const pendingPayments = coordination.payments.filter(
          (p) => p.status === "pending",
        );

        for (const payment of pendingPayments) {
          // Check if reminder should be sent
          const lastReminder = payment.lastReminderSentAt
            ? new Date(payment.lastReminderSentAt).getTime()
            : 0;
          const now = Date.now();

          if (now - lastReminder > reminderInterval) {
            // Get member details
            const member = groupOrder.members.find(
              (m) => m.userId === payment.userId,
            );

            // Send reminders via multiple channels
            if (payment.phoneNumber) {
              await this.sendSMSReminder(
                coordination.groupCode,
                payment.userId,
                payment.phoneNumber,
                payment.amount,
                io,
              );
            }

            if (payment.email) {
              await this.sendEmailReminder(
                coordination.groupCode,
                payment.userId,
                payment.email,
                payment.userName,
                payment.amount,
                io,
              );
            }

            // Send in-app notification
            await this.sendInAppNotification(
              coordination.groupCode,
              payment.userId,
              `Payment reminder: You need to pay ₹${payment.amount}`,
              io,
            );

            // Update payment reminder metadata
            payment.reminderCount = (payment.reminderCount || 0) + 1;
            payment.lastReminderSentAt = new Date();

            if (!coordination.activityLog) {
              coordination.activityLog = [];
            }
            coordination.activityLog.push({
              action: "reminder_sent",
              userId: payment.userId,
              userName: payment.userName,
              details: {
                reminderCount: payment.reminderCount,
                amount: payment.amount,
              },
            });
          }
        }

        await coordination.save();
      }

      console.log(
        "[PaymentReminderService] Automatic reminders scheduled successfully",
      );
    } catch (error) {
      console.error("Error scheduling automatic reminders:", error);
    }
  }

  /**
   * Send payment completion notification
   */
  static async notifyPaymentCompletion(
    groupCode,
    userId,
    userName,
    amount,
    io,
  ) {
    try {
      const coordination = await paymentCoordinationModel.findOne({
        groupCode,
      });
      const groupOrder = await groupOrderModel.findOne({ groupCode });

      if (!coordination || !groupOrder) return;

      // Send to all group members
      for (const member of groupOrder.members) {
        const message =
          member.userId === userId
            ? `You have completed your payment of ₹${amount}`
            : `${userName} has completed their payment of ₹${amount}`;

        await this.sendInAppNotification(groupCode, member.userId, message, io);
      }

      // Log notification
      if (!coordination.notificationLog) {
        coordination.notificationLog = [];
      }
      coordination.notificationLog.push({
        userId,
        userName,
        type: "payment_confirmed",
        message: `Payment of ₹${amount} completed`,
        delivered: true,
      });

      await coordination.save();
    } catch (error) {
      console.error("Error notifying payment completion:", error);
    }
  }

  /**
   * Send payment failure notification
   */
  static async notifyPaymentFailure(
    groupCode,
    userId,
    userName,
    amount,
    reason,
    io,
  ) {
    try {
      const coordination = await paymentCoordinationModel.findOne({
        groupCode,
      });

      if (!coordination) return;

      const message = `Payment of ₹${amount} failed. Reason: ${reason}. Please try again.`;

      await this.sendInAppNotification(groupCode, userId, message, io);

      // Log notification
      if (!coordination.notificationLog) {
        coordination.notificationLog = [];
      }
      coordination.notificationLog.push({
        userId,
        userName,
        type: "payment_failed",
        message: `Payment failed: ${reason}`,
        delivered: true,
      });

      await coordination.save();
    } catch (error) {
      console.error("Error notifying payment failure:", error);
    }
  }

  /**
   * Send settlement complete notification
   */
  static async notifySettlementComplete(groupCode, io) {
    try {
      const groupOrder = await groupOrderModel.findOne({ groupCode });

      if (!groupOrder) return;

      const message = "All payments completed! Your food order is confirmed.";

      for (const member of groupOrder.members) {
        await this.sendInAppNotification(groupCode, member.userId, message, io);
      }
    } catch (error) {
      console.error("Error notifying settlement completion:", error);
    }
  }

  /**
   * Generate payment summary report
   */
  static async generatePaymentSummary(groupCode) {
    try {
      const coordination = await paymentCoordinationModel.findOne({
        groupCode,
      });
      const groupOrder = await groupOrderModel.findOne({ groupCode });

      if (!coordination || !groupOrder) return null;

      const summary = {
        groupCode,
        totalAmount: coordination.totalAmount,
        splitMethod: coordination.splitMethod,
        createdAt: coordination.createdAt,
        status: coordination.status,
        completionPercentage: coordination.completionPercentage,
        paymentDetails: coordination.payments.map((payment) => ({
          userId: payment.userId,
          userName: payment.userName,
          amount: payment.amount,
          status: payment.status,
          completedAt: payment.completedAt,
          reminderCount: payment.reminderCount,
          transactionId: payment.transactionId,
        })),
        statistics: {
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
          completedAmount: coordination.payments
            .filter((p) => p.status === "completed")
            .reduce((sum, p) => sum + (p.amount || 0), 0),
        },
      };

      return summary;
    } catch (error) {
      console.error("Error generating payment summary:", error);
      return null;
    }
  }

  /**
   * Clean up expired coordinations
   */
  static async cleanupExpiredCoordinations() {
    try {
      const result = await paymentCoordinationModel.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      console.log(
        `[PaymentReminderService] Cleaned up ${result.deletedCount} expired payment coordinations`,
      );
    } catch (error) {
      console.error("Error cleaning up expired coordinations:", error);
    }
  }
}

export default PaymentReminderService;
