import mongoose from "mongoose";

const groupOrderSchema = new mongoose.Schema({
  groupCode: {
    type: String,
    unique: true,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  members: [
    {
      userId: String,
      userName: String,
      isHost: {
        type: Boolean,
        default: false,
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  items: [
    {
      userId: String,
      userName: String,
      itemId: String,
      itemName: String,
      price: Number,
      quantity: Number,
      image: String,
      category: String,
      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  status: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  },
// Orders created when group is finalized
  orders: [
    {
      userId: String,
      orderId: String,
      amount: Number,
      paid: { type: Boolean, default: false },
      sessionUrl: String,
    },
  ],
  // Chat messages for persistent storage
  chatMessages: [
    {
      userId: String,
      userName: String,
      message: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const groupOrderModel =
  mongoose.models.groupOrder || mongoose.model("groupOrder", groupOrderSchema);

export default groupOrderModel;
