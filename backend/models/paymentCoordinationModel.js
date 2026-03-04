import mongoose from "mongoose";

const paymentCoordinationSchema = new mongoose.Schema({
  groupCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  groupOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "groupOrder",
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  splitMethod: {
    type: String,
    enum: ["equal", "custom", "proportional"],
    default: "equal",
  },
  // Individual payment tracking
  payments: [
    {
      userId: String,
      userName: String,
      email: String,
      phoneNumber: String,
      orderId: String, // Reference to order
      amount: Number,
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed", "cancelled"],
        default: "pending",
      },
      paymentMethod: {
        type: String,
        enum: ["stripe", "upi", "wallet", "cash"],
        default: "stripe",
      },
      stripeSessionId: String,
      stripePaymentIntentId: String,
      transactionId: String,
      receiptUrl: String,
      initiatedAt: {
        type: Date,
        default: Date.now,
      },
      completedAt: Date,
      failureReason: String,
      reminderCount: {
        type: Number,
        default: 0,
      },
      lastReminderSentAt: Date,
    },
  ],
  // Overall coordination metadata
  status: {
    type: String,
    enum: ["initiated", "in-progress", "completed", "failed", "cancelled"],
    default: "initiated",
  },
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  // Room for improvements with custom split details
  customSplitDetails: {
    type: Map,
    of: new mongoose.Schema(
      {
        userId: String,
        userName: String,
        customAmount: Number,
        reason: String,
      },
      { _id: false },
    ),
  },
  // Tracking coordination history
  paymentHistory: [
    {
      userId: String,
      userName: String,
      amount: Number,
      status: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
      notes: String,
    },
  ],
  // Settlement tracking
  settlementDetails: {
    startedAt: Date,
    completedAt: Date,
    allPaymentsReceived: {
      type: Boolean,
      default: false,
    },
    settlementNotes: String,
  },
  // Notification tracking
  notificationLog: [
    {
      userId: String,
      userName: String,
      type: String, // 'reminder', 'payment_confirmed', 'payment_failed', 'info'
      message: String,
      sentAt: {
        type: Date,
        default: Date.now,
      },
      delivered: {
        type: Boolean,
        default: false,
      },
    },
  ],
  // Real-time activity log
  activityLog: [
    {
      action: String, // 'status_update', 'payment_initiated', 'payment_completed', 'reminder_sent'
      userId: String,
      userName: String,
      details: mongoose.Schema.Types.Mixed,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  },
});

// Index for automatic cleanup of expired documents
paymentCoordinationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Middleware to update updatedAt timestamp
paymentCoordinationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual to calculate payment statistics
paymentCoordinationSchema.virtual("paymentStats").get(function () {
  const totalPayments = this.payments.length;
  const completedPayments = this.payments.filter(
    (p) => p.status === "completed",
  ).length;
  const pendingPayments = this.payments.filter(
    (p) => p.status === "pending",
  ).length;
  const failedPayments = this.payments.filter(
    (p) => p.status === "failed",
  ).length;

  const completedAmount = this.payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const pendingAmount = this.payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    totalPayments,
    completedPayments,
    pendingPayments,
    failedPayments,
    completedAmount,
    pendingAmount,
    completionPercentage: Math.round(
      (completedPayments / totalPayments) * 100 || 0,
    ),
  };
});

const paymentCoordinationModel =
  mongoose.models.paymentCoordination ||
  mongoose.model("paymentCoordination", paymentCoordinationSchema);

export default paymentCoordinationModel;
