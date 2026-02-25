import React, {
  useState,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import "./GroupOrder.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";

// Memoized helper function to calculate totals from items
const calculateTotals = (items) => {
  const splitByUser = {};
  let grandTotal = 0;

  if (items && items.length > 0) {
    items.forEach((item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      const itemTotal = price * quantity;

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
        quantity: quantity,
        price: price,
        total: itemTotal,
      });
    });
  }

  const splitData = Object.entries(splitByUser).map(([userId, data]) => ({
    userId,
    userName: data.userName,
    subtotal: Math.round(data.total * 100) / 100,
    items: data.items,
  }));

  return {
    grandTotal: Math.round(grandTotal * 100) / 100,
    splitByUser: splitData,
  };
};

const GroupOrder = () => {
  const { url, food_list } = useContext(StoreContext);

  // Memoized helper function to get full image URL
  const getImageUrl = useCallback(
    (image) => {
      if (!image) return "";
      if (image.startsWith("http")) return image;
      return url + "/images/" + image;
    },
    [url],
  );

  // State for creating/joining group
  const [activeTab, setActiveTab] = useState("create");
  const [userName, setUserName] = useState("");
  const [groupCode, setGroupCode] = useState("");

  // State for food browsing in group order
  const [browseTab, setBrowseTab] = useState("browse");
  const [category, setCategory] = useState("All");

  // State for group details
  const [currentGroup, setCurrentGroup] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prevMembers, setPrevMembers] = useState([]);
  const [paymentSessions, setPaymentSessions] = useState([]);
  const [twilioConfigured, setTwilioConfigured] = useState(true);
  const [showQRCode, setShowQRCode] = useState(false);

  // Socket reference
  const socketRef = useRef(null);

  // Check Twilio configuration on mount
  useEffect(() => {
    const checkTwilioConfig = async () => {
      try {
        const res = await axios.get(url + "/api/group-order/check-twilio");
        if (res.data.success) {
          setTwilioConfigured(res.data.configured);
        }
      } catch (error) {
        console.error("Error checking Twilio config:", error);
        setTwilioConfigured(false);
      }
    };
    checkTwilioConfig();
  }, [url]);

  // Get current user ID
  const getUserId = () => {
    return sessionStorage.getItem("userId") || "";
  };

  // Get user's name from group
  const getCurrentUserName = () => {
    if (!groupDetails || !getUserId()) return "";
    const member = groupDetails.members?.find((m) => m.userId === getUserId());
    return member?.userName || "";
  };

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io("http://localhost:4000");

    socketRef.current.on("connect", () => {
      console.log("Connected to socket server");
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Auto-join from URL parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setActiveTab("join");
      setGroupCode(code.toUpperCase());
    }
  }, []);

  // Auto-restore group session from sessionStorage on mount
  useEffect(() => {
    const restoreGroupSession = async () => {
      const savedGroupCode = sessionStorage.getItem("currentGroupCode");
      const savedUserId = sessionStorage.getItem("userId");

      if (savedGroupCode && savedUserId) {
        try {
          setLoading(true);
          const response = await axios.post(url + "/api/group-order/details", {
            groupCode: savedGroupCode,
          });

          if (response.data.success) {
            const isMember = response.data.data.members?.some(
              (m) => m.userId === savedUserId,
            );
            if (isMember || response.data.data.status === "active") {
              setCurrentGroup(savedGroupCode);
              setGroupDetails(response.data.data);
              setPrevMembers(response.data.data.members || []);
              toast.info(`Restored group session: ${savedGroupCode}`);
            } else {
              sessionStorage.removeItem("currentGroupCode");
              sessionStorage.removeItem("userId");
            }
          } else {
            sessionStorage.removeItem("currentGroupCode");
          }
        } catch (error) {
          console.error("Error restoring group session:", error);
          sessionStorage.removeItem("currentGroupCode");
        } finally {
          setLoading(false);
        }
      }
    };

    restoreGroupSession();
  }, [url]);

  // Helper functions
  const getMyItems = useCallback(() => {
    if (!groupDetails || !getUserId()) return [];
    return (
      groupDetails.items?.filter((item) => item.userId === getUserId()) || []
    );
  }, [groupDetails]);

  // Memoized values - ALWAYS call these before any conditional returns
  const myItems = useMemo(() => getMyItems(), [getMyItems, groupDetails]);
  const myTotal = useMemo(
    () =>
      myItems.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0,
      ),
    [myItems],
  );

  const totalsData = useMemo(() => {
    if (groupDetails?.grandTotal) {
      return {
        grandTotal: groupDetails.grandTotal,
        splitByUser: groupDetails.splitByUser,
      };
    }
    return calculateTotals(groupDetails?.items || []);
  }, [
    groupDetails?.grandTotal,
    groupDetails?.splitByUser,
    groupDetails?.items,
  ]);

  const grandTotal = totalsData.grandTotal;
  const splitByUser = totalsData.splitByUser;

  // Memoize categories
  const categories = useMemo(
    () => ["All", ...new Set(food_list.map((item) => item.category))],
    [food_list],
  );

  // Memoize filtered food list
  const filteredFoodList = useMemo(
    () =>
      category === "All"
        ? food_list
        : food_list.filter((item) => item.category === category),
    [food_list, category],
  );

  // Set up socket listeners when currentGroup changes
  useEffect(() => {
    if (!currentGroup || !socketRef.current) return;

    const socket = socketRef.current;

    socket.emit("join-group", currentGroup);

    socket.on("member-joined", (data) => {
      if (data.groupCode === currentGroup) {
        setGroupDetails((prev) => ({
          ...prev,
          members: data.members,
          memberCount: data.members.length,
        }));

        const currentIds = prevMembers.map((m) => m.userId);
        if (
          prevMembers.length > 0 &&
          !currentIds.includes(data.member.userId)
        ) {
          toast.info(`${data.member.userName} joined the group`);
        }
        setPrevMembers(data.members);
      }
    });

    socket.on("item-added", (data) => {
      if (data.groupCode === currentGroup) {
        const { grandTotal, splitByUser } = calculateTotals(data.items);
        setGroupDetails((prev) => ({
          ...prev,
          items: data.items,
          members: data.members,
          itemCount: data.items.length,
          grandTotal: grandTotal,
          splitByUser: splitByUser,
        }));
      }
    });

    socket.on("item-removed", (data) => {
      if (data.groupCode === currentGroup) {
        const { grandTotal, splitByUser } = calculateTotals(data.items);
        setGroupDetails((prev) => ({
          ...prev,
          items: data.items,
          itemCount: data.items.length,
          grandTotal: grandTotal,
          splitByUser: splitByUser,
        }));
      }
    });

    socket.on("member-left", (data) => {
      if (data.groupCode === currentGroup) {
        const { grandTotal, splitByUser } = calculateTotals(data.items);
        setGroupDetails((prev) => ({
          ...prev,
          members: data.members,
          items: data.items,
          memberCount: data.members.length,
          status: data.status,
          grandTotal: grandTotal,
          splitByUser: splitByUser,
        }));
        if (data.members.length > 0) {
          setPrevMembers(data.members);
        }
      }
    });

    socket.on("group-finalized", (data) => {
      if (data.groupCode === currentGroup) {
        setGroupDetails((prev) => ({
          ...prev,
          status: data.status,
          ...(data.groupOrder || {}),
        }));
        if (data.paymentSessions) {
          setPaymentSessions(data.paymentSessions);
        }
        toast.success("Group order has been finalized!");
      }
    });

    fetchGroupDetails();

    return () => {
      socket.off("member-joined");
      socket.off("item-added");
      socket.off("item-removed");
      socket.off("member-left");
      socket.off("group-finalized");
      socket.emit("leave-group", currentGroup);
    };
  }, [currentGroup]);

  // detect new members and show toast notification
  useEffect(() => {
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

  // Create new group order
  const handleCreateGroup = async () => {
    try {
      if (!userName) {
        toast.error("Please enter your name");
        return;
      }

      const userId =
        getUserId() || "user_" + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem("userId", userId);
      setLoading(true);
      const response = await axios.post(url + "/api/group-order/create", {
        userId,
        userName,
      });

      if (response.data.success) {
        setCurrentGroup(response.data.data.groupCode);
        setGroupDetails(response.data.data.groupOrder);
        setPrevMembers(response.data.data.groupOrder.members || []);
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
        getUserId() || "user_" + Math.random().toString(36).substr(2, 9);
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
        setPrevMembers(response.data.data.members || []);
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

  // Add item to group order
  const handleAddToGroupCart = async (item) => {
    try {
      const userId = getUserId();
      const currentUserName = getCurrentUserName();

      if (!userId || !currentUserName) {
        toast.error("Please refresh and rejoin the group");
        return;
      }

      setLoading(true);
      const response = await axios.post(url + "/api/group-order/add-item", {
        groupCode: currentGroup,
        userId,
        userName: currentUserName,
        itemId: item._id,
        itemName: item.name,
        price: Number(item.price),
        quantity: 1,
        image: item.image,
        category: item.category,
      });

      if (response.data.success) {
        toast.success(`Added ${item.name} to your order!`);
        fetchGroupDetails();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Error adding item");
    } finally {
      setLoading(false);
    }
  };

  // Update item quantity in group order
  const handleUpdateQuantity = async (itemId, itemName, newQuantity) => {
    try {
      const userId = getUserId();
      if (!userId) {
        toast.error("Please refresh and rejoin the group");
        return;
      }

      if (newQuantity < 1) {
        return handleRemoveFromGroupCart(itemId, itemName);
      }

      setLoading(true);
      const response = await axios.post(
        url + "/api/group-order/update-quantity",
        {
          groupCode: currentGroup,
          userId,
          itemId,
          quantity: newQuantity,
        },
      );

      if (response.data.success) {
        toast.success(`Updated ${itemName} quantity to ${newQuantity}`);
        fetchGroupDetails();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      toast.error("Error updating quantity");
    } finally {
      setLoading(false);
    }
  };

  // Remove item from group order
  const handleRemoveFromGroupCart = async (itemId, itemName) => {
    try {
      const userId = getUserId();
      if (!userId) {
        toast.error("Please refresh and rejoin the group");
        return;
      }

      setLoading(true);
      const response = await axios.post(url + "/api/group-order/remove-item", {
        groupCode: currentGroup,
        userId,
        itemId,
      });

      if (response.data.success) {
        toast.success(`Removed ${itemName} from your order`);
        fetchGroupDetails();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error removing item:", error);
      toast.error("Error removing item");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to generate avatar from name
  const getAvatar = (name) => {
    if (!name) return "?";
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    return initials || name[0].toUpperCase();
  };

  // Helper function to format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

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

  // Send SMS via server (Twilio) - only shown when Twilio is configured
  const handleSendSmsServer = async () => {
    if (!twilioConfigured) {
      toast.info(
        "SMS service is not available. Please use another sharing method.",
      );
      return;
    }

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
        toast.success("SMS sent successfully!");
      } else {
        toast.error(res.data.message || "Failed to send SMS");
      }
    } catch (error) {
      console.error("SMS send error:", error);
      toast.error(
        "Error sending SMS. Please try again or use another sharing method.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Finalize group and create per-user orders (split)
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

  // Conditional render - NOW all hooks are called before this
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

  // QR Code Modal
  const QRCodeModal = () => {
    if (!showQRCode) return null;

    const shareLink = `${window.location.origin}/group-order?code=${currentGroup}`;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
        onClick={() => setShowQRCode(false)}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            padding: "32px",
            textAlign: "center",
            maxWidth: "400px",
            width: "90%",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ marginTop: 0, color: "#333" }}>Scan to Join Group</h2>
          <p style={{ color: "#666", marginBottom: "24px" }}>
            People sitting together can scan this QR code to join your group
            order!
          </p>
          <div
            style={{
              padding: "16px",
              backgroundColor: "#fff",
              borderRadius: "12px",
              display: "inline-block",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <QRCodeSVG
              value={shareLink}
              size={200}
              level={"H"}
              includeMargin={true}
              style={{ display: "block" }}
            />
          </div>
          <p
            style={{
              marginTop: "16px",
              color: "#22c55e",
              fontWeight: "bold",
              fontSize: "18px",
            }}
          >
            Code: {currentGroup}
          </p>
          <button
            onClick={() => setShowQRCode(false)}
            style={{
              marginTop: "24px",
              padding: "12px 32px",
              backgroundColor: "#22c55e",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="group-order-container">
      <QRCodeModal />
      <div className="group-header">
        <h1>Group Order: {currentGroup}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="copy-btn" onClick={() => setShowQRCode(true)}>
            📱 QR Code
          </button>
          <button className="copy-btn" onClick={handleCopyShareLink}>
            📋 Copy Link
          </button>
          <button className="copy-btn" onClick={handleShareWhatsApp}>
            📲 WhatsApp
          </button>
          {twilioConfigured && (
            <button className="copy-btn" onClick={handleSendSmsServer}>
              ✉️ SMS
            </button>
          )}
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
                {member.isHost && <span className="host-badge">Host</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Food Browse / My Items Tabs */}
        <div className="group-section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h2>🍔 Add Items to Group Order</h2>
            <div className="group-tabs" style={{ marginBottom: 0 }}>
              <button
                className={`tab-btn ${browseTab === "browse" ? "active" : ""}`}
                onClick={() => setBrowseTab("browse")}
              >
                Browse Menu
              </button>
              <button
                className={`tab-btn ${browseTab === "myitems" ? "active" : ""}`}
                onClick={() => setBrowseTab("myitems")}
              >
                My Cart ({myItems.length})
              </button>
            </div>
          </div>

          {browseTab === "browse" ? (
            <>
              {/* Category Filter */}
              <div
                className="category-filter"
                style={{
                  marginBottom: "20px",
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`tab-btn ${category === cat ? "active" : ""}`}
                    onClick={() => setCategory(cat)}
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Food Grid */}
              <div
                className="food-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "16px",
                }}
              >
                {filteredFoodList.map((item) => (
                  <div
                    key={item._id}
                    className="food-card"
                    style={{
                      background: "rgba(50,50,50,0.6)",
                      borderRadius: "12px",
                      padding: "12px",
                      border: "1px solid rgba(34,197,94,0.2)",
                    }}
                  >
                    <img
                      src={getImageUrl(item.image)}
                      alt={item.name}
                      style={{
                        width: "100%",
                        height: "120px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                    <h4 style={{ margin: "8px 0 4px", color: "#fff" }}>
                      {item.name}
                    </h4>
                    <p
                      style={{
                        color: "#22c55e",
                        fontWeight: "bold",
                        margin: "0 0 8px",
                      }}
                    >
                      ₹{item.price}
                    </p>
                    <button
                      onClick={() => handleAddToGroupCart(item)}
                      disabled={loading}
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "linear-gradient(135deg, #22c55e, #16a34a)",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "600",
                      }}
                    >
                      + Add to My Cart
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* My Items Section */
            <div className="my-items-section">
              {myItems.length === 0 ? (
                <p className="empty-message">
                  You haven't added any items yet. Go to "Browse Menu" to add
                  items!
                </p>
              ) : (
                <div
                  className="my-items-card"
                  style={{
                    background: "rgba(34,197,94,0.1)",
                    borderRadius: "12px",
                    padding: "20px",
                    border: "1px solid rgba(34,197,94,0.3)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <h3 style={{ margin: 0, color: "#22c55e" }}>My Cart</h3>
                    <span
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color: "#22c55e",
                      }}
                    >
                      ₹{myTotal}
                    </span>
                  </div>
                  {myItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 0",
                        borderBottom: "1px solid rgba(34,197,94,0.1)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <img
                          src={getImageUrl(item.image)}
                          alt={item.itemName}
                          style={{
                            width: "50px",
                            height: "50px",
                            objectFit: "cover",
                            borderRadius: "6px",
                          }}
                        />
                        <div>
                          <p
                            style={{
                              margin: 0,
                              color: "#fff",
                              fontWeight: "600",
                            }}
                          >
                            {item.itemName}
                          </p>
                          <p
                            style={{
                              margin: 0,
                              color: "#999",
                              fontSize: "13px",
                            }}
                          >
                            ₹{item.price} x {item.quantity}
                          </p>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <span style={{ color: "#22c55e", fontWeight: "bold" }}>
                          ₹{Number(item.price) * Number(item.quantity)}
                        </span>
                        <button
                          onClick={() =>
                            handleRemoveFromGroupCart(
                              item.itemId,
                              item.itemName,
                            )
                          }
                          style={{
                            padding: "6px 12px",
                            background: "rgba(239,68,68,0.2)",
                            color: "#ef4444",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: "16px", textAlign: "center" }}>
                    <p style={{ margin: 0, color: "#999" }}>
                      Your total:{" "}
                      <span
                        style={{
                          color: "#22c55e",
                          fontWeight: "bold",
                          fontSize: "18px",
                        }}
                      >
                        ₹{myTotal}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Items by User Section - NO IMAGES */}
        <div className="group-section items-section">
          <h2>📋 All Members' Items ({groupDetails?.itemCount || 0})</h2>
          {groupDetails?.itemCount === 0 ? (
            <p className="empty-message">
              No items added yet. Members can add items using the menu above!
            </p>
          ) : (
            <div className="items-by-user">
              {splitByUser && splitByUser.length > 0 ? (
                splitByUser.map((userOrder, index) => (
                  <div key={index} className="user-items-card">
                    <div
                      className="user-header"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, #${Math.abs(userOrder.userName?.charCodeAt(0) || 0) % 360}, #${Math.abs(userOrder.userName?.charCodeAt(1) || 0) % 360})`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: "bold",
                          fontSize: "14px",
                        }}
                      >
                        {getAvatar(userOrder.userName)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0 }}>
                          {userOrder.userName}
                          {userOrder.userId === getUserId() && (
                            <span
                              style={{
                                marginLeft: "8px",
                                fontSize: "12px",
                                background: "#22c55e",
                                color: "white",
                                padding: "2px 8px",
                                borderRadius: "4px",
                              }}
                            >
                              You
                            </span>
                          )}
                        </h3>
                      </div>
                      <span className="user-subtotal">
                        ₹{userOrder.subtotal}
                      </span>
                    </div>
                    <div className="items-list">
                      {userOrder.items &&
                        userOrder.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="item-row"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "10px",
                              borderBottom: "1px solid rgba(255,255,255,0.1)",
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span
                                  className="item-name"
                                  style={{ fontWeight: "600", color: "#fff" }}
                                >
                                  {item.itemName}
                                </span>
                                <span
                                  className="item-price"
                                  style={{
                                    color: "#22c55e",
                                    fontWeight: "bold",
                                  }}
                                >
                                  ₹{item.total}
                                </span>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginTop: "4px",
                                }}
                              >
                                <span
                                  style={{ fontSize: "11px", color: "#888" }}
                                >
                                  {formatTime(item.addedAt)}
                                </span>
                                {userOrder.userId === getUserId() ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                    }}
                                  >
                                    <button
                                      onClick={() =>
                                        handleUpdateQuantity(
                                          item.itemId,
                                          item.itemName,
                                          item.quantity - 1,
                                        )
                                      }
                                      style={{
                                        width: "24px",
                                        height: "24px",
                                        borderRadius: "4px",
                                        border: "1px solid #22c55e",
                                        background: "transparent",
                                        color: "#22c55e",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      -
                                    </button>
                                    <span
                                      style={{
                                        minWidth: "20px",
                                        textAlign: "center",
                                        color: "#fff",
                                      }}
                                    >
                                      x{item.quantity}
                                    </span>
                                    <button
                                      onClick={() =>
                                        handleUpdateQuantity(
                                          item.itemId,
                                          item.itemName,
                                          item.quantity + 1,
                                        )
                                      }
                                      style={{
                                        width: "24px",
                                        height: "24px",
                                        borderRadius: "4px",
                                        border: "1px solid #22c55e",
                                        background: "#22c55e",
                                        color: "#fff",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      +
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleRemoveFromGroupCart(
                                          item.itemId,
                                          item.itemName,
                                        )
                                      }
                                      style={{
                                        marginLeft: "8px",
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                        border: "none",
                                        background: "rgba(239,68,68,0.2)",
                                        color: "#ef4444",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    className="item-qty"
                                    style={{ color: "#999" }}
                                  >
                                    x{item.quantity}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-message">No items to display</p>
              )}
            </div>
          )}
        </div>

        {/* Bill Split Section */}
        <div className="group-section split-section">
          <h2>💰 Bill Split</h2>
          {grandTotal > 0 ? (
            <div className="split-summary">
              <div className="split-row total-row">
                <span>Grand Total:</span>
                <span className="total-amount">₹{grandTotal}</span>
              </div>
              {groupDetails?.memberCount > 0 && (
                <div className="split-row average-row">
                  <span>Per Person (Average):</span>
                  <span className="average-amount">
                    ₹{(grandTotal / groupDetails.memberCount).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="empty-message">Add items to see the bill split</p>
          )}
        </div>

        {/* Payment Sessions (after finalize) */}
        {paymentSessions && paymentSessions.length > 0 && (
          <div className="group-section payments-section">
            <h2>🔗 Payment Links</h2>
            <div className="payments-list">
              {paymentSessions.map((s) => (
                <div
                  key={s.userId}
                  className="payment-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span className="payment-user">
                      {s.userName}
                      {s.userId === getUserId() && (
                        <span
                          style={{
                            marginLeft: "8px",
                            fontSize: "11px",
                            background: "#22c55e",
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          You
                        </span>
                      )}
                    </span>
                    <span
                      className="payment-amount"
                      style={{ fontWeight: "bold", color: "#fff" }}
                    >
                      ₹{s.amount}
                    </span>
                  </div>
                  {s.sessionUrl ? (
                    <button
                      onClick={() => window.open(s.sessionUrl, "_blank")}
                      className="pay-now-btn"
                      style={{
                        padding: "10px 20px",
                        background: "linear-gradient(135deg, #22c55e, #16a34a)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "14px",
                        boxShadow:
                          "0 0 15px rgba(34, 197, 94, 0.6), 0 0 30px rgba(34, 197, 94, 0.3)",
                      }}
                    >
                      Pay Now
                    </button>
                  ) : (
                    <span className="no-link">No link</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="group-actions">
          <button className="action-btn primary" onClick={handleFinalizeSplit}>
            Finalize & Pay (Split)
          </button>
          <button
            className="action-btn secondary"
            onClick={handleFinalizeSingle}
          >
            Finalize (One Pays All)
          </button>
          <button
            className="action-btn secondary"
            onClick={() => {
              setCurrentGroup(null);
              sessionStorage.removeItem("currentGroupCode");
            }}
          >
            Leave Group
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupOrder;
