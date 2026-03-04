import groupOrderModel from "../models/groupOrderModel.js";
import orderModel from "../models/orderModel.js";
import paymentCoordinationModel from "../models/paymentCoordinationModel.js";
import PaymentReminderService from "../utils/paymentReminderService.js";
import Stripe from "stripe";
import twilio from "twilio";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Twilio client factory
const getTwilioClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
};

// Generate unique group code (6 alphanumeric)
const generateGroupCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Helper function to get io instance and emit event
const emitGroupUpdate = (io, groupCode, event, data) => {
  if (io) {
    io.to(groupCode).emit(event, data);
  }
};

// Create a new group order
const createGroupOrder = async (req, res) => {
  try {
    const { userId, userName } = req.body;

    if (!userId || !userName) {
      return res.json({
        success: false,
        message: "User ID and name required",
      });
    }

    // Generate unique code
    let groupCode = generateGroupCode();
    let exists = await groupOrderModel.findOne({ groupCode });
    while (exists) {
      groupCode = generateGroupCode();
      exists = await groupOrderModel.findOne({ groupCode });
    }

    const newGroupOrder = new groupOrderModel({
      groupCode,
      createdBy: userId,
      members: [
        {
          userId,
          userName,
          isHost: true,
        },
      ],
      items: [],
    });

    await newGroupOrder.save();

    // Emit socket event for group creation
    const io = req.app.get("io");
    emitGroupUpdate(io, groupCode, "group-created", {
      groupCode,
      groupOrder: newGroupOrder,
    });

    return res.json({
      success: true,
      message: "Group order created successfully",
      data: {
        groupCode,
        groupOrder: newGroupOrder,
      },
    });
  } catch (error) {
    console.error("Error creating group order:", error);
    return res.json({
      success: false,
      message: "Error creating group order",
    });
  }
};

// Join an existing group order
const joinGroupOrder = async (req, res) => {
  try {
    const { groupCode, userId, userName } = req.body;

    if (!groupCode || !userId || !userName) {
      return res.json({
        success: false,
        message: "Group code, user ID, and name required",
      });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });

    if (!groupOrder) {
      return res.json({
        success: false,
        message: "Group order not found",
      });
    }

    if (groupOrder.status !== "active") {
      return res.json({
        success: false,
        message: "This group order is no longer active",
      });
    }

    // Check if user already exists in group
    const userExists = groupOrder.members.some((m) => m.userId === userId);
    if (userExists) {
      return res.json({
        success: true,
        message: "You are already part of this group",
        data: groupOrder,
      });
    }

    // Add user to members
    groupOrder.members.push({
      userId,
      userName,
    });

    await groupOrder.save();

    // Emit socket event for new member join
    const io = req.app.get("io");
    emitGroupUpdate(io, groupCode, "member-joined", {
      groupCode,
      member: { userId, userName },
      members: groupOrder.members,
    });

    return res.json({
      success: true,
      message: "Joined group order successfully",
      data: groupOrder,
    });
  } catch (error) {
    console.error("Error joining group order:", error);
    return res.json({
      success: false,
      message: "Error joining group order",
    });
  }
};

// Add item to group order
const addItemToGroupOrder = async (req, res) => {
  try {
    const {
      groupCode,
      userId,
      userName,
      itemId,
      itemName,
      price,
      quantity,
      image,
      category,
    } = req.body;

    if (!groupCode || !userId || !itemId) {
      return res.json({
        success: false,
        message: "Group code, user ID, and item ID required",
      });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });

    if (!groupOrder) {
      return res.json({
        success: false,
        message: "Group order not found",
      });
    }

    // Check if user is member
    const userExists = groupOrder.members.some((m) => m.userId === userId);
    if (!userExists) {
      return res.json({
        success: false,
        message: "User is not part of this group",
      });
    }

    // Check if item already exists for this user
    const existingItem = groupOrder.items.find(
      (item) => item.userId === userId && item.itemId === itemId,
    );

    if (existingItem) {
      // Update quantity
      existingItem.quantity += quantity;
    } else {
      // Add new item
      groupOrder.items.push({
        userId,
        userName,
        itemId,
        itemName,
        price,
        quantity,
        image,
        category,
      });
    }

    await groupOrder.save();

    // Emit socket event for item added
    const io = req.app.get("io");
    emitGroupUpdate(io, groupCode, "item-added", {
      groupCode,
      item: { userId, userName, itemId, itemName, price, quantity },
      items: groupOrder.items,
      members: groupOrder.members,
    });

    return res.json({
      success: true,
      message: "Item added to group order",
      data: groupOrder,
    });
  } catch (error) {
    console.error("Error adding item:", error);
    return res.json({
      success: false,
      message: "Error adding item to group order",
    });
  }
};

// Remove item from group order
const removeItemFromGroupOrder = async (req, res) => {
  try {
    const { groupCode, userId, itemId } = req.body;

    if (!groupCode || !userId || !itemId) {
      return res.json({
        success: false,
        message: "Required parameters missing",
      });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });

    if (!groupOrder) {
      return res.json({
        success: false,
        message: "Group order not found",
      });
    }

    // Remove item
    groupOrder.items = groupOrder.items.filter(
      (item) => !(item.userId === userId && item.itemId === itemId),
    );

    await groupOrder.save();

    // Emit socket event for item removed
    const io = req.app.get("io");
    emitGroupUpdate(io, groupCode, "item-removed", {
      groupCode,
      item: { userId, itemId },
      items: groupOrder.items,
    });

    return res.json({
      success: true,
      message: "Item removed from group order",
      data: groupOrder,
    });
  } catch (error) {
    console.error("Error removing item:", error);
    return res.json({
      success: false,
      message: "Error removing item",
    });
  }
};

// Update item quantity in group order
const updateItemQuantity = async (req, res) => {
  try {
    const { groupCode, userId, itemId, quantity } = req.body;

    if (!groupCode || !userId || !itemId || quantity === undefined) {
      return res.json({
        success: false,
        message: "Required parameters missing",
      });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });

    if (!groupOrder) {
      return res.json({
        success: false,
        message: "Group order not found",
      });
    }

    // Find and update item
    const item = groupOrder.items.find(
      (item) => item.userId === userId && item.itemId === itemId,
    );

    if (!item) {
      return res.json({
        success: false,
        message: "Item not found",
      });
    }

    if (quantity < 1) {
      // Remove item if quantity is 0
      groupOrder.items = groupOrder.items.filter(
        (i) => !(i.userId === userId && i.itemId === itemId),
      );
    } else {
      item.quantity = quantity;
    }

    await groupOrder.save();

    // Emit socket event for item updated
    const io = req.app.get("io");
    emitGroupUpdate(io, groupCode, "item-updated", {
      groupCode,
      item: { userId, itemId, quantity },
      items: groupOrder.items,
    });

    return res.json({
      success: true,
      message: "Item quantity updated",
      data: groupOrder,
    });
  } catch (error) {
    console.error("Error updating quantity:", error);
    return res.json({
      success: false,
      message: "Error updating quantity",
    });
  }
};

// Get group order details with split calculation
const getGroupOrderDetails = async (req, res) => {
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

    // Calculate totals per person - ensure price is always a number
    const splitByUser = {};
    let grandTotal = 0;

    if (groupOrder.items && groupOrder.items.length > 0) {
      groupOrder.items.forEach((item) => {
        // Ensure price and quantity are numbers
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        const itemTotal = price * quantity;

        grandTotal += itemTotal;

        if (!splitByUser[item.userId]) {
          splitByUser[item.userId] = {
            userName: item.userName,
            total: 0,
            items: [],
          };
        }

        splitByUser[item.userId].total += itemTotal;
        splitByUser[item.userId].items.push({
          itemName: item.itemName,
          quantity: quantity,
          price: price,
          total: itemTotal,
        });
      });
    }

    const splitData = Object.entries(splitByUser).map(([userId, data]) => ({
      userId,
      userName: data.userName,
      subtotal: Math.round(data.total * 100) / 100,
      items: data.items,
    }));

    return res.json({
      success: true,
      data: {
        ...groupOrder._doc,
        grandTotal: Math.round(grandTotal * 100) / 100,
        splitByUser: splitData,
        memberCount: groupOrder.members.length,
        itemCount: groupOrder.items.length,
      },
    });
  } catch (error) {
    console.error("Error getting group order details:", error);
    return res.json({
      success: false,
      message: "Error getting group order details",
    });
  }
};

// Finalize group order (before checkout)
const finalizeGroupOrder = async (req, res) => {
  try {
    console.log("=== Starting finalize group order ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      groupCode,
      paymentOption = "split",
      frontendUrl,
      payerId,
    } = req.body;

    // Validation
    if (!groupCode) {
      return res.json({ success: false, message: "Group code required" });
    }

    if (!frontendUrl) {
      return res.json({ success: false, message: "Frontend URL required" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.json({
        success: false,
        message: "Stripe configuration missing",
      });
    }

    console.log("Fetching group order for code:", groupCode);
    const groupOrder = await groupOrderModel.findOne({ groupCode });
    if (!groupOrder) {
      return res.json({ success: false, message: "Group order not found" });
    }

    console.log("Group order found. Items count:", groupOrder.items.length);
    if (groupOrder.items.length === 0) {
      return res.json({ success: false, message: "Group order is empty" });
    }

    // Calculate split per user
    console.log("Calculating split by user...");
    const splitByUser = {};
    let grandTotal = 0;
    groupOrder.items.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      grandTotal += itemTotal;
      if (!splitByUser[item.userId]) {
        splitByUser[item.userId] = {
          userName: item.userName,
          total: 0,
          items: [],
        };
      }
      splitByUser[item.userId].total += itemTotal;
      splitByUser[item.userId].items.push({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal,
      });
    });

    console.log("Split calculation complete. Grand total:", grandTotal);
    console.log("Users in split:", Object.keys(splitByUser));

    const paymentSessions = [];

    if (paymentOption === "single_payer") {
      console.log("Processing single payer mode");
      if (!payerId) {
        return res.json({
          success: false,
          message: "payerId required for single_payer",
        });
      }

      const combinedItems = groupOrder.items.map((it) => ({
        name: it.itemName,
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 0,
      }));

      const newOrder = new orderModel({
        userId: payerId,
        items: combinedItems,
        amount: Math.round(grandTotal * 100) / 100,
        address: req.body.address || {},
      });
      console.log("Saving order for single payer:", payerId);
      await newOrder.save();

      let sessionUrl = null;
      try {
        const line_items = combinedItems
          .filter((item) => item.price > 0 && item.quantity > 0)
          .map((item) => ({
            price_data: {
              currency: "inr",
              product_data: { name: item.name },
              unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
          }));

        // Validate line_items is not empty
        if (line_items.length === 0) {
          throw new Error("No valid items in order");
        }

        line_items.push({
          price_data: {
            currency: "inr",
            product_data: { name: "Delivery Charges" },
            unit_amount: 200,
          },
          quantity: 1,
        });

        console.log(
          `Creating Stripe session (single payer) with ${line_items.length} items`,
        );

        const session = await stripe.checkout.sessions.create({
          line_items,
          mode: "payment",
          success_url: `${frontendUrl}/verify?success=true&orderId=${newOrder._id}&groupCode=${groupCode}`,
          cancel_url: `${frontendUrl}/verify?success=false&orderId=${newOrder._id}&groupCode=${groupCode}`,
        });
        sessionUrl = session.url;
        console.log("Stripe session created successfully");
      } catch (stripeError) {
        console.error("Stripe session creation error:", stripeError.message);
        throw new Error(`Stripe error: ${stripeError.message}`);
      }

      groupOrder.orders = [
        {
          userId: payerId,
          orderId: newOrder._id.toString(),
          amount: newOrder.amount,
          paid: false,
          sessionUrl,
        },
      ];

      groupOrder.status = "completed";
      await groupOrder.save();

      const io = req.app.get("io");
      emitGroupUpdate(io, groupCode, "group-finalized", {
        groupCode,
        status: "completed",
        groupOrder,
      });

      return res.json({
        success: true,
        message: "Group finalized (single payer)",
        data: { groupOrder, sessionUrl },
      });
    }

    // Default: split payments
    console.log("Processing split payments mode");
    groupOrder.orders = []; // Initialize orders array
    for (const [userId, data] of Object.entries(splitByUser)) {
      console.log(
        `Creating order for user: ${data.userName} (${userId}), amount: ${data.total}`,
      );

      const itemsForUser = data.items.map((it) => ({
        name: it.itemName,
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 0,
      }));

      // Validate items have valid prices
      const hasValidItems = itemsForUser.some(
        (item) => item.price > 0 && item.quantity > 0,
      );
      if (!hasValidItems) {
        throw new Error(`No valid items for user ${data.userName}`);
      }

      const amount = Math.round(data.total * 100) / 100;

      const newOrder = new orderModel({
        userId,
        items: itemsForUser,
        amount,
        address: req.body.address || {},
      });
      await newOrder.save();
      console.log(
        `Order saved for user ${data.userName}. Order ID: ${newOrder._id}`,
      );

      let sessionUrl = null;
      try {
        const line_items = itemsForUser
          .filter((item) => item.price > 0 && item.quantity > 0)
          .map((item) => ({
            price_data: {
              currency: "inr",
              product_data: { name: item.name },
              unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
          }));

        // Validate line_items is not empty
        if (line_items.length === 0) {
          throw new Error(`No valid line items for user ${data.userName}`);
        }

        line_items.push({
          price_data: {
            currency: "inr",
            product_data: { name: "Delivery Charges" },
            unit_amount: 200,
          },
          quantity: 1,
        });

        console.log(
          `Creating Stripe session for user ${data.userName} with ${line_items.length} items`,
        );

        const session = await stripe.checkout.sessions.create({
          line_items,
          mode: "payment",
          success_url: `${frontendUrl}/verify?success=true&orderId=${newOrder._id}&groupCode=${groupCode}`,
          cancel_url: `${frontendUrl}/verify?success=false&orderId=${newOrder._id}&groupCode=${groupCode}`,
        });
        sessionUrl = session.url;
        console.log(`Stripe session created for ${data.userName}`);
      } catch (stripeError) {
        console.error(
          "Stripe session creation error for user:",
          userId,
          stripeError.message,
        );
        throw new Error(
          `Stripe error for user ${data.userName}: ${stripeError.message}`,
        );
      }

      groupOrder.orders.push({
        userId,
        orderId: newOrder._id.toString(),
        amount,
        paid: false,
        sessionUrl,
      });
      paymentSessions.push({
        userId,
        userName: data.userName,
        amount,
        sessionUrl,
      });
    }

    console.log("Saving group order with completed status");
    groupOrder.status = "completed";

    // Initialize payment coordination for split payments
    let paymentCoord = null;
    try {
      paymentCoord = new paymentCoordinationModel({
        groupCode,
        groupOrderId: groupOrder._id,
        totalAmount: grandTotal,
        splitMethod: "proportional",
        payments: paymentSessions.map((session) => {
          const member = groupOrder.members.find(
            (m) => m.userId === session.userId,
          );
          return {
            userId: session.userId,
            userName: session.userName,
            email: member?.email || "",
            phoneNumber: member?.phoneNumber || "",
            amount: session.amount,
            status: "pending",
            paymentMethod: "stripe",
          };
        }),
        status: "initiated",
        settlementDetails: {
          startedAt: new Date(),
        },
      });

      await paymentCoord.save();
      groupOrder.paymentCoordinationId = paymentCoord._id;
      console.log(`Payment coordination initialized for group ${groupCode}`);
    } catch (coordError) {
      console.error("Error initializing payment coordination:", coordError);
    }

    await groupOrder.save();

    const io = req.app.get("io");
    emitGroupUpdate(io, groupCode, "group-finalized", {
      groupCode,
      status: "completed",
      paymentSessions,
    });

    console.log("=== Finalization complete ===");
    return res.json({
      success: true,
      message: "Group finalized (split)",
      data: { groupOrder, paymentSessions },
    });
  } catch (error) {
    // Extract error information
    let errorMessage =
      error?.message || error?.toString() || "Unknown error occurred";

    // Try to get more details
    const errorDetails = {
      message: errorMessage,
      name: error?.name || "Error",
      stack: error?.stack || "No stack trace",
      code: error?.code || null,
      errorType: typeof error,
    };

    console.error("=== ERROR CAUGHT IN FINALIZE ===");
    console.error("Error message:", errorMessage);
    console.error("Error name:", error?.name);
    console.error("Error code:", error?.code);
    console.error("Error details:", errorDetails);
    console.error("Full error object:", error);
    console.error("=== END ERROR ===");

    return res.json({
      success: false,
      message: error.message || "Error finalizing group order",
      details: error.stack || error.message, // ⭐ IMPORTANT
    });
  }
};

// Create a new Stripe payment session for a specific user
const createPaymentSession = async (req, res) => {
  try {
    const { groupCode, userId } = req.body;

    if (!groupCode || !userId) {
      return res.json({
        success: false,
        message: "Group code and user ID required",
      });
    }

    // Find the group order
    const groupOrder = await groupOrderModel.findOne({ groupCode });
    if (!groupOrder) {
      return res.json({ success: false, message: "Group order not found" });
    }

    // Find the payment coordination
    const paymentCoord = await paymentCoordinationModel.findOne({
      groupCode,
    });
    if (!paymentCoord) {
      return res.json({
        success: false,
        message: "Payment coordination not found",
      });
    }

    // Find user's payment details
    const userPayment = paymentCoord.payments.find((p) => p.userId === userId);
    if (!userPayment) {
      return res.json({
        success: false,
        message: "User not found in this group payment",
      });
    }

    if (userPayment.status === "paid") {
      return res.json({
        success: true,
        message: "User already paid",
        data: { status: "paid" },
      });
    }

    // Find the order for this user
    const order = groupOrder.orders.find((o) => o.userId === userId);
    if (!order) {
      return res.json({
        success: false,
        message: "Order not found for this user",
      });
    }

    // Create Stripe session with metadata for webhook processing
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: order.items.map((item) => ({
        price_data: {
          currency: "inr",
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      // CRITICAL: Include metadata for webhook to identify payment
      payment_intent_data: {
        metadata: {
          groupCode,
          userId,
          userName: userPayment.userName,
        },
      },
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/group-order/${groupCode}/payment?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/group-order/${groupCode}/payment?cancelled=true`,
      metadata: {
        groupCode,
        userId,
      },
    });

    console.log(
      `✅ Stripe session created for user ${userId} in group ${groupCode}: ${session.id}`,
    );

    return res.json({
      success: true,
      data: {
        sessionId: session.id,
        sessionUrl: session.url,
        amount: userPayment.amount,
        userName: userPayment.userName,
      },
    });
  } catch (error) {
    console.error("Error creating payment session:", error);
    return res.json({
      success: false,
      message: error.message || "Error creating payment session",
    });
  }
};

// Mark payment as complete and place order when all payments received
const confirmPayment = async (req, res) => {
  try {
    const { groupCode, orderId, userId, transactionId, receiptUrl } = req.body;

    if (!groupCode || !orderId || !userId) {
      return res.json({
        success: false,
        message: "Group code, order ID, and user ID required",
      });
    }

    // Find group order
    const groupOrder = await groupOrderModel.findOne({ groupCode });
    if (!groupOrder) {
      return res.json({
        success: false,
        message: "Group order not found",
      });
    }

    // Find the order
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.json({
        success: false,
        message: "Order not found",
      });
    }

    // Mark order as paid
    order.payment = true;
    await order.save();

    // Update group order
    const groupOrderItem = groupOrder.orders.find(
      (o) => o.orderId === orderId || o.orderId.toString() === orderId,
    );
    if (groupOrderItem) {
      groupOrderItem.paid = true;
    }

    // Initialize or update payment coordination
    let coordination = null;
    if (groupOrder.paymentCoordinationId) {
      coordination = await paymentCoordinationModel.findById(
        groupOrder.paymentCoordinationId,
      );
    }

    if (coordination) {
      // Update payment status in coordination
      const paymentIndex = coordination.payments.findIndex(
        (p) => p.userId === userId,
      );
      if (paymentIndex !== -1) {
        coordination.payments[paymentIndex].status = "completed";
        coordination.payments[paymentIndex].completedAt = new Date();
        if (transactionId) {
          coordination.payments[paymentIndex].transactionId = transactionId;
        }
        if (receiptUrl) {
          coordination.payments[paymentIndex].receiptUrl = receiptUrl;
        }
      }

      // Calculate completion percentage
      const completedCount = coordination.payments.filter(
        (p) => p.status === "completed",
      ).length;
      coordination.completionPercentage = Math.round(
        (completedCount / coordination.payments.length) * 100,
      );

      // Update status
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

      // Emit real-time update
      const io = req.app.get("io");
      if (io) {
        // Notify all members about payment update
        emitGroupUpdate(io, groupCode, "payment-status-updated", {
          groupCode,
          userId,
          status: "completed",
          completionPercentage: coordination.completionPercentage,
          paidMembersCount: completedCount,
          totalMembers: coordination.payments.length,
          allPaid: allCompleted,
        });

        // If all paid, notify settlement complete
        if (allCompleted) {
          emitGroupUpdate(io, groupCode, "settlement-complete", {
            groupCode,
            message: "All payments received! Order being placed...",
          });
        }
      }
    }

    // Check if all orders are paid
    const allPaid = groupOrder.orders.every((o) => o.paid === true);

    if (allPaid) {
      console.log(
        `All payments received for group ${groupCode}. Placing order...`,
      );
      // Update group order status to finalized for actual order placement
      groupOrder.status = "paid";
      await groupOrder.save();

      // Emit final confirmation
      const io = req.app.get("io");
      emitGroupUpdate(io, groupCode, "all-payments-received", {
        groupCode,
        message: "All members have paid! Your order is being prepared.",
      });
    } else {
      await groupOrder.save();
    }

    return res.json({
      success: true,
      message: "Payment confirmed",
      data: {
        orderId,
        paid: true,
        allPaid,
        completionPercentage: coordination?.completionPercentage || 0,
      },
    });
  } catch (error) {
    console.error("Error confirming payment:", error);
    return res.json({
      success: false,
      message: "Error confirming payment",
    });
  }
};

// Get payment status for all members in group
const getGroupPaymentStatus = async (req, res) => {
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

    // Get payment status from payment coordination model
    const paymentCoord = await paymentCoordinationModel.findOne({ groupCode });

    if (!paymentCoord) {
      // Fallback to old payment structure if coordination doesn't exist
      const paymentStatus = {
        groupCode,
        totalMembers: groupOrder.members.length,
        payments: groupOrder.orders.map((order) => {
          const member = groupOrder.members.find(
            (m) => m.userId === order.userId,
          );
          return {
            userId: order.userId,
            userName: member?.userName || "Unknown",
            amount: order.amount,
            paid: order.paid,
            orderId: order.orderId,
          };
        }),
        allPaid: groupOrder.orders.every((o) => o.paid === true),
        paidCount: groupOrder.orders.filter((o) => o.paid === true).length,
      };

      return res.json({
        success: true,
        data: paymentStatus,
      });
    }

    // Use payment coordination data (more accurate)
    const paidCount = paymentCoord.payments.filter(
      (p) => p.status === "paid",
    ).length;
    const totalMembers = paymentCoord.payments.length;
    const allPaid = paidCount === totalMembers;

    const paymentStatus = {
      groupCode,
      totalMembers,
      payments: paymentCoord.payments.map((payment) => ({
        userId: payment.userId,
        userName: payment.userName,
        amount: payment.amount,
        paid: payment.status === "paid",
        paidAt: payment.paidAt,
        transactionId: payment.transactionId,
      })),
      paidCount,
      allPaid,
      completionPercentage: Math.round((paidCount / totalMembers) * 100),
      coordinationStatus: paymentCoord.status,
    };

    return res.json({
      success: true,
      data: paymentStatus,
    });
  } catch (error) {
    console.error("Error getting payment status:", error);
    return res.json({
      success: false,
      message: "Error getting payment status",
    });
  }
};

// Leave group order
const leaveGroupOrder = async (req, res) => {
  try {
    const { groupCode, userId } = req.body;

    if (!groupCode || !userId) {
      return res.json({
        success: false,
        message: "Group code and user ID required",
      });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });

    if (!groupOrder) {
      return res.json({
        success: false,
        message: "Group order not found",
      });
    }

    groupOrder.members = groupOrder.members.filter((m) => m.userId !== userId);
    groupOrder.items = groupOrder.items.filter(
      (item) => item.userId !== userId,
    );

    if (groupOrder.members.length === 0) {
      groupOrder.status = "cancelled";
    }

    await groupOrder.save();

    const io = req.app.get("io");
    emitGroupUpdate(io, groupCode, "member-left", {
      groupCode,
      userId,
      members: groupOrder.members,
      items: groupOrder.items,
      status: groupOrder.status,
    });

    return res.json({
      success: true,
      message: "Left group order successfully",
      data: groupOrder,
    });
  } catch (error) {
    console.error("Error leaving group order:", error);
    return res.json({
      success: false,
      message: "Error leaving group order",
    });
  }
};

// Send share link via SMS using Twilio
const shareGroupLinkSms = async (req, res) => {
  try {
    const { groupCode, phoneNumber, frontendUrl } = req.body;

    if (!groupCode || !phoneNumber) {
      return res.json({
        success: false,
        message: "groupCode and phoneNumber required",
      });
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      return res.json({
        success: false,
        message:
          "Invalid phone number format. Please use E.164 format (e.g., +1234567890)",
      });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });
    if (!groupOrder) {
      return res.json({ success: false, message: "Group order not found" });
    }

    const client = getTwilioClient();
    if (!client) {
      return res.json({
        success: false,
        message:
          "SMS service is not configured. Please contact the administrator.",
      });
    }

    const frontend =
      frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173";
    const link = `${frontend}/group-order?code=${groupCode}`;
    const body = `You're invited to join a group order (${groupCode}). Join here: ${link}`;

    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!fromNumber) {
      return res.json({
        success: false,
        message:
          "SMS sender number not configured. Please contact the administrator.",
      });
    }

    const message = await client.messages.create({
      body,
      from: fromNumber,
      to: cleanPhone,
    });

    return res.json({
      success: true,
      message: "SMS sent successfully",
      data: { sid: message.sid },
    });
  } catch (error) {
    console.error("Error sending SMS:", error);

    if (error.code) {
      switch (error.code) {
        case 20003:
          return res.json({
            success: false,
            message:
              "Twilio authentication failed. Please contact the administrator.",
          });
        case 20404:
          return res.json({
            success: false,
            message: "Invalid sender number. Please contact the administrator.",
          });
        case 21211:
        case 21601:
        case 21614:
          return res.json({
            success: false,
            message: "Invalid phone number. Please check and try again.",
          });
        case 29999:
          return res.json({
            success: false,
            message: "Twilio account issue. Please contact the administrator.",
          });
        default:
          if (
            error.message &&
            error.message.includes("not a valid phone number")
          ) {
            return res.json({
              success: false,
              message: "Invalid phone number. Please check and try again.",
            });
          }
      }
    }

    if (error.message && error.message.includes("ENOTFOUND")) {
      return res.json({
        success: false,
        message:
          "Unable to connect to SMS service. Please check your internet connection.",
      });
    }

    if (error.message && error.message.includes("ETIMEDOUT")) {
      return res.json({
        success: false,
        message: "SMS service request timed out. Please try again.",
      });
    }

    return res.json({
      success: false,
      message:
        "Failed to send SMS. Please try again later or use an alternative method to share the link.",
    });
  }
};

// Check if Twilio is configured
const checkTwilioConfig = async (req, res) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  const isConfigured = !!(sid && token && phoneNumber);

  return res.json({
    success: true,
    configured: isConfigured,
  });
};

// Save chat message to MongoDB
const saveChatMessage = async (groupCode, userId, userName, message) => {
  try {
    const groupOrder = await groupOrderModel.findOne({ groupCode });
    if (!groupOrder) {
      console.error("Group order not found for chat message");
      return null;
    }

    if (!groupOrder.chatMessages) {
      groupOrder.chatMessages = [];
    }

    groupOrder.chatMessages.push({
      userId,
      userName,
      message,
      timestamp: new Date(),
    });

    await groupOrder.save();
    return groupOrder.chatMessages;
  } catch (error) {
    console.error("Error saving chat message:", error);
    return null;
  }
};

const getChatMessages = async (req, res) => {
  try {
    const { groupCode } = req.body;

    if (!groupCode) {
      return res.json({ success: false, message: "Group code required" });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });

    if (!groupOrder) {
      return res.json({ success: false, message: "Group order not found" });
    }

    return res.json({ success: true, messages: groupOrder.chatMessages || [] });
  } catch (error) {
    console.error("Error getting chat messages:", error);
    return res.json({ success: false, message: "Error getting chat messages" });
  }
};

// Mark individual payment as complete in a group order
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

export {
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
  saveChatMessage,
  getChatMessages,
  completeGroupOrder,
  confirmPayment,
  getGroupPaymentStatus,
  createPaymentSession,
};
