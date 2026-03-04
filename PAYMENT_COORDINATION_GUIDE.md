# Real-Time Split Payment Coordination System

## Overview

The Real-Time Split Payment Coordination System is a comprehensive solution for managing split payments in group orders. It provides real-time updates, automated reminders, payment tracking, and settlement management using WebSocket (Socket.io) technology.

## Features

### 1. **Real-Time Payment Tracking**

- Live updates of payment status for all group members
- Socket.io based instant notifications
- Payment progress visualization
- Completion percentage calculation

### 2. **Multiple Split Methods**

- **Equal Split**: Divide total amount equally among members
- **Proportional Split**: Split based on items ordered by each person
- **Custom Split**: Allow custom amount adjustments for special cases

### 3. **Automated Payment Reminders**

- Scheduled SMS reminders via Twilio
- Email reminders (extensible)
- In-app notifications
- Configurable reminder intervals
- Reminder count tracking

### 4. **Payment Management**

- Track payment status (pending, processing, completed, failed, cancelled)
- Stripe integration for secure payments
- Transaction ID and receipt URL storage
- Payment failure reason logging
- Automatic reconciliation with payment gateway

### 5. **Real-Time Communication**

- Socket.io event emissions for instant updates
- Group-based room broadcasting
- Payment status notifications
- Settlement completion alerts

### 6. **Detailed Analytics & Reporting**

- Payment breakdown per member
- Activity logging with timestamps
- Notification tracking
- Payment history reports
- Settlement summary generation

## Architecture

### Database Models

#### PaymentCoordinationModel

```
- groupCode (unique)
- groupOrderId (reference)
- totalAmount
- splitMethod (equal/custom/proportional)
- payments[] (array of payment objects)
- status (initiated/in-progress/completed/failed/cancelled)
- settlementDetails
- notificationLog
- activityLog
- paymentHistory
```

#### Updated GroupOrderModel

```
- paymentCoordinationId (reference)
- paymentSettings (splitMethod, deadlines, auto-reminders)
- settlement (tracking amounts and completion)
```

### API Endpoints

#### Payment Coordination Routes (`/api/payment-coordination`)

| Method | Endpoint         | Description                      |
| ------ | ---------------- | -------------------------------- |
| POST   | `/initialize`    | Initialize payment coordination  |
| POST   | `/status`        | Get payment coordination status  |
| POST   | `/update-status` | Update individual payment status |
| POST   | `/send-reminder` | Send payment reminder            |
| POST   | `/history`       | Get payment history and logs     |
| POST   | `/breakdown`     | Get detailed payment breakdown   |
| POST   | `/reconcile`     | Reconcile payments with gateway  |

## Implementation Guide

### 1. Backend Setup

#### Step 1: Install Dependencies

```bash
cd backend
npm install socket.io stripe twilio
```

#### Step 2: Update Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...

# Twilio (for SMS reminders)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

#### Step 3: Register Routes in server.js ✓

Already done - routes are registered:

```javascript
app.use("/api/payment-coordination", paymentCoordinationRoute);
```

#### Step 4: Socket.io Integration ✓

Already integrated with payment coordination events.

### 2. Integrate with Group Order Finalization

Update `groupOrderController.js` finalize method to initialize payment coordination:

```javascript
// In finalizeGroupOrder function, after creating orders:
const { initializePaymentCoordination } =
  await import("../controllers/paymentCoordinationController.js");

// Initialize payment coordination
const paymentCoordInit = await initializePaymentCoordination({
  body: {
    groupCode,
    splitMethod: req.body.splitMethod || "equal",
    totalAmount: grandTotal,
  },
  app: {
    get: (key) => {
      if (key === "io") return io;
    },
  },
});
```

### 3. Frontend Integration

#### Step 1: Import PaymentCoordinator Component

```javascript
import PaymentCoordinator from "../components/PaymentCoordinator/PaymentCoordinator";
```

#### Step 2: Add Route in App.jsx

```javascript
<Route
  path="/group-order/:groupCode/payment"
  element={<PaymentCoordinator />}
/>
```

#### Step 3: Update Group Order Page

```javascript
// In GroupOrder.jsx, add button to navigate to payment coordinator
<button onClick={() => navigate(`/group-order/${groupCode}/payment`)}>
  View Payment Status
</button>
```

#### Step 4: StoreContext Setup

Ensure your StoreContext has:

```javascript
const [token, setToken] = useState(() => localStorage.getItem("token"));
const [userId, setUserId] = useState(() => localStorage.getItem("userId"));
const [userName, setUserName] = useState(() =>
  localStorage.getItem("userName"),
);
```

### 4. Usage Flow

#### For Group Creation:

```
1. User creates group order
2. Members join and add items
3. Group finalized -> Payment coordination initialized
4. Each member gets unique payment amount (based on split method)
5. Real-time payment tracking begins
```

#### For Payment:

```
1. Member receives notification
2. Clicks payment link or "Pay Now" button
3. Stripe checkout session opens
4. Payment completion -> Status updated in real-time
5. All members notified (via Socket.io)
6. Reminders sent for unpaid members (automated every 30 mins)
```

#### For Settlement:

```
1. All payments completed or deadline passed
2. Settlement marked as complete
3. Final summary generated
4. Cleanup of expired coordinations (automated every 6 hours)
```

## Socket.io Events

### Emitted Events

```javascript
// When payment coordination is initialized
emit("payment-coordination-initialized", {
  groupCode,
  coordination,
  splitAmounts,
});

// When a payment status is updated
emit("payment-status-updated", {
  groupCode,
  userId,
  status,
  completionPercentage,
  overallStatus,
});

// When reminder is sent
emit("payment-reminder-sent", {
  groupCode,
  userId,
  amount,
  reminderCount,
});

// When payments are reconciled
emit("payments-reconciled", {
  groupCode,
  coordination,
});

// In-app notification
emit("payment-notification", {
  userId,
  message,
  timestamp,
});
```

### Listening Events

```javascript
socket.on("payment-status-updated", (data) => {
  // Update UI with payment status
});

socket.on("payment-reminder-sent", (data) => {
  // Show reminder notification to user
});

socket.on("payment-notification", (data) => {
  // Display in-app notification
});
```

## Payment Reminder Service

### Features

- **Automatic Scheduling**: Runs every 30 minutes to check pending payments
- **Multi-Channel Notifications**: SMS, Email, In-app
- **Configurable Intervals**: Customize reminder frequency per group order
- **Reminder Tracking**: Track reminder count and last sent time
- **Activity Logging**: Log all reminder activities

### Configuration

In GroupOrder paymentSettings:

```javascript
paymentSettings: {
  autoReminder: true,
  reminderIntervalHours: 2,  // Send reminder every 2 hours
  paymentDeadline: futureDate
}
```

### Manual Reminder

```javascript
// Send reminder to specific user
POST /api/payment-coordination/send-reminder
{
  "groupCode": "ABC123",
  "userId": "user_12345"
}
```

## Error Handling

### Payment Status Types

- **pending**: Awaiting payment
- **processing**: Payment in progress (Stripe processing)
- **completed**: Payment successful
- **failed**: Payment failed with recorded reason
- **cancelled**: Payment cancelled by user

### Coordination Status

- **initiated**: Just created
- **in-progress**: Some payments completed
- **completed**: All payments received
- **failed**: Critical failure
- **cancelled**: Settlement cancelled

## Security Considerations

1. **Authentication**: All endpoints require valid token
2. **Authorization**: Only group members can view/update their payments
3. **Stripe Security**: Use Stripe's client-side tokenization
4. **Data Validation**: Validate all input amounts
5. **Encryption**: Store sensitive payment data securely
6. **Audit Logging**: Complete activity logging for compliance

## Testing

### Manual Testing Checklist

- [ ] Create group order
- [ ] Add items as multiple members
- [ ] Finalize order and check payment coordination initialized
- [ ] View payment status in PaymentCoordinator component
- [ ] Send payment reminder (check logs)
- [ ] Complete payment via Stripe
- [ ] Verify real-time update in all connected clients
- [ ] Check activity log for accuracy
- [ ] Test reconciliation endpoint
- [ ] Verify email/SMS reminders sent (if configured)

### Unit Testing Template

```javascript
// tests/paymentCoordination.test.js
import { initializePaymentCoordination } from "./paymentCoordinationController";

describe("Payment Coordination", () => {
  test("should initialize with equal split", async () => {
    // Test implementation
  });

  test("should update payment status correctly", async () => {
    // Test implementation
  });

  test("should send reminders to pending payments", async () => {
    // Test implementation
  });
});
```

## Performance Optimization

1. **Database Indexing**: Indexed on groupCode and expiresAt
2. **Socket.io Broadcasting**: Only broadcasts to relevant group room
3. **Batch Operations**: Group updates sent together
4. **Automatic Cleanup**: 6-hour cleanup cycle for expired coordinations
5. **Caching**: Cache frequently accessed coordination data (optional)

## Monitoring & Logging

All operations are logged with:

- Timestamp
- User information
- Action details
- Error messages (if any)

View logs in:

- Server console
- MongoDB activityLog collection
- NotificationLog for delivery tracking

## Future Enhancements

1. **Payment Analytics Dashboard**: Visual analytics of payment patterns
2. **Email Provider Integration**: SendGrid/Mailgun for email reminders
3. **Push Notifications**: Mobile push notifications via Firebase
4. **Partial Payments**: Support for partial payment processing
5. **Payment Plans**: Allow payment schedules for large orders
6. **Dispute Resolution**: Built-in system for payment disputes
7. **Multi-Currency Support**: Handle international payments
8. **Webhook Verification**: Enhanced Stripe webhook security

## Troubleshooting

### Issue: Socket events not received

**Solution**: Ensure client joins group room: `socket.emit('join-group', groupCode)`

### Issue: Payments not updating in real-time

**Solution**: Check Socket.io connection and group room membership

### Issue: Reminders not sent

**Solution**: Verify Twilio credentials and autoReminder setting is true

### Issue: Failed payments not reconciling

**Solution**: Run `/api/payment-coordination/reconcile` endpoint

## Support & Maintenance

- Regular database cleanup (automatic every 6 hours)
- Monitor Socket.io connections
- Track payment success rate
- Review reminder delivery logs
- Update Stripe API version annually

---

**Last Updated**: March 4, 2026  
**Version**: 1.0.0
