# Getting Started Checklist - Real-Time Split Payment Coordination

Complete these steps in order to get your payment coordination system up and running.

## Phase 1: Preparation ⏱️ (5 minutes)

### Step 1.1: Review Documentation

- [ ] Read [QUICKSTART.md](./QUICKSTART.md) (5 min)
- [ ] Review [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) to understand the flow (optional)

### Step 1.2: Gather Required Credentials

- [ ] Stripe Secret Key (`STRIPE_SECRET_KEY`)
  - Get from: https://dashboard.stripe.com/apikeys
  - Format: `sk_test_...` or `sk_live_...`

- [ ] Twilio Credentials (optional, for SMS reminders)
  - Get from: https://www.twilio.com/console
  - Needed: Account SID, Auth Token, Phone Number

## Phase 2: Backend Setup ⏱️ (10 minutes)

### Step 2.1: Configure Environment Variables

```bash
# Navigate to backend directory
cd backend

# Add/update these in your .env file:
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLIC_KEY=pk_test_your_key_here

# Optional: Twilio for SMS reminders
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+11234567890

# Frontend URL for payment redirects
FRONTEND_URL=http://localhost:5173
```

- [ ] Added Stripe keys
- [ ] Added Twilio keys (optional)
- [ ] Added Frontend URL

### Step 2.2: Verify Dependencies

```bash
# Check if Socket.io is installed
npm list socket.io

# Check if Stripe is installed
npm list stripe

# If missing, install them:
npm install socket.io stripe
npm install twilio  # Optional
```

- [ ] All dependencies installed
- [ ] No missing packages

### Step 2.3: Verify Backend Files Exist

Check that these new backend files exist:

```
✓ backend/models/paymentCoordinationModel.js
✓ backend/controllers/paymentCoordinationController.js
✓ backend/routes/paymentCoordinationRoute.js
✓ backend/utils/paymentReminderService.js
```

- [ ] All backend files present
- [ ] File paths correct

### Step 2.4: Start Backend Server

```bash
# From backend directory
npm start
# or
node server.js
```

Look for these messages in server logs:

```
✓ DB connection successful
✓ Server Started on port: 4000
✓ [PaymentReminderService] Automatic reminders scheduled successfully
```

- [ ] Server started successfully
- [ ] Database connected
- [ ] No errors in console

## Phase 3: Frontend Setup ⏱️ (5 minutes)

### Step 3.1: Verify Component Files Exist

```
✓ frontend/src/components/PaymentCoordinator/PaymentCoordinator.jsx
✓ frontend/src/components/PaymentCoordinator/PaymentCoordinator.css
```

- [ ] Both component files present
- [ ] File paths correct

### Step 3.2: Update App.jsx Routes

Open `frontend/src/App.jsx`:

```javascript
// Add this import near the top
import PaymentCoordinator from "./components/PaymentCoordinator/PaymentCoordinator";

// Add this route in your Routes section
<Route
  path="/group-order/:groupCode/payment"
  element={<PaymentCoordinator />}
/>;
```

- [ ] Import statement added
- [ ] Route added
- [ ] Correct path

### Step 3.3: Verify Frontend Environment

```bash
# frontend/.env should have
VITE_BACKEND_URL=http://localhost:4000
```

- [ ] Backend URL configured
- [ ] Development environment working

### Step 3.4: Start Frontend Server

```bash
# From frontend directory
npm run dev
```

Look for:

```
✓ Vite running at http://localhost:5173
```

- [ ] Frontend server started
- [ ] No errors in console
- [ ] Can access localhost:5173

## Phase 4: Integration with Group Orders ⏱️ (15 minutes)

### Step 4.1: Update groupOrderController.js

Follow the detailed steps in [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md):

Key changes:

- [ ] Import `paymentCoordinationModel` and `PaymentReminderService`
- [ ] Add payment coordination initialization in `finalizeGroupOrder`
- [ ] Update `completeGroupOrder` to sync with payment coordination
- [ ] Add helper function `extractSessionId`

### Step 4.2: Test Group Order Finalization

Create a test group order:

1. Create a new group order
2. Add items from multiple members
3. Finalize the order
4. Check server logs for payment coordination creation

- [ ] Group order created
- [ ] Payment coordination initialized in logs
- [ ] No errors during finalization

### Step 4.3: Verify Payment Coordination Created

```bash
# Check MongoDB
# Collection: paymentCoordination
# Should see a document with your groupCode

# Or test via API:
curl -X POST http://localhost:4000/api/payment-coordination/status \
  -H "Content-Type: application/json" \
  -d '{"groupCode":"ABC123"}'
```

- [ ] Payment coordination document created
- [ ] Status endpoint returns data
- [ ] Payments array populated

## Phase 5: Testing ⏱️ (15 minutes)

### Step 5.1: Test Backend API Endpoints

#### 5.1.1: Initialize Payment Coordination

```bash
curl -X POST http://localhost:4000/api/payment-coordination/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "groupCode": "TEST001",
    "totalAmount": 1500,
    "splitMethod": "equal"
  }'
```

**Expected**: Success response with coordination object

- [ ] Endpoint responds
- [ ] Returns coordination data
- [ ] Payments array created

#### 5.1.2: Get Payment Status

```bash
curl -X POST http://localhost:4000/api/payment-coordination/status \
  -H "Content-Type: application/json" \
  -d '{"groupCode": "TEST001"}'
```

**Expected**: Detailed status with statistics

- [ ] Returns coordination status
- [ ] Includes statistics
- [ ] Completion percentage calculated

#### 5.1.3: Send Payment Reminder

```bash
# Get a userId from the coordination first, then:
curl -X POST http://localhost:4000/api/payment-coordination/send-reminder \
  -H "Content-Type: application/json" \
  -d '{
    "groupCode": "TEST001",
    "userId": "user_123"
  }'
```

**Expected**: Reminder sent successfully

- [ ] Endpoint responds
- [ ] Reminder count incremented
- [ ] Activity logged

### Step 5.2: Test Frontend Component

#### 5.2.1: Navigate to Payment Coordinator

1. Go to: `http://localhost:5173/group-order/TEST001/payment`
2. Wait for component to load
3. Should see payment dashboard

- [ ] Component loads
- [ ] No UI errors
- [ ] Dashboard displays

#### 5.2.2: Test Overview Tab

1. Check for summary cards
2. Verify payment progress bar
3. Check statistics display

Items to verify:

- [ ] Total amount displayed
- [ ] Progress bar shows correctly
- [ ] Statistics cards visible
- [ ] Status badge showing

#### 5.2.3: Test Members Tab

1. Click Members tab
2. Should see list of members with payment status
3. Each member shows amount and status

Items to verify:

- [ ] Member list loads
- [ ] Amounts display correctly
- [ ] Status badges color-coded
- [ ] Reminder button visible

#### 5.2.4: Test History Tab

1. Click History tab
2. Should see activity timeline
3. Each activity shows timestamp

Items to verify:

- [ ] Timeline loads
- [ ] Activities displayed
- [ ] Timestamps correct
- [ ] User names shown

#### 5.2.5: Test Manual Refresh

1. Click "Refresh Status" button
2. Dashboard should update without page reload

- [ ] Data fetches successfully
- [ ] UI updates smoothly
- [ ] No console errors

### Step 5.3: Test Real-Time Updates (Socket.io)

#### 5.3.1: Open Multiple Browser Windows

1. Open `http://localhost:5173/group-order/TEST001/payment` in 2 tabs
2. In one tab, click "Send Reminder"
3. Check if other tab updates without refresh

- [ ] Socket.io connection established
- [ ] Events received in console (check DevTools)
- [ ] Data synced across tabs

#### 5.3.2: Check Browser Console

Open DevTools Console (F12) and look for:

```
Connected to payment coordination server
Socket message: payment-status-updated
Socket message: payment-reminder-sent
```

- [ ] Socket connection messages appear
- [ ] Events logged
- [ ] No socket errors

### Step 5.4: Test Payment Status Update

1. Simulate a payment completion
2. Call update-status endpoint:

```bash
curl -X POST http://localhost:4000/api/payment-coordination/update-status \
  -H "Content-Type: application/json" \
  -d '{
    "groupCode": "TEST001",
    "userId": "user_123",
    "status": "completed",
    "transactionId": "stripe_txn_123"
  }'
```

3. Check dashboard - should update in real-time

- [ ] Status updates in database
- [ ] Socket event emitted
- [ ] Frontend reflects change
- [ ] Progress bar updates

### Step 5.5: Check Logs

Server console should show:

```
✓ [PaymentReminderService] Automatic reminders scheduled successfully
✓ Payment status updated: user_123
✓ Payment reminder sent for TEST001
✓ Socket event emitted: payment-status-updated
```

- [ ] Relevant log messages appear
- [ ] No error logs
- [ ] Scheduler running properly

## Phase 6: Production Readiness ⏱️ (10 minutes)

### Step 6.1: Security Checklist

- [ ] Environment variables not in code
- [ ] Token authentication in place
- [ ] CORS configured properly
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive info

### Step 6.2: Performance Check

- [ ] Socket.io connections stable
- [ ] API responses < 500ms
- [ ] No memory leaks (check with longer testing)
- [ ] Database queries optimized
- [ ] TTL cleanup working

### Step 6.3: MongoDB Setup

```bash
# Verify payment coordination collection has TTL index
mongosh
use food_delivery_db
db.paymentcoordinations.getIndexes()

# Should show: "expiresAt_1" with "expireAfterSeconds" : 0
```

- [ ] TTL index created
- [ ] Database optimized
- [ ] No connectivity issues

### Step 6.4: Deployment Configuration

- [ ] Update FRONTEND_URL for production
- [ ] Use production Stripe keys
- [ ] Set up Twilio credentials securely
- [ ] Configure database connection for production
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy

## Phase 7: Advanced Testing ⏱️ (optional)

### Step 7.1: Test All Split Methods

#### Test Equal Split

```bash
curl -X POST http://localhost:4000/api/payment-coordination/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "groupCode": "EQUAL001",
    "totalAmount": 3000,
    "splitMethod": "equal"
  }'
# Should split: 1000 each (if 3 members)
```

#### Test Proportional Split

```bash
curl -X POST http://localhost:4000/api/payment-coordination/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "groupCode": "PROP001",
    "totalAmount": 3000,
    "splitMethod": "proportional"
  }'
# Should split based on items ordered
```

- [ ] Equal split calculates correctly
- [ ] Proportional split accurate
- [ ] All member amounts total to overall amount

### Step 7.2: Test Reminder Scheduling

1. Wait for scheduler to run (every 30 minutes)
2. Or manually trigger via API
3. Check logs for reminder sent messages

- [ ] Scheduler triggers automatically
- [ ] Reminders sent to pending payments
- [ ] Activity log updated

### Step 7.3: Stress Test (Optional)

1. Create multiple group orders
2. Send multiple payment updates
3. Monitor performance
4. Check for race conditions

- [ ] System handles multiple coordinations
- [ ] Real-time updates keep up
- [ ] No data corruption

## ✅ Final Verification

All tests passed? Check these final items:

- [ ] Backend server running without errors
- [ ] Frontend accessible at localhost:5173
- [ ] Payment Coordinator component loads
- [ ] Payment status API working
- [ ] Real-time updates via Socket.io working
- [ ] Database operations successful
- [ ] No critical errors in logs
- [ ] Ready for user testing

## 🎯 Next Steps

**You're ready!** Here's what to do next:

1. **User Testing**: Have beta users test with real group orders
2. **Monitoring**: Set up monitoring for production metrics
3. **Documentation**: Share guides with team members
4. **Training**: Train support team on system
5. **Feedback**: Collect feedback for improvements
6. **Optimization**: Fine-tune reminder intervals based on usage

## 📞 Troubleshooting Quick Links

| Issue                 | Solution                                      |
| --------------------- | --------------------------------------------- |
| Component not loading | Check `/group-order/:groupCode/payment` route |
| No real-time updates  | Verify Socket.io connection (F12 console)     |
| API 404 errors        | Ensure backend route registered in server.js  |
| Payment amounts wrong | Check split method and items assigned         |
| Reminders not sending | Verify Twilio credentials and phone format    |
| Database errors       | Check MongoDB connection string               |

## 🎉 Success!

Once you complete all sections, your Real-Time Split Payment Coordination System is live and ready for production use!

---

**Estimated Total Time**: 60 minutes for complete setup  
**Difficulty Level**: Intermediate  
**Support**: Check documentation files for detailed guides
