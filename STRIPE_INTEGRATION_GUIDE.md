# Stripe Payment Session Integration Guide

## Overview

This guide explains how to integrate Stripe payment session creation with the payment coordination system. The frontend must create Stripe checkout sessions with proper metadata so the webhook can correctly identify and process payments.

---

## Architecture

### Payment Session Flow

```
Frontend: User Clicks "Pay Now"
   ↓
Frontend: Calls Backend API to create Stripe Session
   ↓
Backend: Creates Stripe Checkout Session with:
   - Amount (user's split)
   - Metadata: { groupCode, userId }
   - Success/Cancel URLs
   ↓
Backend: Returns Session ID to Frontend
   ↓
Frontend: Redirects to Stripe Checkout URL
   ↓
User: Completes Payment on Stripe
   ↓
Stripe: Sends Webhook Event (payment_intent.succeeded)
   ↓
Backend: Processes webhook and updates payment status
   ↓
Frontend: Receives Socket.io event and updates UI in real-time
```

---

## Backend: Create Stripe Session Endpoint

### Implementation

Add this endpoint to your `orderRoute.js` or `groupOrderRoute.js`:

```javascript
// POST /api/order/create-payment-session or /api/group-order/create-payment-session
// Request body:
// {
//   "groupCode": "ABC123",
//   "userId": "user123",
//   "amount": 2500  // in cents ($25.00 = 2500)
// }

import Stripe from "stripe";
import groupOrderModel from "../models/groupOrderModel.js";
import paymentCoordinationModel from "../models/paymentCoordinationModel.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createPaymentSession = async (req, res) => {
  try {
    const { groupCode, userId, amount } = req.body;

    // Validate input
    if (!groupCode || !userId || !amount) {
      return res
        .status(400)
        .json({ error: "Missing required fields: groupCode, userId, amount" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0" });
    }

    // Verify payment coordination exists
    const paymentCoord = await paymentCoordinationModel.findOne({
      groupCode,
    });

    if (!paymentCoord) {
      return res
        .status(404)
        .json({ error: "Payment coordination not found for this group" });
    }

    // Verify user is part of this group payment
    const userPayment = paymentCoord.payments.find((p) => p.userId === userId);
    if (!userPayment) {
      return res
        .status(403)
        .json({ error: "User not found in payment coordination" });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Group Order Payment - ${groupCode}`,
              description: `Split payment for group order ${groupCode}`,
              metadata: {
                groupCode,
                userId,
              },
            },
            unit_amount: Math.round(amount), // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // IMPORTANT: Include metadata for webhook processing
      payment_intent_data: {
        metadata: {
          groupCode,
          userId,
          userName: userPayment.userName,
        },
      },
      // URLs to redirect after payment
      success_url: `${process.env.FRONTEND_URL}/group-order/${groupCode}/payment?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/group-order/${groupCode}/payment?cancelled=true`,
      // Customer details (optional but recommended)
      customer_email: req.user?.email || undefined,
      metadata: {
        groupCode,
        userId,
      },
    });

    // Log session creation
    console.log(`💳 Payment session created: ${session.id} for user ${userId}`);

    res.json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url,
      publicKey: process.env.STRIPE_PUBLIC_KEY,
    });
  } catch (error) {
    console.error("Error creating payment session:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to create payment session" });
  }
};
```

### Register the Route

In `groupOrderRoute.js`:

```javascript
import { createPaymentSession } from "../controllers/groupOrderController.js";

// Add this route
router.post("/create-payment-session", createPaymentSession);

// Full route becomes: POST /api/group-order/create-payment-session
```

---

## Frontend: Calling Payment Session API

### In GroupOrderPayment.jsx

Update the component to create Stripe sessions:

```javascript
// Add this function to GroupOrderPayment.jsx

// Create Stripe session when user clicks "Pay Now"
const handlePayNow = async (memberId, amount, userName) => {
  try {
    setLoading(true);

    // Get the group code from URL
    const groupCode = groupCode; // Already available from URL params

    // Call backend to create Stripe session
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/group-order/create-payment-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Include JWT token
        },
        body: JSON.stringify({
          groupCode,
          userId: memberId,
          amount: Math.round(amount * 100), // Convert to cents
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to create payment session");
    }

    const data = await response.json();

    if (!data.success || !data.sessionUrl) {
      throw new Error("Invalid response from server");
    }

    // Redirect to Stripe Checkout
    // Option 1: Window redirect (simpler)
    window.location.href = data.sessionUrl;

    // Option 2: Use Stripe.js redirect (more control)
    // const stripe = Stripe(data.publicKey);
    // await stripe.redirectToCheckout({ sessionId: data.sessionId });

    setLoading(false);
  } catch (error) {
    console.error("Error creating payment session:", error);
    setError(error.message);
    showToastNotification(`Payment Error: ${error.message}`, "error");
    setLoading(false);
  }
};
```

### Update the Pay Now Button

```javascript
// In the payment card JSX:

<button
  className="pay-now-button"
  onClick={() => handlePayNow(member.userId, member.amount, member.userName)}
  disabled={member.status === "paid" || loading}
>
  {loading ? "Processing..." : "Pay Now"}
</button>
```

---

## Alternative: Using Stripe.js (Advanced)

If you want to use Stripe.js instead of redirecting:

### Install Stripe.js

```bash
npm install @stripe/stripe-js
```

### Create Stripe.js Integration

```javascript
// Create a new file: frontend/src/services/stripeService.js

import { loadStripe } from "@stripe/stripe-js";

let stripePromise;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
  }
  return stripePromise;
};

export const redirectToCheckout = async (sessionId) => {
  const stripe = await getStripe();
  const { error } = await stripe.redirectToCheckout({ sessionId });
  if (error) {
    throw new Error(error.message);
  }
};
```

### Use in Component

```javascript
import { redirectToCheckout } from "../services/stripeService.js";

const handlePayNow = async (memberId, amount, userName) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/group-order/create-payment-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          groupCode,
          userId: memberId,
          amount: Math.round(amount * 100),
        }),
      },
    );

    const data = await response.json();

    // Use Stripe.js to redirect
    await redirectToCheckout(data.sessionId);
  } catch (error) {
    console.error("Payment error:", error);
  }
};
```

---

## Environment Variables

### Backend (.env)

```env
# Stripe Keys
STRIPE_PUBLIC_KEY=pk_test_your_public_key
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_test_webhook_secret

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:4000
VITE_STRIPE_PUBLIC_KEY=pk_test_your_public_key
```

---

## Webhook Processing (Already Implemented)

The webhook in `server.js` already handles:

```javascript
// POST /webhook/stripe

// Extracts metadata
const { groupCode, userId } = paymentIntent.metadata;

// Updates payment status
paymentCoord.payments[paymentIndex].status = "paid";
paymentCoord.payments[paymentIndex].transactionId = paymentIntent.id;

// Broadcasts Socket.io event
io.to(groupCode).emit("payment-status-updated", {
  userId,
  status: "paid",
  userName: paymentCoord.payments[paymentIndex].userName,
});

// Checks if all paid and places order
const allPaid = paymentCoord.payments.every((p) => p.status === "paid");
if (allPaid) {
  io.to(groupCode).emit("settlement-complete", {
    message: "All payments received! Order is being placed...",
  });
}
```

---

## Testing Payment Sessions

### Manual Test with cURL

```bash
# Create a payment session
curl -X POST http://localhost:4000/api/group-order/create-payment-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "groupCode": "ABC123",
    "userId": "user123",
    "amount": 2500
  }'

# Expected response:
# {
#   "success": true,
#   "sessionId": "cs_test_xxx",
#   "sessionUrl": "https://checkout.stripe.com/pay/cs_test_xxx",
#   "publicKey": "pk_test_xxx"
# }
```

### Using Postman

1. Create new POST request
2. URL: `http://localhost:4000/api/group-order/create-payment-session`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_TOKEN`
4. Body (raw JSON):
   ```json
   {
     "groupCode": "ABC123",
     "userId": "user123",
     "amount": 2500
   }
   ```
5. Click Send
6. Copy `sessionUrl` and open in browser

---

## Error Handling

### Common Issues and Solutions

| Issue                                    | Cause                                 | Solution                            |
| ---------------------------------------- | ------------------------------------- | ----------------------------------- |
| "Missing required fields"                | groupCode, userId, or amount not sent | Check request body in console       |
| "Payment coordination not found"         | Group order not finalized             | Finalize group order first          |
| "User not found in payment coordination" | userId not in group                   | Use correct userId                  |
| "Failed to create payment session"       | Stripe API error                      | Check STRIPE_SECRET_KEY             |
| "Redirect to Stripe failed"              | Invalid session ID                    | Verify backend response             |
| Webhook not processing                   | Metadata not included                 | Verify metadata in session creation |

---

## Security Considerations

### Input Validation

```javascript
// Always validate amount on backend
if (amount <= 0 || amount > 100000) {
  // Reject suspicious amounts
}

// Verify user is authenticated
if (!req.user || !req.user.id) {
  return res.status(401).json({ error: "Unauthorized" });
}

// Verify user is part of group
const groupOrder = await groupOrderModel.findOne({ groupCode });
if (!groupOrder.members.includes(req.user.id)) {
  return res.status(403).json({ error: "Not a member of this group" });
}
```

### Amount Verification

```javascript
// Verify amount matches expected split
const expectedAmount = userPayment.amount;
if (Math.abs(amount - expectedAmount) > 1) {
  // 1 cent tolerance for rounding
  return res.status(400).json({ error: "Invalid amount" });
}
```

---

## Monitoring Payments

### Log Payment Sessions

```javascript
// In your database or logging service, track:
{
  sessionId: "cs_test_xxx",
  groupCode: "ABC123",
  userId: "user123",
  amount: 2500,
  createdAt: new Date(),
  status: "created" // or "completed", "failed", "expired"
}
```

### Monitor in Dashboard

Use Stripe Dashboard → Payments to see:

- All checkout sessions created
- Success/failure rates
- Average payment time
- Revenue by group order

---

## Next Steps

1. ✅ Implement `createPaymentSession` endpoint
2. ✅ Register route in groupOrderRoute.js
3. ✅ Update GroupOrderPayment.jsx with handlePayNow
4. ✅ Add environment variables
5. ✅ Test payment creation with cURL/Postman
6. ✅ Test full user flow
7. ✅ Monitor webhook processing
8. ✅ Test failure scenarios
9. ✅ Deploy to production
10. ✅ Monitor for errors in production

---

## See Also

- [PAYMENT_TESTING_GUIDE.md](./PAYMENT_TESTING_GUIDE.md) - Complete testing guide
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Checkout Setup](https://stripe.com/docs/payments/checkout/how-checkout-works)
- [Webhook Handling](https://stripe.com/docs/webhooks)
