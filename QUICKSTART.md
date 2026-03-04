# Quick Start Guide - Real-Time Split Payment Coordination

## 5-Minute Setup

### Step 1: Backend Environment Setup (1 min)

Add to your `.env` file:

```env
# Stripe (required)
STRIPE_SECRET_KEY=sk_test_your_key

# Twilio (optional, for SMS reminders)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Frontend URL (optional)
FRONTEND_URL=http://localhost:5173
```

### Step 2: Test Backend Endpoints (1 min)

Once your server is running, test with Postman:

```bash
# Initialize payment coordination
POST http://localhost:4000/api/payment-coordination/initialize
Content-Type: application/json

{
  "groupCode": "ABC123",
  "totalAmount": 1500,
  "splitMethod": "equal"
}
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Payment coordination initialized",
  "data": {
    "coordination": {
      /* full coordination object */
    },
    "splitAmounts": {
      "user1": 500,
      "user2": 500,
      "user3": 500
    }
  }
}
```

### Step 3: Frontend Component Setup (2 min)

In your `App.jsx` or routing file, add:

```javascript
import PaymentCoordinator from "./components/PaymentCoordinator/PaymentCoordinator";

// In your routes:
<Route
  path="/group-order/:groupCode/payment"
  element={<PaymentCoordinator />}
/>;
```

### Step 4: Test in Browser (1 min)

1. Navigate to: `http://localhost:5173/group-order/ABC123/payment`
2. You should see the Payment Coordinator dashboard
3. Click "Refresh Status" to fetch live data
4. All updates happen in real-time via Socket.io

## Full Integration Flow

### For Existing Group Orders

In your Group Order page, add a button:

```javascript
const [groupCode, setGroupCode] = useState("ABC123");

return (
  <div>
    {/* existing group order content */}
    <button
      onClick={() =>
        (window.location.href = `/group-order/${groupCode}/payment`)
      }
    >
      View Payment Status
    </button>
  </div>
);
```

### For New Orders Being Finalized

When finalizing a group order, payment coordination automatically initializes if you've integrated it with `groupOrderController.js`.

Quick integration in `finalizeGroupOrder`:

```javascript
// After calculating totals and creating individual orders:
import paymentCoordinationModel from "../models/paymentCoordinationModel.js";

const paymentCoord = new paymentCoordinationModel({
  groupCode,
  groupOrderId: groupOrder._id,
  totalAmount: grandTotal,
  splitMethod: "proportional",
  payments: groupOrder.orders.map((order) => ({
    userId: order.userId,
    userName: getMemberName(order.userId), // your logic
    amount: order.amount,
    status: "pending",
  })),
  status: "initiated",
});

await paymentCoord.save();
groupOrder.paymentCoordinationId = paymentCoord._id;
```

## All Available Features at a Glance

### Real-Time Features ✅

- Live payment status updates (WebSocket)
- Automatic completion percentage calculation
- Real-time member payment tracking
- Activity logging with timestamps

### Payment Tracking ✅

- Track pending, processing, completed, failed payments
- Stripe payment integration
- Transaction ID and receipt URL storage
- Payment failure reason logging

### Reminders ✅

- Automatic reminders every 30 minutes
- SMS reminders (Twilio)
- In-app notifications
- Email support (extensible)
- Reminder count tracking

### Analytics ✅

- Payment breakdown per member
- Statistics dashboard
- Activity timeline
- Payment history
- Settlement summary

### Security ✅

- Token-based authentication
- Group member authorization
- Amount validation
- Complete audit logging

## Common Use Cases

### Use Case 1: Check Payment Status

```javascript
const fetchStatus = async (groupCode) => {
  const response = await fetch("/api/payment-coordination/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupCode }),
  });
  return response.json();
};
```

### Use Case 2: Send Manual Reminder

```javascript
const sendReminder = async (groupCode, userId) => {
  const response = await fetch("/api/payment-coordination/send-reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupCode, userId }),
  });
  return response.json();
};
```

### Use Case 3: Update Payment Status

```javascript
const updatePayment = async (groupCode, userId, status) => {
  const response = await fetch("/api/payment-coordination/update-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      groupCode,
      userId,
      status,
      transactionId: "stripe_txn_123",
      receiptUrl: "https://...",
    }),
  });
  return response.json();
};
```

### Use Case 4: Get Payment Breakdown

```javascript
const getBreakdown = async (groupCode) => {
  const response = await fetch("/api/payment-coordination/breakdown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupCode }),
  });
  const data = await response.json();

  // Returns structured breakdown
  console.log(data.data.members); // Array of member payments
};
```

## Socket.io Real-Time Events

### Listen for Payment Updates

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:4000");

// Join group
socket.emit("join-group", "ABC123");

// Listen for payment updates
socket.on("payment-status-updated", (data) => {
  console.log(`Payment updated: ${data.completionPercentage}% complete`);
  // Refresh UI
});

socket.on("payment-notification", (data) => {
  console.log(`Notification: ${data.message}`);
  // Show toast/alert
});
```

## Troubleshooting

### Issue: Component not loading

- ✅ Check that Socket.io connection works: `console.log('connected:', socket.connected)`
- ✅ Verify `groupCode` is valid
- ✅ Check browser console for errors

### Issue: Payment status not updating

- ✅ Ensure socket joins group: `socket.emit('join-group', groupCode)`
- ✅ Check server is emitting events: Look for `payment-status-updated` in logs
- ✅ Verify API endpoint returning correct data

### Issue: Reminders not sending

- ✅ Check Twilio credentials in `.env`
- ✅ Verify phone number is in correct format (E.164)
- ✅ Check server logs for Twilio errors

### Issue: Payment amounts incorrect

- ✅ Verify `splitMethod` is correct
- ✅ Check that all items have valid prices
- ✅ Run `/api/payment-coordination/breakdown` to see breakdown

## Optional: Advanced Configuration

### Customize Reminder Interval

```javascript
// In groupOrderModel or before finalizing:
groupOrder.paymentSettings = {
  splitMethod: "equal",
  autoReminder: true,
  reminderIntervalHours: 1, // Send every hour instead of 2
  paymentDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
};
```

### Enable/Disable Auto Reminders

```javascript
groupOrder.paymentSettings.autoReminder = false; // Disable auto reminders
```

### Change Split Method

```javascript
// Equal split
splitMethod: "equal";

// Proportional (based on items)
splitMethod: "proportional";

// Custom (allow manual adjustments)
splitMethod: "custom";
```

## Performance Tips

1. **Limit Real-Time Updates**: Don't join same group multiple times
2. **Batch Reminders**: Reminders are automatically batched every 30 minutes
3. **Database Indexes**: Already optimized with TTL index on `expiresAt`
4. **Socket.io Rooms**: Each group code is a separate room to minimize broadcasts

## Testing Checklist

- [ ] Create test group order
- [ ] Navigate to `/group-order/TEST/payment`
- [ ] See empty/loading state initially
- [ ] Click "Refresh Status"
- [ ] See dashboard populated with data
- [ ] Open console and verify Socket.io events received
- [ ] Test sending reminder
- [ ] Verify reminder logged in activity
- [ ] Check real-time updates on multiple browser tabs

## Next Steps

1. **Deploy to production**: Use your deployment process
2. **Monitor reminders**: Check Twilio delivery logs
3. **Track metrics**: Monitor payment completion rate
4. **Gather feedback**: Collect user feedback on UX
5. **Optimize**: Adjust reminder intervals based on data

## Need Help?

- **Documentation**: See `PAYMENT_COORDINATION_GUIDE.md`
- **Integration Details**: See `INTEGRATION_GUIDE.md`
- **Implementation Info**: See `IMPLEMENTATION_SUMMARY.md`
- **Code**: Check individual files for comments and examples

---

**Ready to go!** 🚀 You're now equipped to handle split payments in real time.
