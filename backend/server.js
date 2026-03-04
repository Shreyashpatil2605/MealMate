import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import Stripe from "stripe";
import { connectDB } from "./config/db.js";
import foodRouter from "./routes/foodRoute.js";
import userRouter from "./routes/userRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import recommendationRoute from "./routes/recommendationRoute.js";
import groupOrderRoute from "./routes/groupOrderRoute.js";
import paymentCoordinationRoute from "./routes/paymentCoordinationRoute.js";
import menuRouter from "./routes/menuRoute.js";
import groupOrderModel from "./models/groupOrderModel.js";
import PaymentReminderService from "./utils/paymentReminderService.js";
import paymentCoordinationModel from "./models/paymentCoordinationModel.js";

// app config
const app = express();
const port = process.env.PORT || 4000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create HTTP server and Socket.IO server
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store io instance for use in controllers
app.set("io", io);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join a group room
  socket.on("join-group", (groupCode) => {
    socket.join(groupCode);
    console.log(`Socket ${socket.id} joined group: ${groupCode}`);
  });

  // Leave a group room
  socket.on("leave-group", (groupCode) => {
    socket.leave(groupCode);
    console.log(`Socket ${socket.id} left group: ${groupCode}`);
  });

  // Handle chat messages with MongoDB persistence
  socket.on("chat-message", async (data) => {
    const { groupCode, userId, userName, message, timestamp } = data;

    // Save message to MongoDB
    try {
      const groupOrder = await groupOrderModel.findOne({ groupCode });
      if (groupOrder) {
        if (!groupOrder.chatMessages) groupOrder.chatMessages = [];
        groupOrder.chatMessages.push({
          userId,
          userName,
          message,
          timestamp: timestamp || new Date(),
        });
        await groupOrder.save();
        console.log(`Chat message saved to DB for group ${groupCode}`);
      }
    } catch (error) {
      console.error("Error saving chat message to DB:", error);
    }

    // Broadcast message to all members in the group room
    if (groupCode) {
      io.to(groupCode).emit("chat-message", {
        groupCode,
        userId,
        userName,
        message,
        timestamp: timestamp || new Date().toISOString(),
      });
      console.log(
        `Chat message in group ${groupCode} from ${userName}: ${message}`,
      );
    }
  });

  // Payment coordination socket events
  socket.on("payment-status-check", async (data) => {
    const { groupCode } = data;
    console.log(`Payment status check requested for group: ${groupCode}`);
  });

  socket.on("payment-reminder-requested", async (data) => {
    const { groupCode, userId } = data;
    console.log(
      `Payment reminder requested for user ${userId} in group ${groupCode}`,
    );
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Stripe webhook endpoint - MUST be before express.json() middleware
app.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`⚠️  Webhook signature verification failed.`, err.message);
      return res.sendStatus(400);
    }

    // Handle the event
    try {
      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        console.log(`✅ Payment succeeded for intent: ${paymentIntent.id}`);

        // Extract groupCode and userId from metadata
        const { groupCode, userId } = paymentIntent.metadata;

        if (groupCode && userId) {
          // Find payment coordination document
          const paymentCoord = await paymentCoordinationModel.findOne({
            groupCode,
          });

          if (paymentCoord) {
            // Update payment status
            const paymentIndex = paymentCoord.payments.findIndex(
              (p) => p.userId === userId,
            );

            if (paymentIndex !== -1) {
              paymentCoord.payments[paymentIndex].status = "paid";
              paymentCoord.payments[paymentIndex].paidAt = new Date();
              paymentCoord.payments[paymentIndex].transactionId =
                paymentIntent.id;
              await paymentCoord.save();

              // Notify all members in the group about payment completion
              io.to(groupCode).emit("payment-status-updated", {
                userId,
                status: "paid",
                userName: paymentCoord.payments[paymentIndex].userName,
                paidAt: new Date(),
                groupCode,
              });

              // Check if all payments are complete
              const allPaid = paymentCoord.payments.every(
                (p) => p.status === "paid",
              );

              if (allPaid) {
                // Mark settlement as complete
                paymentCoord.settlementDetails.completedAt = new Date();
                paymentCoord.settlementDetails.status = "completed";
                await paymentCoord.save();

                // Update group order
                const groupOrder = await groupOrderModel.findOne({
                  groupCode,
                });

                if (groupOrder) {
                  groupOrder.settlement.allPaid = true;
                  groupOrder.settlement.completedAt = new Date();
                  groupOrder.orderStatus = "confirmed";
                  await groupOrder.save();
                }

                // Notify all members that order is being placed
                io.to(groupCode).emit("settlement-complete", {
                  message: "All payments received! Order is being placed...",
                  completedAt: new Date(),
                });

                console.log(`✅ All payments completed for group ${groupCode}`);
              }
            }
          }
        }
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        console.log(`❌ Payment failed for intent: ${paymentIntent.id}`);

        const { groupCode, userId } = paymentIntent.metadata;

        if (groupCode && userId) {
          const paymentCoord = await paymentCoordinationModel.findOne({
            groupCode,
          });

          if (paymentCoord) {
            const paymentIndex = paymentCoord.payments.findIndex(
              (p) => p.userId === userId,
            );

            if (paymentIndex !== -1) {
              paymentCoord.payments[paymentIndex].status = "failed";
              paymentCoord.payments[paymentIndex].failureReason =
                paymentIntent.last_payment_error?.message || "Unknown error";
              await paymentCoord.save();

              // Notify user about payment failure
              io.to(groupCode).emit("payment-status-updated", {
                userId,
                status: "failed",
                userName: paymentCoord.payments[paymentIndex].userName,
                message: "Payment failed. Please try again.",
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing webhook event:", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  },
);

//middlewares
app.use(express.json());
app.use(cors());

// DB connection
connectDB();

// api endpoints
app.use("/api/food", foodRouter);
app.use("/api/menu", menuRouter);
app.use("/images", express.static("uploads"));
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/recommendation", recommendationRoute);
app.use("/api/group-order", groupOrderRoute);
app.use("/api/payment-coordination", paymentCoordinationRoute);

app.get("/", (req, res) => {
  res.send("API Working");
});

// Set up automatic payment reminder scheduler
// Runs every 30 minutes to send reminders for pending payments
const reminderInterval = setInterval(
  () => {
    PaymentReminderService.scheduleAutomaticReminders(io);
  },
  30 * 60 * 1000,
); // 30 minutes

// Set up cleanup for expired payment coordinations
// Runs every 6 hours
const cleanupInterval = setInterval(
  () => {
    PaymentReminderService.cleanupExpiredCoordinations();
  },
  6 * 60 * 60 * 1000,
); // 6 hours

// Cleanup intervals on server shutdown
const gracefulShutdown = () => {
  clearInterval(reminderInterval);
  clearInterval(cleanupInterval);
  console.log("Intervals cleared");
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Use httpServer.listen instead of app.listen
httpServer.listen(port, () => {
  console.log(`Server Started on port: ${port}`);
});
console.log(process.env.MONGO_URL);

// Stripe Webhook Info
console.log("⚠️  Stripe Webhook configured at: POST /webhook/stripe");
console.log(
  "📝 Webhook Secret Required: STRIPE_WEBHOOK_SECRET in environment variables",
);

export { io };
