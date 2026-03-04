import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { StoreContext } from "../context/StoreContext";
import io from "socket.io-client";
import "./PaymentCoordinator.css";

const PaymentCoordinator = () => {
  const { groupCode } = useParams();
  const { token, userId, userName } = useContext(StoreContext);

  const [coordination, setCoordination] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socket, setSocket] = useState(null);
  const [paymentStats, setPaymentStats] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(
      import.meta.env.VITE_BACKEND_URL || "http://localhost:4000",
    );
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to payment coordination server");
      newSocket.emit("join-group", groupCode);
    });

    newSocket.on("payment-status-updated", (data) => {
      console.log("Payment status updated:", data);
      if (data.groupCode === groupCode) {
        fetchCoordinationStatus();
      }
    });

    newSocket.on("payment-coordination-initialized", (data) => {
      if (data.groupCode === groupCode) {
        setCoordination(data.coordination);
        setPayments(data.coordination.payments || []);
      }
    });

    newSocket.on("payment-notification", (data) => {
      console.log("Payment notification:", data);
    });

    return () => {
      if (newSocket) {
        newSocket.emit("leave-group", groupCode);
        newSocket.disconnect();
      }
    };
  }, [groupCode]);

  // Fetch payment coordination status
  const fetchCoordinationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"}/api/payment-coordination/status`,
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
        setCoordination(data.data);
        setPayments(data.data.payments || []);
        setPaymentStats(data.data.stats);
        setError("");
      } else {
        setError(data.message || "Failed to fetch payment status");
      }
    } catch (err) {
      setError("Error fetching payment status: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Send payment reminder
  const sendPaymentReminder = async (targetUserId) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"}/api/payment-coordination/send-reminder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ groupCode, userId: targetUserId }),
        },
      );

      const data = await response.json();
      if (data.success) {
        alert("Reminder sent successfully!");
        fetchCoordinationStatus();
      } else {
        setError(data.message || "Failed to send reminder");
      }
    } catch (err) {
      setError("Error sending reminder: " + err.message);
    }
  };

  // Get payment breakdown
  const getPaymentBreakdown = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"}/api/payment-coordination/breakdown`,
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
        return data.data;
      }
    } catch (err) {
      setError("Error fetching breakdown: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupCode) {
      fetchCoordinationStatus();
    }
  }, [groupCode]);

  if (loading) {
    return (
      <div className="payment-coordinator-container">
        <div className="loading">Loading payment information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="payment-coordinator-container">
        <div className="error-message">{error}</div>
        <button onClick={fetchCoordinationStatus} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (!coordination) {
    return (
      <div className="payment-coordinator-container">
        <div className="no-data">No payment coordination found</div>
      </div>
    );
  }

  return (
    <div className="payment-coordinator-container">
      <div className="payment-coordinator-header">
        <h2>Group Order Payment Coordination</h2>
        <p className="group-code">Group Code: {groupCode}</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === "members" ? "active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          Member Payments
        </button>
        <button
          className={`tab-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Payment History
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="tab-content overview-tab">
          {/* Payment Summary Card */}
          <div className="payment-summary-card">
            <div className="summary-header">
              <h3>Payment Summary</h3>
              <span className={`status-badge ${coordination.status}`}>
                {coordination.status.toUpperCase()}
              </span>
            </div>

            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">Total Amount</span>
                <span className="value">
                  ₹{coordination.totalAmount.toFixed(2)}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">Completed Amount</span>
                <span className="value completed">
                  ₹{paymentStats?.completedAmount?.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">Pending Amount</span>
                <span className="value pending">
                  ₹{paymentStats?.pendingAmount?.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">Split Method</span>
                <span className="value">
                  {coordination.splitMethod?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Completion Progress */}
            <div className="progress-section">
              <div className="progress-header">
                <label>Payment Progress</label>
                <span className="percentage">
                  {paymentStats?.completionPercentage || 0}%
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${paymentStats?.completionPercentage || 0}%`,
                  }}
                ></div>
              </div>
              <div className="progress-stats">
                <span className="stat">
                  {paymentStats?.completedPayments || 0} of{" "}
                  {paymentStats?.totalPayments || 0} payments completed
                </span>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="stats-grid">
              <div className="stat-card completed">
                <div className="stat-number">
                  {paymentStats?.completedPayments || 0}
                </div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card pending">
                <div className="stat-number">
                  {paymentStats?.pendingPayments || 0}
                </div>
                <div className="stat-label">Pending</div>
              </div>
              <div className="stat-card failed">
                <div className="stat-number">
                  {paymentStats?.failedPayments || 0}
                </div>
                <div className="stat-label">Failed</div>
              </div>
              <div className="stat-card processing">
                <div className="stat-number">
                  {paymentStats?.processingPayments || 0}
                </div>
                <div className="stat-label">Processing</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="tab-content members-tab">
          <div className="members-list">
            {payments && payments.length > 0 ? (
              payments.map((payment, index) => (
                <div key={index} className={`payment-item ${payment.status}`}>
                  <div className="payment-info">
                    <div className="member-details">
                      <h4 className="member-name">{payment.userName}</h4>
                      <p className="member-email">
                        {payment.email || "No email"}
                      </p>
                    </div>
                    <div className="amount-section">
                      <span className="amount">
                        ₹{payment.amount?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  </div>

                  <div className="payment-status">
                    <span className={`status-badge ${payment.status}`}>
                      {payment.status?.toUpperCase()}
                    </span>
                    {payment.completedAt && (
                      <p className="completed-date">
                        Paid on:{" "}
                        {new Date(payment.completedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {payment.status === "pending" && (
                    <div className="payment-actions">
                      <button
                        className="reminder-button"
                        onClick={() => sendPaymentReminder(payment.userId)}
                      >
                        Send Reminder
                      </button>
                    </div>
                  )}

                  {payment.status === "failed" && (
                    <div className="failure-info">
                      <p className="failure-reason">
                        Reason: {payment.failureReason || "Unknown"}
                      </p>
                    </div>
                  )}

                  {payment.reminderCount > 0 && (
                    <p className="reminder-count">
                      Reminders sent: {payment.reminderCount}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="no-data">No payment information available</p>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="tab-content history-tab">
          <div className="history-section">
            <h3>Payment Activity Log</h3>
            {coordination.activityLog && coordination.activityLog.length > 0 ? (
              <div className="activity-timeline">
                {coordination.activityLog.map((activity, index) => (
                  <div key={index} className="timeline-item">
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <p className="activity-action">
                        <strong>{activity.action?.toUpperCase()}</strong>
                      </p>
                      <p className="activity-user">{activity.userName}</p>
                      <p className="activity-time">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                      {activity.details && (
                        <p className="activity-details">
                          Details: {JSON.stringify(activity.details)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No activity history available</p>
            )}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="refresh-section">
        <button onClick={fetchCoordinationStatus} className="refresh-button">
          Refresh Status
        </button>
      </div>
    </div>
  );
};

export default PaymentCoordinator;
