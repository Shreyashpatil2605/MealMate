# System Architecture & Data Flow

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Socket.io)                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐          ┌─────────────────────────┐    │
│  │ PaymentCoordinator   │◄────────►│  Socket.io Client       │    │
│  │ - Overview Tab       │  (WS)    │  - Listen Events        │    │
│  │ - Members Tab        │          │  - Emit Status Checks   │    │
│  │ - History Tab        │          │  - Auto Reconnect       │    │
│  └──────────────────────┘          └─────────────────────────┘    │
│           │                                  │                     │
│           └──────────────────┬───────────────┘                     │
│                              │                                     │
│                    REST API & Socket Events                        │
│                              │                                     │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              BACKEND (Node.js + Express + Socket.io)               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │            ROUTES (paymentCoordinationRoute.js)            │   │
│  │                                                            │   │
│  │  POST /initialize          ├─► Initialize Payment         │   │
│  │  POST /status              ├─► Get Current Status         │   │
│  │  POST /update-status       ├─► Update Payment Status      │   │
│  │  POST /send-reminder       ├─► Send Reminder             │   │
│  │  POST /history             ├─► Get History Logs          │   │
│  │  POST /breakdown           ├─► Get Member Breakdown      │   │
│  │  POST /reconcile           ├─► Reconcile with Stripe     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                               │                                    │
│                               ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │       CONTROLLERS (paymentCoordinationController.js)       │   │
│  │                                                            │   │
│  │  - Handle API requests                                   │   │
│  │  - Calculate split amounts                               │   │
│  │  - Update coordination status                            │   │
│  │  - Emit Socket.io events                                 │   │
│  │  - Verify payment integrity                              │   │
│  └────────────────────────────────────────────────────────────┘   │
│                               │                                    │
│        ┌──────────────────────┼──────────────────────┐             │
│        │                      │                      │             │
│        ▼                      ▼                      ▼             │
│   ┌────────────┐      ┌──────────────┐      ┌───────────────┐   │
│   │ Models     │      │ Controllers  │      │ Services      │   │
│   ├────────────┤      ├──────────────┤      ├───────────────┤   │
│   │ Payment    │      │ Payment      │      │ Payment       │   │
│   │ Coord.     │      │ Coordination │      │ Reminder      │   │
│   │ Model      │      │              │      │ Service       │   │
│   │            │      │ Group Order  │      │               │   │
│   │ Group      │      │ Controller   │      │ - SMS Remind  │   │
│   │ Order      │      │              │      │ - Email Rem.  │   │
│   │ Model      │      │              │      │ - In-app Not. │   │
│   │            │      │ Order Model  │      │ - Auto Sched. │   │
│   │ Order      │      │              │      │               │   │
│   │ Model      │      │              │      │               │   │
│   └────────────┘      └──────────────┘      └───────────────┘   │
│        │                      │                      │             │
│        └──────────────────────┼──────────────────────┘             │
│                               │                                    │
│                               ▼                                    │
│           ┌───────────────────────────────────┐                   │
│           │   Socket.io Event Emitter         │                   │
│           │                                   │                   │
│           │ - payment-coordination-init       │                   │
│           │ - payment-status-updated         │                   │
│           │ - payment-reminder-sent          │                   │
│           │ - payments-reconciled            │                   │
│           │ - payment-notification           │                   │
│           └──────────────┬────────────────────┘                   │
│                          │                                        │
│          ┌───────────────┴───────────────┐                       │
│          │                               │                       │
│          ▼                               ▼                       │
│  ┌──────────────────┐         ┌──────────────────┐               │
│  │ Scheduled Tasks  │         │ Broadcast to    │               │
│  │                  │         │ Socket.io Group │               │
│  │ - Reminders      │         │                  │               │
│  │   (30 min)       │         │ emit('groupCode',               │
│  │ - Cleanup        │         │  { eventData })  │               │
│  │   (6 hour)       │         └──────────────────┘               │
│  └──────────────────┘                │                           │
│                                      │                           │
└──────────────────────────────────────┼───────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │  DATABASE (MongoDB + Stripe)    │
                    ├──────────────────────────────────┤
                    │                                  │
                    │  Collections:                    │
                    │  - paymentCoordinations (TTL)   │
                    │  - groupOrders (updated)        │
                    │  - orders                       │
                    │  - users                        │
                    │                                  │
                    │  Stripe Integration:            │
                    │  - Payment Intent creation      │
                    │  - Webhook handling             │
                    │  - Payment verification         │
                    │                                  │
                    └──────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Payment Initialization Flow

```
User Finalizes Group Order
         │
         ▼
Calculate Total Amount & Split
         │
         ▼
Create Individual Orders
         │
         ▼
Create Stripe Sessions
         │
         ▼
Initialize Payment Coordination
         │
         ├─► Create coordination record
         ├─► Store split amounts per user
         ├─► Set status to "initiated"
         └─► Create payment entries (status: pending)
         │
         ▼
Emit Socket Event: "payment-coordination-initialized"
         │
         ▼
Frontend Receives Event & Shows Dashboard
         │
         ▼
User Sees Payment Amounts & Status
```

### 2. Payment Status Update Flow

```
User Completes Stripe Payment
         │
         ▼
Stripe Webhook / Client Notification
         │
         ▼
POST /api/payment-coordination/update-status
         │
         ├─► Find coordination record
         ├─► Find user's payment entry
         ├─► Update status to "completed"
         ├─► Store transaction ID & receipt
         └─► Update completion percentage
         │
         ▼
Emit Socket Event: "payment-status-updated"
         │
         ├─► Broadcast to group room
         └─► Notify all members
         │
         ▼
Update Frontend In Real-Time
         │
         (No page refresh needed!)
```

### 3. Reminder Service Flow

```
Scheduler Triggers (Every 30 minutes)
         │
         ▼
queryPaymentCoordinationModel for pending payments
         │
         ├─► Filter coordination status = "initiated" or "in-progress"
         └─► Filter payment status = "pending"
         │
         ▼
For Each Pending Payment:
         │
         ├─► Check if time since last reminder > reminderIntervalHours
         │
         ├─ YES? Send Reminders:
         │   │
         │   ├─► Send SMS (Twilio) - if phone available
         │   ├─► Send Email - if email available
         │   ├─► Send In-App notification (Socket.io)
         │   │
         │   └─► Update reminder count & lastReminderSentAt
         │
         └─ NO? Skip (too recent)
         │
         ▼
Log All Activity to activityLog & notificationLog
         │
         ▼
Emit Socket Event: "payment-reminder-sent"
         │
         ▼
User Receives Notification
```

### 4. Settlement Completion Flow

```
All Payments Complete (status = "completed")
         │
         ▼
Update Coordination Status to "completed"
         │
         ▼
Set settlementDetails:
   ├─► completedAt: now
   ├─► allPaymentsReceived: true
   └─► settlementNotes: "Settlement complete"
         │
         ▼
Update Group Order Settlement:
   ├─► settlement.completionPercentage = 100
   ├─► settlement.allPaymentsReceived = true
   └─► settlement.settlementCompletedAt = now
         │
         ▼
Emit Socket Event: "settlement-complete"
         │
         ▼
Notify All Members via In-App & Socket.io
         │
         ▼
Mark Group Order Status as "completed"
         │
         ▼
Trigger Order Processing (Chef starts cooking)
```

## Component Interaction Diagram

```
┌─────────────────────────────────────┐
│    PaymentCoordinator Component     │
│  (Frontend React Component)         │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ useEffect & Socket Listeners │  │
│  └────────┬─────────────────────┘  │
│           │                        │
│           ├─► 'payment-status-updated'
│           ├─► 'payment-notification'
│           └─► 'payment-reminder-sent'
│                                     │
│  ┌──────────────────────────────┐  │
│  │ Tabs & State Management      │  │
│  │ - overview                   │  │
│  │ - members                    │  │
│  │ - history                    │  │
│  └────────┬─────────────────────┘  │
│           │                        │
│           ├─► fetchCoordinationStatus()
│           ├─► sendPaymentReminder()
│           └─► getPaymentBreakdown()
│                                     │
│  ┌──────────────────────────────┐  │
│  │ Visual Components            │  │
│  │ - Progress Bar               │  │
│  │ - Member Cards               │  │
│  │ - Status Badges              │  │
│  │ - Activity Timeline           │  │
│  └──────────────────────────────┘  │
│                                     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   API / Socket.io Communication     │
│                                     │
│  Rest Endpoints:                    │
│  - /api/payment-coordination/*      │
│                                     │
│  Socket Events:                     │
│  - Emit: payment-status-check       │
│  - Listen: payment-status-updated   │
│                                     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  payment CoordinationController     │
│                                     │
│  - initializePaymentCoordination    │
│  - getPaymentCoordinationStatus     │
│  - updatePaymentStatus              │
│  - sendPaymentReminder              │
│  - getPaymentHistory                │
│  - getPaymentBreakdown              │
│  - reconcilePayments                │
│                                     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  PaymentCoordinationModel           │
│                                     │
│  Collections & Indexes:             │
│  - groupCode (unique)               │
│  - expiresAt (TTL index)           │
│  - payments[] (status tracking)     │
│  - activityLog[] (history)          │
│  - notificationLog[] (deliv. trk)  │
│                                     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  PaymentReminderService             │
│                                     │
│  Scheduled Tasks:                   │
│  - scheduleAutomaticReminders()     │
│  - cleanupExpiredCoordinations()    │
│                                     │
│  Notification Methods:              │
│  - sendSMSReminder() → Twilio       │
│  - sendEmailReminder() → Future     │
│  - sendInAppNotification() → S.io   │
│                                     │
└─────────────────────────────────────┘
```

## Database Schema Relationships

```
GroupOrder (1)
    │
    ├─── (1:1) ──────┬──► PaymentCoordination
    │                │
    │                └─── Members[]
    │                     ├─ userId
    │                     └─ userName
    │
    ├─── (1:N) ──────┬──► Order
    │                └─── Items[]
    │
    └─── paymentSettings
         ├─ splitMethod
         ├─ autoReminder
         └─ reminderIntervalHours


PaymentCoordination
    │
    ├─── groupCode ──────────► Unique Join Key
    │
    ├─── payments[] ─────────► Array of Payment Objects
    │    ├─ userId
    │    ├─ userName
    │    ├─ status (pending|processing|completed|failed)
    │    ├─ amount
    │    ├─ transactionId
    │    └─ completedAt
    │
    ├─── activityLog[] ──────► Timeline of events
    │    ├─ action
    │    ├─ userId
    │    ├─ timestamp
    │    └─ details
    │
    ├─── notificationLog[] ──► Notification tracking
    │    ├─ userId
    │    ├─ type (reminder|payment_confirmed|failed)
    │    ├─ delivered
    │    └─ timestamp
    │
    └─── expiresAt ─────────► TTL Index (auto-delete after 24h)
```

## Real-Time Communication Flow

```
USER A MAKES PAYMENT
         │
         ▼
POST /api/payment-coordination/update-status
    └─► Body: { groupCode: 'ABC123', userId: 'user1', status: 'completed' }
         │
         ▼
Controller Updates MongoDB
    └─► paymentCoordination.payments[0].status = 'completed'
         │
         ▼
Emit Socket Event to Group Room
    └─► io.to('ABC123').emit('payment-status-updated', {...})
         │
         ├────────────────────────┬────────────────────────┐
         ▼                        ▼                        ▼
    USER A                    USER B                   USER C
    Connected?                Connected?               Connected?
         │                        │                        │
         ├─ YES ─────┐           ├─ YES ─────┐           ├─ YES
         │           │           │           │           │
         ▼           ▼           ▼           ▼           ▼
    Receives    Stays in     Receives   Dashboard  Receives
    Update      group        Update     Updates    Update
    │           room         │                     │
    │                        │                     │
    └────────────────────────┼─────────────────────┘
                             │
                             ▼
                    ALL USERS SEE
                  INSTANT UPDATE
                  (No refresh needed!)
```

## State Machine: Payment Status

```
                    ┌─────────────┐
                    │   PENDING   │
                    └──────┬──────┘
                           │
                ┌──────────┤
                │          │
                ▼          ▼
          PROCESSING    FAILED
                │          │
                │   ┌──────┘
                │   │
                ▼   ▼
            COMPLETED  ─ (retry branch)
                │
                └───────────┐
                            │
         (Check all          ▼
          completed?)   SETTLEMENT
                       COMPLETE
```

## Error Handling Flow

```
Payment Operation Error
         │
         ├─ Validation Error?
         │  └─► Return 400 with validation message
         │
         ├─ Not Found Error?
         │  └─► Return 404 with resource not found
         │
         ├─ Stripe Error?
         │  └─► Log error, update status to "failed"
         │      └─► Notify user & emit event
         │
         ├─ Database Error?
         │  └─► Log error, return 500
         │
         └─ Unknown Error?
            └─► Log full error, return 500
                └─► Alert admin/monitoring system
```

---

This architecture ensures:
✅ **Real-time updates** via Socket.io  
✅ **Scalability** with indexed MongoDB queries  
✅ **Reliability** with comprehensive error handling  
✅ **User experience** with instant feedback  
✅ **Data integrity** with transaction tracking  
✅ **Automated operations** with scheduled services
