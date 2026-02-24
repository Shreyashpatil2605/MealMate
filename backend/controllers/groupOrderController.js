import groupOrderModel from "../models/groupOrderModel.js";
import orderModel from "../models/orderModel.js";
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
        },
      ],
      items: [],
    });

    await newGroupOrder.save();

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

    // Calculate totals per person
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
        itemName: item.itemName,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal,
      });
    });

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
// Supports 'split' payments (each member pays their share) or 'single_payer' where one user pays the whole amount.
// Expects: { groupCode, paymentOption: 'split'|'single_payer', frontendUrl, payerId (optional) }
const finalizeGroupOrder = async (req, res) => {
  try {
    const {
      groupCode,
      paymentOption = "split",
      frontendUrl,
      payerId,
    } = req.body;

    if (!groupCode) {
      return res.json({ success: false, message: "Group code required" });
    }

    const groupOrder = await groupOrderModel.findOne({ groupCode });
    if (!groupOrder) {
      return res.json({ success: false, message: "Group order not found" });
    }

    if (groupOrder.items.length === 0) {
      return res.json({ success: false, message: "Group order is empty" });
    }

    // Calculate split per user
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

    // Prepare response structure
    const paymentSessions = [];

    if (paymentOption === "single_payer") {
      // payerId must be provided
      if (!payerId) {
        return res.json({
          success: false,
          message: "payerId required for single_payer",
        });
      }

      // create a combined order for payer with all items
      const combinedItems = groupOrder.items.map((it) => ({
        name: it.itemName,
        price: it.price,
        quantity: it.quantity,
      }));

      const newOrder = new orderModel({
        userId: payerId,
        items: combinedItems,
        amount: Math.round(grandTotal * 100) / 100,
        address: req.body.address || {},
      });
      await newOrder.save();

      // create stripe session if frontendUrl provided
      let sessionUrl = null;
      if (frontendUrl && process.env.STRIPE_SECRET_KEY) {
        const line_items = combinedItems.map((item) => ({
          price_data: {
            currency: "usd",
            product_data: { name: item.name },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        }));
        // optional delivery charge
        line_items.push({
          price_data: {
            currency: "usd",
            product_data: { name: "Delivery Charges" },
            unit_amount: 200,
          },
          quantity: 1,
        });

        const session = await stripe.checkout.sessions.create({
          line_items,
          mode: "payment",
          success_url: `${frontendUrl}/verify?success=true&orderId=${newOrder._id}`,
          cancel_url: `${frontendUrl}/verify?success=false&orderId=${newOrder._id}`,
        });
        sessionUrl = session.url;
      }

      // store order reference on groupOrder
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

      return res.json({
        success: true,
        message: "Group finalized (single payer)",
        data: { groupOrder, sessionUrl },
      });
    }

    // Default: split payments (per-user orders and sessions)
    for (const [userId, data] of Object.entries(splitByUser)) {
      const itemsForUser = data.items.map((it) => ({
        name: it.itemName,
        price: it.price,
        quantity: it.quantity,
      }));
      const amount = Math.round(data.total * 100) / 100;

      const newOrder = new orderModel({
        userId,
        items: itemsForUser,
        amount,
        address: req.body.address || {},
      });
      await newOrder.save();

      // create stripe session if frontendUrl provided
      let sessionUrl = null;
      if (frontendUrl && process.env.STRIPE_SECRET_KEY) {
        const line_items = itemsForUser.map((item) => ({
          price_data: {
            currency: "usd",
            product_data: { name: item.name },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        }));
        line_items.push({
          price_data: {
            currency: "usd",
            product_data: { name: "Delivery Charges" },
            unit_amount: 200,
          },
          quantity: 1,
        });

        const session = await stripe.checkout.sessions.create({
          line_items,
          mode: "payment",
          success_url: `${frontendUrl}/verify?success=true&orderId=${newOrder._id}`,
          cancel_url: `${frontendUrl}/verify?success=false&orderId=${newOrder._id}`,
        });
        sessionUrl = session.url;
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

    groupOrder.status = "completed";
    await groupOrder.save();

    return res.json({
      success: true,
      message: "Group finalized (split)",
      data: { groupOrder, paymentSessions },
    });
  } catch (error) {
    console.error("Error finalizing group order:", error);
    return res.json({
      success: false,
      message: "Error finalizing group order",
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

    // Remove user from members
    groupOrder.members = groupOrder.members.filter((m) => m.userId !== userId);

    // Remove user's items
    groupOrder.items = groupOrder.items.filter(
      (item) => item.userId !== userId,
    );

    // If no members left, mark as cancelled
    if (groupOrder.members.length === 0) {
      groupOrder.status = "cancelled";
    }

    await groupOrder.save();

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

    const groupOrder = await groupOrderModel.findOne({ groupCode });
    if (!groupOrder) {
      return res.json({ success: false, message: "Group order not found" });
    }

    const client = getTwilioClient();
    if (!client) {
      return res.json({
        success: false,
        message: "Twilio not configured on server",
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
        message: "TWILIO_PHONE_NUMBER not set",
      });
    }

    const message = await client.messages.create({
      body,
      from: fromNumber,
      to: phoneNumber,
    });

    return res.json({
      success: true,
      message: "SMS sent",
      data: { sid: message.sid },
    });
  } catch (error) {
    console.error("Error sending SMS:", error);
    return res.json({ success: false, message: "Error sending SMS" });
  }
};

export {
  createGroupOrder,
  joinGroupOrder,
  addItemToGroupOrder,
  removeItemFromGroupOrder,
  getGroupOrderDetails,
  finalizeGroupOrder,
  leaveGroupOrder,
  shareGroupLinkSms,
};
