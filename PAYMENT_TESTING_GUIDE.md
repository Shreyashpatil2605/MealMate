# Real-Time Split Payment System - Complete Testing Guide

## Overview

This guide provides step-by-step instructions to test the real-time split payment coordination system for group orders. The system allows multiple users to share a bill, with each user paying their portion individually via Stripe, with automatic order placement when all payments are complete.

---

## Table of Contents

1. [Setup Requirements](#setup-requirements)
2. [Environment Configuration](#environment-configuration)
3. [System Architecture Overview](#system-architecture-overview)
4. [Pre-Testing Checklist](#pre-testing-checklist)
5. [Testing Scenarios](#testing-scenarios)
6. [Troubleshooting](#troubleshooting)
7. [Production Deployment Checklist](#production-deployment-checklist)

---

## Setup Requirements

### Backend Requirements

- Node.js v14+ installed
- MongoDB Atlas or local MongoDB running
- Stripe account with API keys
- Environment variables properly configured

### Frontend Requirements

- Node.js v14+ installed
- React Router DOM configured
- Socket.io-client library
- React Toastify for notifications

### Software for Testing

- **Postman** or **cURL** for API testing
- **Stripe CLI** for webhook testing (optional but recommended)
- Browser DevTools (F12) for Socket.io monitoring
- Terminal for running multiple instances

---

## Environment Configuration

### Backend .env Setup

Add these environment variables to your `.env` file:

```env
# Database
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/food-delivery

# Server
PORT=4000

# Stripe Keys
STRIPE_PUBLIC_KEY=pk_test_your_test_public_key_here
STRIPE_SECRET_KEY=sk_test_your_test_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_test_webhook_secret_here

# JWT
JWT_SECRET=your_jwt_secret_key

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### Getting Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Sign in or create a free account
3. Navigate to **Developers > API keys**
4. Copy your **Test** keys (not Live keys)
5. Similarly, get your Webhook Secret from **Developers > Webhooks**

### Testing Stripe Cards

For testing payments, use these Stripe test card numbers:

| Card Type            | Number              | Exp   | CVC |
| -------------------- | ------------------- | ----- | --- |
| Visa (Success)       | 4242 4242 4242 4242 | 12/25 | 123 |
| Visa (Decline)       | 4000 0000 0000 0002 | 12/25 | 123 |
| Visa (Auth Required) | 4000 2500 0000 3155 | 12/25 | 123 |

---

## System Architecture Overview

### Payment Flow

```
1. User Creates Group Order
   ↓
2. Users Click "Finalize Order"
   → System Creates PaymentCoordination Document
   ↓
3. Users Navigate to Payment Page
   → Displays members and amounts
   ↓
4. User Clicks "Pay Now"
   → Redirects to Stripe Checkout
   ↓
5. User Completes Payment on Stripe
   ↓
6. Stripe Sends Webhook Event (payment_intent.succeeded)
   ↓
7. Backend Updates Payment Status
   → Emits Socket.io Event to Group
   ↓
8. All Members' Pages Update in Real-Time
   ↓
9. Repeat for All Members
   ↓
10. When All Paid
    → Automatic Order Placement
    → Socket.io Notification Sent
    → Page Shows Success Message
```

### Sequence Diagram

```
User A              Stripe              Backend             User B Browser
   |                  |                    |                    |
   |--Pay Now-------->|                    |                    |
   |              (Payment Page)           |                    |
   |                  |                    |                    |
   |--Complete Pay--->|                    |                    |
   |              (Payment Intent)         |                    |
   |                  |--Webhook Event---->|                    |
   |                  |            (payment_intent.succeeded)    |
   |                  |                    |--Socket.io Event-->|
   |                  |                    |    (paid status)   |
   |                  |                    |--Update UI-------->|
   |                  |                    |                    |
   |<--Confirmation---|                    |                    |
   |                  |                    |                    |
   [Repeat for User B making payment]     |                    |
   |                  |                    |                    |
   |                  |                    |--Socket.io------->|
   |                  |                    |(settlement-complete)|
   |                  |                    |                    |
   |                  |                    |--Place Order------>|
```

---

## Pre-Testing Checklist

Before running tests, verify:

- [ ] Backend server is running (`npm start` or `npm run dev`)
- [ ] Frontend dev server is running (`npm run dev`)
- [ ] All environment variables are set in `.env`
- [ ] MongoDB is accessible
- [ ] Stripe test keys are valid
- [ ] Socket.io is properly configured in `server.js`
- [ ] Frontend has GroupOrderPayment component imported in `App.jsx`
- [ ] Browser DevTools are ready to monitor Network/Console/WebSockets

---

## Testing Scenarios

### Scenario 1: Single User Payment Flow

**Objective:** Verify that a single user can complete payment and order is placed

**Steps:**

1. **Create Group Order**

   ```
   - Open frontend at http://localhost:5173
   - Navigate to Group Order page
   - Add items to group order
   - Invite other members (or use same browser in incognito)
   - Click "Finalize Order"
   ```

2. **Navigate to Payment Page**

   ```
   - Should be redirected to /group-order/ABC123/payment
   - See member list with payment status (all showing "Pending")
   - See progress bar at 0%
   ```

3. **Complete Payment**

   ```
   - Click "Pay Now" button
   - Redirected to Stripe Checkout
   - Use test card: 4242 4242 4242 4242
   - Email: test@example.com
   - Exp: 12/25, CVC: 123
   - Click "Pay" button
   ```

4. **Verify Results**
   ```
   - Should see success screen
   - Payment page should update in real-time
   - Your card should show "Paid" status
   - Toast notification should show payment confirmation
   - Progress bar should show 100%
   - Should see "Order placed successfully" message
   ```

**Expected Outcomes:**

- ✅ Payment marked as paid in UI
- ✅ Toast notification appears
- ✅ Progress bar updates to 100%
- ✅ Order status changes to "confirmed"
- ✅ Database shows paid status

---

### Scenario 2: Multiple Users Sequential Payment

**Objective:** Verify real-time updates across multiple users as payments arrive

**Students:**

1. **Setup Multiple Users**

   ```
   - Open Browser Tab 1 (User A)
   - Open Browser Tab 2 (User B) - Same group code
   - Open Browser Tab 3 (Admin monitoring)
   ```

2. **Create Group Order**

   ```
   - In Tab 1: Create group order with 3 items
   - Add User B and User C to group
   - Split amount: User A=$30, User B=$25, User C=$20
   - Click "Finalize Order"
   ```

3. **Navigate to Payment Pages**

   ```
   - Tab 1: Navigate to payment page as User A
   - Tab 2: Navigate to payment page as User B (same group code)
   - Tab 3: Open browser console to monitor Socket.io events
   ```

4. **User A Pays**

   ```
   - In Tab 1: Click "Pay Now"
   - Complete Stripe payment (test card)
   - Do NOT close modal
   ```

5. **Verify Real-time Updates**

   ```
   - Tab 1: Should show "Paid" status with checkmark
   - Tab 2: Should automatically update showing User A as "Paid" (NO refresh needed)
   - Tab 2: Progress bar should update to 33%
   - Tab 2: Toast notification should say "User A paid their share"
   ```

6. **User B Pays**

   ```
   - In Tab 2: Click "Pay Now"
   - Complete Stripe payment
   ```

7. **Verify Updates Again**

   ```
   - Tab 1 & 2: Should show both users as "Paid"
   - Progress bar should be 66%
   - Still awaiting User C
   ```

8. **User C Pays** (simulate with Tab 1)

   ```
   - Open Tab 1 in incognito (User C)
   - Navigate to payment page with same group code
   - Click "Pay Now" and complete payment
   ```

9. **Verify Order Placement**
   ```
   - All tabs should automatically update to 100%
   - All tabs should show "Order Placed Successfully"
   - Socket.io event "settlement-complete" should fire
   - Database: group order should have orderStatus = "confirmed"
   ```

**Expected Outcomes:**

- ✅ Real-time updates visible without page refresh
- ✅ Toast notifications appear for each payment
- ✅ Progress bar increments correctly
- ✅ All users see same status
- ✅ Order automatically placed when 100% paid

---

### Scenario 3: Payment Failure Handling

**Objective:** Verify system handles failed payments correctly

**Steps:**

1. **Start Group Order** (same as Scenario 1)

2. **Attempt Failed Payment**

   ```
   - Click "Pay Now"
   - Use declined test card: 4000 0000 0000 0002
   - Try to pay
   ```

3. **Verify Failure Handling**

   ```
   - Should see error message on Stripe page
   - Should NOT be marked as paid
   - Payment status should remain "Pending"
   - Toast should show "Payment failed"
   - Can retry with different card
   ```

4. **Retry Payment**

   ```
   - Go back to payment page
   - Click "Pay Now" again
   - Use successful card: 4242 4242 4242 4242
   - Complete payment
   ```

5. **Verify Success**
   ```
   - Should now show "Paid" status
   - Other members should see update
   ```

**Expected Outcomes:**

- ✅ Failed payment doesn't mark user as paid
- ✅ Error message clearly displayed
- ✅ Can retry payment
- ✅ System recovers correctly after failure

---

### Scenario 4: Webhook Integration Testing

**Objective:** Verify Stripe webhook correctly updates payment status

**Setup Stripe CLI (Recommended):**

```bash
# Download Stripe CLI from https://stripe.com/docs/stripe-cli
# Then run:
stripe login
stripe listen --forward-to localhost:4000/webhook/stripe
```

**Steps:**

1. **Start Group Order** using one of scenarios above

2. **Make Payment**

   ```
   - Click "Pay Now"
   - Use test card
   - Complete payment
   ```

3. **Monitor Webhook**

   ```
   - Check Stripe CLI output for webhook events
   - Should see: payment_intent.succeeded
   - Should see: Webhook signature verified
   ```

4. **Verify Backend Processing**

   ```
   - Check backend console logs:
     "✅ Payment succeeded for intent: pi_xxx"
     "✅ All payments completed for group ABC123"
   ```

5. **Verify Database**
   ```
   - Use MongoDB Compass
   - Check paymentCoordinationModel collection
   - Verify: payments[x].status = "paid"
   - Verify: payments[x].transactionId = "pi_xxx"
   - Verify: settlementDetails.status = "completed"
   ```

**Expected Outcomes:**

- ✅ Webhook received and processed
- ✅ Payment status updated in database
- ✅ Socket.io events emitted
- ✅ Frontend updates without manual refresh

---

### Scenario 5: Timeout/Expiration Testing

**Objective:** Verify system handles payment timeouts correctly

**Steps:**

1. **Create Group Order**

   ```
   - Setup group order as before
   - Note the group code and creation time
   ```

2. **Wait for Reminder** (Optional)

   ```
   - System sends reminders every 30 minutes
   - Verify email/SMS notifications if configured
   ```

3. **Monitor Scheduled Cleanup**
   ```
   - Unpaid orders cleanup after 24 hours (configurable)
   - Check backend logs for cleanup messages
   ```

**Expected Outcomes:**

- ✅ Reminders sent at appropriate intervals
- ✅ Old unpaid orders cleaned up
- ✅ No orphaned data in database

---

### Scenario 6: Split Amount Verification

**Objective:** Verify correct amount calculations for each user

**Steps:**

1. **Create Group Order with Specific Items**

   ```
   - Item 1: Biryani x1 = $15
   - Item 2: Paneer Tikka x2 = $20 (total)
   - Item 3: Naan x3 = $9 (total)
   - Total: $44
   - 2 members: User A and User B
   ```

2. **Check Payment Amounts**

   ```
   - User A payment card: Should show $22 (50% split)
   - User B payment card: Should show $22 (50% split)
   - Total: $44 ✓
   ```

3. **Make Payment and Verify**
   ```
   - User A pays $22
   - User B pays $22
   - Database records correct amounts
   ```

**Expected Outcomes:**

- ✅ Amounts correctly calculated
- ✅ Each user sees correct amount to pay
- ✅ Total matches order total

---

## Testing with API/Postman

### Test Payment Confirmation Endpoint

```bash
# Manual POST request to confirm payment
curl -X POST http://localhost:4000/api/group-order/confirm-payment \
  -H "Content-Type: application/json" \
  -d '{
    "groupCode": "ABC123",
    "userId": "user123",
    "sessionId": "cs_live_xxx"
  }'

# Expected Response:
# {
#   "success": true,
#   "message": "Payment confirmed",
#   "paymentStatus": "paid",
#   "allPaymentComplete": false
# }
```

### Test Payment Status Endpoint

```bash
# Get payment status for group
curl -X GET http://localhost:4000/api/group-order/payment-status?groupCode=ABC123 \
  -H "Authorization: Bearer your_jwt_token"

# Expected Response:
# {
#   "groupCode": "ABC123",
#   "paymentStatus": {
#     "payments": [
#       {
#         "userId": "user1",
#         "userName": "John",
#         "amount": 25,
#         "status": "paid",
#         "paidAt": "2026-03-04T10:30:00Z"
#       }
#     ],
#     "completionPercentage": 33,
#     "allPaid": false
#   }
# }
```

---

## Monitoring Socket.io Events

### In Browser Console

```javascript
// Open DevTools (F12) → Console tab

// Watch Socket.io connections
const socket = io("http://localhost:4000");

socket.on("payment-status-updated", (data) => {
  console.log("💳 Payment Update:", data);
  // Output: { userId, status: 'paid', userName, paidAt }
});

socket.on("settlement-complete", (data) => {
  console.log("✅ Settlement Complete:", data);
  // Output: { message, completedAt }
});

socket.on("all-payments-received", (data) => {
  console.log("🎉 All Payments Received:", data);
});
```

### In Browser Network Tab

1. Open DevTools → Network tab
2. Look for WebSocket connections
3. Filter by "WS" (WebSocket)
4. Should see `/socket.io/` connections
5. Click and view messages tab to see real-time data

---

## Database Validation

### Using MongoDB Compass

```javascript
// Check payment coordination records
db.paymentcoordinations.findOne({
  groupCode: "ABC123"
})

// Expected structure:
{
  _id: ObjectId("..."),
  groupCode: "ABC123",
  groupOrderId: ObjectId("..."),
  payments: [
    {
      userId: "user1",
      userName: "John Doe",
      amount: 25.00,
      status: "paid",
      paidAt: ISODate("2026-03-04T10:30:00Z"),
      transactionId: "pi_1234567890",
      createdAt: ISODate("2026-03-04T10:00:00Z")
    },
    {
      userId: "user2",
      userName: "Jane Smith",
      amount: 25.00,
      status: "pending",
      paidAt: null,
      transactionId: null,
      createdAt: ISODate("2026-03-04T10:00:00Z")
    }
  ],
  settlementDetails: {
    status: "pending", // or "completed"
    createdAt: ISODate("2026-03-04T10:00:00Z"),
    completedAt: ISODate("2026-03-04T10:35:00Z")
  }
}

// Check group order updates
db.grouporders.findOne({
  groupCode: "ABC123"
})

// Should have these fields populated:
{
  paymentCoordinationId: ObjectId("..."),
  orderStatus: "confirmed", // after all payments
  settlement: {
    allPaid: true,
    completedAt: ISODate("...")
  }
}
```

---

## Performance Testing

### Load Testing Scenario

```bash
# Simulate 10 simultaneous group payments
# Use Apache Bench or Artillery

# Install Artillery:
npm install -g artillery

# Create load-test.yml:
config:
  target: "http://localhost:4000"
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Ramp up"

scenarios:
  - name: "Payment Flow"
    flow:
      - post:
          url: "/webhook/stripe"
          json:
            type: "payment_intent.succeeded"
            data:
              object:
                id: "pi_{{ $randomNumber(100000, 999999) }}"
                metadata:
                  groupCode: "{{ $randomString(6) }}"
                  userId: "{{ $randomString(8) }}"

# Run test:
artillery run load-test.yml
```

---

## Troubleshooting

### Issue: Webhook Not Triggering

**Symptoms:**

- Payment completed in Stripe but backend payment status not updated
- No "payment-status-updated" Socket.io event

**Solutions:**

```bash
# 1. Verify webhook endpoint is accessible
curl -X POST http://localhost:4000/webhook/stripe \
  -H "stripe-signature: test" \
  -d '{"type":"payment_intent.succeeded"}'

# 2. Check STRIPE_WEBHOOK_SECRET is set correctly
echo $STRIPE_WEBHOOK_SECRET

# 3. Check server logs for webhook errors
npm run dev  # Watch for error messages

# 4. Manually test with Stripe CLI
stripe trigger payment_intent.succeeded

# 5. Verify endpoint registration in server.js
# Should see log: "⚠️  Stripe Webhook configured at: POST /webhook/stripe"
```

### Issue: Socket.io Events Not Broadcasting

**Symptoms:**

- User A pays but User B's page doesn't update
- Need to refresh page to see updates

**Solutions:**

```javascript
// 1. Check Socket.io connection in browser console
console.log(socket.connected); // Should be true

// 2. Verify group room is joined
socket.emit("join-group", "ABC123");

// 3. Check backend logs for Socket.io events
// Backend should log: "Socket xxx joined group: ABC123"

// 4. Verify io instance is accessible in controllers
// In groupOrderController.js:
const io = req.app.get("io"); // Should work

// 5. Check Socket.io CORS configuration
// In server.js, verify cors settings allow your domain
```

### Issue: Payment Not Marking as Paid

**Symptoms:**

- Payment successful in Stripe
- Payment status remains "Pending"
- Progress bar doesn't update

**Solutions:**

```bash
# 1. Check database for payment coordination record
# Use MongoDB Compass to verify document exists

# 2. Check metadata is sent with Stripe session
# In frontend, when redirecting to Stripe:
# Should include metadata: {
#   groupCode: "ABC123",
#   userId: "user123"
# }

# 3. Verify paymentCoordinationModel has correct record
# Check MongoDB for:
# - groupCode matches
# - userId exists in payments array

# 4. Check webhook is receiving correct metadata
# Add console.log in server.js webhook handler:
console.log("Metadata:", paymentIntent.metadata);
```

### Issue: CORS Errors

**Symptoms:**

- "Access to XMLHttpRequest blocked by CORS policy"

**Solutions:**

```javascript
// In server.js, verify CORS is configured:
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Or for testing, allow all origins:
app.use(cors()); // Be more restrictive in production
```

### Issue: Payment History Not Showing

**Symptoms:**

- Transaction ID not stored
- Can't track payment reconciliation

**Solutions:**

```javascript
// Verify transaction ID is saved in webhook handler:
paymentCoord.payments[paymentIndex].transactionId = paymentIntent.id;

// Check database for paymentIntent.id format:
// Should be "pi_1234567890..." format

// Verify activity log is being created:
paymentCoord.activityLog.push({
  action: "payment_received",
  userId: userId,
  timestamp: new Date(),
  transactionId: paymentIntent.id,
});
```

---

## Production Deployment Checklist

Before deploying to production:

### Security

- [ ] Use HTTPS only (no HTTP)
- [ ] Set `STRIPE_SECRET_KEY` (from .env, never commit)
- [ ] Use production Stripe keys (not test keys)
- [ ] Set `STRIPE_WEBHOOK_SECRET` from production webhook
- [ ] Enable CORS restrictions (don't use `*`)
- [ ] Set JWT secrets securely
- [ ] Use `secure: true` for cookies
- [ ] Enable rate limiting on payment endpoints
- [ ] Add request validation and sanitization

### Performance

- [ ] Set up Redis for Socket.io adapter (horizontal scaling)
- [ ] Implement payment timeout (30 min recommended)
- [ ] Add database indexes on frequently queried fields:
  ```javascript
  db.paymentcoordinations.createIndex({ groupCode: 1 });
  db.paymentcoordinations.createIndex({ createdAt: 1 });
  ```
- [ ] Setup monitoring for webhook failures
- [ ] Implement retry logic for failed webhooks

### Monitoring

- [ ] Add logging for all payment operations
- [ ] Setup alerts for failed payments
- [ ] Monitor webhook success rate
- [ ] Track payment latency
- [ ] Setup database backup schedule

### Testing Before Deploy

- [ ] End-to-end test with production keys
- [ ] Test webhook with Stripe CLI against production URL
- [ ] Test with real (small) Stripe payments (stripe allows many tests)
- [ ] Verify email/SMS notifications work
- [ ] Load test payment endpoints
- [ ] Test payment failure scenarios

### Production Stripe Webhook Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add Production Webhook Endpoint:
   ```
   https://yourdomain.com/webhook/stripe
   ```
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.dispute.created`
4. Get Webhook Secret
5. Add to production `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_live_xxx...
   ```

### Deployment Steps

```bash
# 1. Build frontend
cd frontend && npm run build

# 2. Deploy to hosting (Vercel, Netlify, etc.)

# 3. Deploy backend (Heroku, Railway, etc.)
git push heroku main

# 4. Verify environment variables on hosting platform
# Don't forget STRIPE_WEBHOOK_SECRET

# 5. Run smoke tests
# Make small test payment
# Verify webhook triggers
# Verify order is placed

# 6. Monitor logs for errors
# Check production logging service
```

---

## Success Criteria

Your payment system is working correctly when:

✅ User can complete payment without page refresh  
✅ Payment status updates appear in real-time for all group members  
✅ Toast notifications appear for payment events  
✅ Progress bar accurately reflects payment completion  
✅ Order is automatically placed when all payments complete  
✅ Failed payments don't mark user as paid  
✅ Webhook successfully processes Stripe events  
✅ Database accurately records payment transactions  
✅ System handles multiple simultaneous payments  
✅ No errors in browser console or backend logs

---

## Support & Next Steps

If tests pass: Proceed to production deployment  
If issues occur: Check troubleshooting section above

For additional help:

- Review [Stripe Documentation](https://stripe.com/docs)
- Check [Socket.io Documentation](https://socket.io/docs/)
- Review logs in browser F12 DevTools and backend console
- Test with [Stripe Test Cards](https://stripe.com/docs/testing)
