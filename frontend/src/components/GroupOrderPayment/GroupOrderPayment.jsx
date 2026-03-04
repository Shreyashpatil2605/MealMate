import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import io from "socket.io-client";
import "./GroupOrderPayment.css";

const GroupOrderPayment = () => {
  const { groupCode } = useParams();
  const { token, userId, userName } = useContext(StoreContext);

  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socket, setSocket] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(
      import.meta.env.VITE_BACKEND_URL || "http://localhost:4000",
    );
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("✅ Connected to payment service");
      newSocket.emit("join-group", groupCode);
    });

    // Real-time payment status updates from webhook
    newSocket.on("payment-status-updated", (data) => {
      console.log("💳 Payment Status Updated:", data);

      // Refresh payment status
      fetchPaymentStatus();

      // Show notification about who paid
      if (data.userId !== userId) {
        showToastMessage(`✅ ${data.userName} paid!`);
        // Show waiting message for unpaid users
        setTimeout(() => {
          showToastMessage(`⏳ Waiting for other members to pay...`);
        }, 1000);
      } else {
        // Current user paid
        showToastMessage(`✅ Payment successful! Waiting for others...`);
      }
    });

    // All payments complete - order is being placed
    newSocket.on("settlement-complete", (data) => {
      console.log("✅ Settlement Complete:", data);
      showToastMessage("🎉 All members paid! Order is being placed...");
      setTimeout(() => {
        fetchPaymentStatus();
      }, 1000);
    });

    return () => {
      if (newSocket) {
        newSocket.emit("leave-group", groupCode);
        newSocket.disconnect();
      }
    };
  }, [groupCode, userId]);

  // Show toast notification
  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  // Fetch payment status
  const fetchPaymentStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${
          import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"
        }/api/group-order/payment-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ groupCode }),
        },
      );

      const data = await response.json();
      if (data.success) {
        setPaymentStatus(data.data);
        setError("");
      } else {
        setError(data.message || "Failed to fetch payment status");
      }
    } catch (err) {
      console.error("Error fetching payment status:", err);
      setError("Error fetching payment status: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Pay Now - Create Stripe session and redirect
  const handlePayNow = async (memberId) => {
    try {
      setProcessingPayment(true);

      // Call backend to create payment session
      const response = await fetch(
        `${
          import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"
        }/api/group-order/create-payment-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            groupCode,
            userId: memberId,
          }),
        },
      );

      const data = await response.json();

      if (data.success && data.data.sessionUrl) {
        // Redirect to Stripe checkout
        showToastMessage("🔄 Redirecting to payment...");
        window.location.href = data.data.sessionUrl;
      } else {
        showToastMessage(
          `❌ Error: ${data.message || "Failed to create payment session"}`,
        );
      }
    } catch (error) {
      console.error("Error creating payment session:", error);
      showToastMessage(`❌ Error: ${error.message}`);
    } finally {
      setProcessingPayment(false);
    }
  };

  // Fetch payment status on component mount
  useEffect(() => {
    if (groupCode && token) {
      fetchPaymentStatus();
    }
  }, [groupCode, token]);

  if (loading) {
    return (
      <div className="group-payment-container">
        <div className="loading">Loading payment details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group-payment-container">
        <div className="error-message">{error}</div>
        <button onClick={fetchPaymentStatus} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (!paymentStatus) {
    return (
      <div className="group-payment-container">
        <div className="no-data">No payment information available</div>
      </div>
    );
  }

  return (
    <div className="group-payment-container">
      {/* Toast Notification */}
      {showToast && <div className="toast-notification">{toastMessage}</div>}

      <div className="payment-header">
        <h1>Group Order Payment</h1>
        <p className="group-code-display">Group: {groupCode}</p>
      </div>

      {/* Payment Progress Card */}
      <div className="payment-progress-card">
        <div className="progress-title">
          <h2>Payment Progress</h2>
          <span className="progress-percentage">
            {Math.round(
              (paymentStatus.paidCount / paymentStatus.totalMembers) * 100,
            )}
            %
          </span>
        </div>

        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{
              width: `${
                (paymentStatus.paidCount / paymentStatus.totalMembers) * 100
              }%`,
            }}
          ></div>
        </div>

        <div className="progress-text">
          {paymentStatus.paidCount} of {paymentStatus.totalMembers} members paid
        </div>

        {/* All Paid Message */}
        {paymentStatus.allPaid && (
          <div className="all-paid-banner">
            <span className="checkmark">✅</span>
            <p>All members have paid! Your order is being prepared.</p>
          </div>
        )}
      </div>

      {/* Member Payment Cards */}
      <div className="members-payment-section">
        <h3>Member Payments</h3>

        <div className="payment-cards-grid">
          {paymentStatus.payments.map((payment, index) => {
            const isMe = payment.userId === userId;
            const isPaid = payment.paid;

            return (
              <div
                key={index}
                className={`payment-card ${isPaid ? "paid" : "pending"} ${
                  isMe ? "my-payment" : ""
                }`}
              >
                {/* Card Header */}
                <div className="card-header">
                  <div className="member-info">
                    <h4 className="member-name">
                      {payment.userName}
                      {isMe && <span className="you-badge">You</span>}
                    </h4>
                    <p className="member-amount">
                      ₹{payment.amount.toFixed(2)}
                    </p>
                  </div>
                  <div
                    className={`status-badge ${isPaid ? "paid" : "pending"}`}
                  >
                    {isPaid ? "✓ Paid" : "Pending"}
                  </div>
                </div>

                {/* Card Body */}
                <div className="card-body">
                  {isMe && !isPaid ? (
                    <>
                      <div className="payment-instructions">
                        <p>Click below to pay your share securely</p>
                      </div>
                      <button
                        onClick={() => handlePayNow(payment.userId)}
                        disabled={processingPayment}
                        className="pay-now-button"
                      >
                        {processingPayment ? "⏳ Processing..." : "💳 Pay Now"}
                      </button>
                    </>
                  ) : isMe && isPaid ? (
                    <div className="paid-confirmation">
                      ✅ Payment Received!
                    </div>
                  ) : isPaid ? (
                    <div className="other-paid-confirmation">
                      ✓ Payment Received
                    </div>
                  ) : (
                    <div className="awaiting-payment">
                      ⏳ Waiting for payment...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Card */}
      <div className="payment-summary">
        <div className="summary-row">
          <span>Members:</span>
          <span>{paymentStatus.totalMembers}</span>
        </div>
        <div className="summary-row">
          <span>Paid:</span>
          <span className="paid-count">{paymentStatus.paidCount}</span>
        </div>
        <div className="summary-row">
          <span>Remaining:</span>
          <span className="remaining-count">
            {paymentStatus.totalMembers - paymentStatus.paidCount}
          </span>
        </div>

        {paymentStatus.allPaid && (
          <div className="order-status">
            <p className="success-message">
              🎉 All payments completed! Your food is being prepared.
            </p>
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="refresh-section">
        <button onClick={fetchPaymentStatus} className="refresh-button">
          🔄 Refresh Status
        </button>
      </div>
    </div>
  );
};

export default GroupOrderPayment;
