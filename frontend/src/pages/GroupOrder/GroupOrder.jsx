import React, { useState, useContext } from "react";
import "./GroupOrder.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";

const GroupOrder = () => {
  const { url } = useContext(StoreContext);

  // State for creating/joining group
  const [activeTab, setActiveTab] = useState("create");
  const [userName, setUserName] = useState("");
  const [groupCode, setGroupCode] = useState("");

  // State for group details
  const [currentGroup, setCurrentGroup] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prevMembers, setPrevMembers] = useState([]);
  const [paymentSessions, setPaymentSessions] = useState([]);

  // Create new group order
  const handleCreateGroup = async () => {
    try {
      if (!userName) {
        toast.error("Please enter your name");
        return;
      }

      const userId =
        sessionStorage.getItem("userId") ||
        "user_" + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem("userId", userId);
      setLoading(true);
      const response = await axios.post(url + "/api/group-order/create", {
        userId,
        userName,
      });

      if (response.data.success) {
        setCurrentGroup(response.data.data.groupCode);
        setGroupDetails(response.data.data.groupOrder);
        sessionStorage.setItem(
          "currentGroupCode",
          response.data.data.groupCode,
        );
        toast.success(
          "Group created! Share code: " + response.data.data.groupCode,
        );
        setUserName("");
      }
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Error creating group");
    } finally {
      setLoading(false);
    }
  };

  // Join existing group
  const handleJoinGroup = async () => {
    try {
      if (!userName || !groupCode) {
        toast.error("Please enter your name and group code");
        return;
      }

      const userId =
        sessionStorage.getItem("userId") ||
        "user_" + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem("userId", userId);
      setLoading(true);
      const response = await axios.post(url + "/api/group-order/join", {
        groupCode: groupCode.toUpperCase(),
        userId,
        userName,
      });

      if (response.data.success) {
        setCurrentGroup(groupCode.toUpperCase());
        setGroupDetails(response.data.data);
        sessionStorage.setItem("currentGroupCode", groupCode.toUpperCase());
        toast.success("Joined group successfully!");
        setUserName("");
        setGroupCode("");
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error joining group:", error);
      toast.error("Error joining group");
    } finally {
      setLoading(false);
    }
  };

  // Get group details
  const fetchGroupDetails = async () => {
    try {
      if (!currentGroup) return;

      const response = await axios.post(url + "/api/group-order/details", {
        groupCode: currentGroup,
      });

      if (response.data.success) {
        setGroupDetails(response.data.data);
        // initialize prevMembers to prevent initial join notifications
        if (
          (response.data.data.members || []).length > 0 &&
          prevMembers.length === 0
        ) {
          setPrevMembers(response.data.data.members || []);
        }
      }
    } catch (error) {
      console.error("Error fetching group details:", error);
    }
  };

  React.useEffect(() => {
    if (currentGroup) {
      fetchGroupDetails();
      const interval = setInterval(fetchGroupDetails, 3000); // Refresh every 3 seconds
      return () => clearInterval(interval);
    }
  }, [currentGroup]);

  // detect new members and show toast notification
  React.useEffect(() => {
    if (!groupDetails) return;
    const currentIds = (groupDetails.members || []).map((m) => m.userId);
    const prevIds = prevMembers.map((m) => m.userId);
    const newIds = currentIds.filter((id) => !prevIds.includes(id));
    if (prevIds.length > 0 && newIds.length > 0) {
      newIds.forEach((id) => {
        const member = groupDetails.members.find((m) => m.userId === id);
        if (member) toast.info(`${member.userName} joined the group`);
      });
      setPrevMembers(groupDetails.members || []);
    }
  }, [groupDetails]);

  // Copy share link
  const handleCopyShareLink = () => {
    const shareLink = `${window.location.origin}/group-order?code=${currentGroup}`;
    navigator.clipboard.writeText(shareLink);
    toast.success("Share link copied!");
  };

  const handleShareWhatsApp = () => {
    const shareLink = `${window.location.origin}/group-order?code=${currentGroup}`;
    const text = encodeURIComponent(`Join my group order: ${shareLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleShareSMS = () => {
    // fallback client SMS (deep link) - prefer server-side send
    const shareLink = `${window.location.origin}/group-order?code=${currentGroup}`;
    const body = encodeURIComponent(`Join my group order: ${shareLink}`);
    window.location.href = `sms:?body=${body}`;
  };

  // Send SMS via server (Twilio)
  const handleSendSmsServer = async () => {
    const phoneNumber = window.prompt(
      "Enter phone number (E.164 format, e.g. +1234567890):",
    );
    if (!phoneNumber) return;
    try {
      setLoading(true);
      const res = await axios.post(url + "/api/group-order/share-sms", {
        groupCode: currentGroup,
        phoneNumber,
        frontendUrl: window.location.origin,
      });
      if (res.data.success) {
        toast.success("SMS sent successfully");
      } else {
        toast.error(res.data.message || "Failed to send SMS");
      }
    } catch (error) {
      console.error("SMS send error:", error);
      toast.error("Error sending SMS");
    } finally {
      setLoading(false);
    }
  };

  // Finalize group and create per-user orders (split) or single-payer
  const handleFinalizeSplit = async () => {
    try {
      setLoading(true);
      const response = await axios.post(url + "/api/group-order/finalize", {
        groupCode: currentGroup,
        paymentOption: "split",
        frontendUrl: window.location.origin,
      });
      if (response.data.success) {
        toast.success("Group finalized. Payment sessions created.");
        setPaymentSessions(response.data.data.paymentSessions || []);
        setGroupDetails(response.data.data.groupOrder || groupDetails);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error finalizing split:", error);
      toast.error("Error finalizing split");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeSingle = async () => {
    try {
      // Ask which member will pay (by name)
      const payerName = window.prompt(
        "Enter the name of the person who will pay (case-sensitive):",
      );
      if (!payerName) return;
      const payer = (groupDetails.members || []).find(
        (m) => m.userName === payerName,
      );
      if (!payer) {
        toast.error("Payer not found among members");
        return;
      }
      setLoading(true);
      const response = await axios.post(url + "/api/group-order/finalize", {
        groupCode: currentGroup,
        paymentOption: "single_payer",
        payerId: payer.userId,
        frontendUrl: window.location.origin,
      });
      if (response.data.success) {
        toast.success("Group finalized. Redirecting to payment...");
        // If sessionUrl returned, open it for payer
        const sessionUrl =
          response.data.data.sessionUrl ||
          (response.data.data.groupOrder?.orders || [])[0]?.sessionUrl;
        if (sessionUrl) window.open(sessionUrl, "_blank");
        setGroupDetails(response.data.data.groupOrder || groupDetails);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error finalizing single payer:", error);
      toast.error("Error finalizing single payer");
    } finally {
      setLoading(false);
    }
  };

  if (!currentGroup) {
    return (
      <div className="group-order-container">
        <h1 className="group-order-title">👥 Group Ordering</h1>

        <div className="group-tabs">
          <button
            className={`tab-btn ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            Create Group
          </button>
          <button
            className={`tab-btn ${activeTab === "join" ? "active" : ""}`}
            onClick={() => setActiveTab("join")}
          >
            Join Group
          </button>
        </div>

        <div className="group-form">
          {activeTab === "create" ? (
            <div className="form-section">
              <h2>Create a New Group Order</h2>
              <p className="form-description">
                Create a group and invite friends to order together
              </p>
              <input
                type="text"
                placeholder="Your Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="group-input"
              />
              <button
                onClick={handleCreateGroup}
                disabled={loading}
                className="group-btn primary"
              >
                {loading ? "Creating..." : "Create Group"}
              </button>
            </div>
          ) : (
            <div className="form-section">
              <h2>Join Existing Group</h2>
              <p className="form-description">
                Enter the group code shared by your friend
              </p>
              <input
                type="text"
                placeholder="Your Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="group-input"
              />
              <input
                type="text"
                placeholder="Group Code (e.g., ABC123)"
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value.toUpperCase())}
                className="group-input"
                maxLength="6"
              />
              <button
                onClick={handleJoinGroup}
                disabled={loading}
                className="group-btn primary"
              >
                {loading ? "Joining..." : "Join Group"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Display group details
  return (
    <div className="group-order-container">
      <div className="group-header">
        <h1>Group Order: {currentGroup}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="copy-btn" onClick={handleCopyShareLink}>
            📋 Copy Share Link
          </button>
          <button className="copy-btn" onClick={handleShareWhatsApp}>
            📲 WhatsApp
          </button>
          <button className="copy-btn" onClick={handleSendSmsServer}>
            ✉️ SMS (Send)
          </button>
        </div>
      </div>

      <div className="group-content">
        {/* Members Section */}
        <div className="group-section members-section">
          <h2>👥 Members ({groupDetails?.memberCount || 0})</h2>
          <div className="members-list">
            {groupDetails?.members?.map((member, index) => (
              <div key={index} className="member-card">
                <span className="member-name">{member.userName}</span>
                <span className="member-badge">Joined</span>
              </div>
            ))}
          </div>
        </div>

        {/* Items by User Section */}
        <div className="group-section items-section">
          <h2>🍔 Items Added ({groupDetails?.itemCount || 0})</h2>
          {groupDetails?.itemCount === 0 ? (
            <p className="empty-message">
              No items added yet. Start adding items!
            </p>
          ) : (
            <div className="items-by-user">
              {groupDetails?.splitByUser?.map((userOrder, index) => (
                <div key={index} className="user-items-card">
                  <div className="user-header">
                    <h3>{userOrder.userName}'s Order</h3>
                    <span className="user-subtotal">₹{userOrder.subtotal}</span>
                  </div>
                  <div className="items-list">
                    {userOrder.items.map((item, idx) => (
                      <div key={idx} className="item-row">
                        <span className="item-name">{item.itemName}</span>
                        <span className="item-qty">x{item.quantity}</span>
                        <span className="item-price">₹{item.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bill Split Section */}
        <div className="group-section split-section">
          <h2>💰 Bill Split</h2>
          <div className="split-summary">
            <div className="split-row total-row">
              <span>Grand Total:</span>
              <span className="total-amount">₹{groupDetails?.grandTotal}</span>
            </div>
            {groupDetails?.memberCount > 0 && (
              <div className="split-row average-row">
                <span>Per Person (Average):</span>
                <span className="average-amount">
                  ₹
                  {(
                    groupDetails?.grandTotal / groupDetails?.memberCount
                  ).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Sessions (after finalize) */}
        {paymentSessions && paymentSessions.length > 0 && (
          <div className="group-section payments-section">
            <h2>🔗 Payment Links</h2>
            <div className="payments-list">
              {paymentSessions.map((s) => (
                <div key={s.userId} className="payment-row">
                  <span className="payment-user">{s.userName}</span>
                  <span className="payment-amount">₹{s.amount}</span>
                  {s.sessionUrl ? (
                    <div className="payment-actions">
                      <a
                        href={s.sessionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="link-btn"
                      >
                        Pay
                      </a>
                      <button
                        className="link-btn"
                        onClick={() =>
                          window.open(
                            `https://wa.me/?text=${encodeURIComponent("Pay here: " + s.sessionUrl)}`,
                          )
                        }
                      >
                        WhatsApp
                      </button>
                    </div>
                  ) : (
                    <span className="no-link">No payment link</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="group-actions">
          <button
            className="action-btn primary"
            onClick={() => (window.location.href = "/cart")}
          >
            Add Items to Cart & Order
          </button>
          <button
            className="action-btn secondary"
            onClick={() => setCurrentGroup(null)}
          >
            Leave Group
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupOrder;
