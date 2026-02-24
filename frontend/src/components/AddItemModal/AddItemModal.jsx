import React, { useContext, useState } from "react";
import "./AddItemModal.css";
import axios from "axios";
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";

const AddItemModal = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  price,
  image,
  userName,
}) => {
  const { url, addToCart } = useContext(StoreContext);
  const [currentGroupCode, setCurrentGroupCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Get current group from sessionStorage
  React.useEffect(() => {
    const groupCode = sessionStorage.getItem("currentGroupCode");
    setCurrentGroupCode(groupCode);
  }, []);

  const handleAddToPersonalCart = () => {
    // Add quantity times to personal cart
    for (let i = 0; i < quantity; i++) {
      addToCart(itemId);
    }
    toast.success(`${itemName} x${quantity} added to your cart`);
    onClose();
  };

  const handleAddToGroupOrder = async () => {
    try {
      if (!currentGroupCode) {
        toast.error("No active group");
        return;
      }

      setLoading(true);

      const response = await axios.post(url + "/api/group-order/add-item", {
        groupCode: currentGroupCode,
        userId: sessionStorage.getItem("userId"),
        userName: userName || "User",
        itemId,
        itemName,
        price,
        quantity,
        image,
        category: "Food",
      });

      if (response.data.success) {
        toast.success(`${itemName} x${quantity} added to group order`);
        onClose();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error adding to group order:", error);
      toast.error("Error adding to group order");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-close" onClick={onClose}>
          ✕
        </div>

        <div className="modal-header">
          <img src={image} alt={itemName} className="modal-item-image" />
          <div className="modal-item-info">
            <h2>{itemName}</h2>
            <p className="modal-price">${price}</p>
          </div>
        </div>

        <div className="modal-body">
          <p className="modal-question">How would you like to add this item?</p>

          {/* Quantity Selector */}
          <div className="quantity-selector">
            <label>Quantity:</label>
            <div className="qty-controls">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="qty-btn"
              >
                −
              </button>
              <span className="qty-display">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="qty-btn"
              >
                +
              </button>
            </div>
          </div>

          {/* Option 1: Personal Cart */}
          <button
            className="modal-option-btn individual"
            onClick={handleAddToPersonalCart}
            disabled={loading}
          >
            <div className="option-icon">👤</div>
            <div className="option-text">
              <h3>Add to My Cart</h3>
              <p>Only for you</p>
            </div>
            <div className="option-arrow">→</div>
          </button>

          {/* Option 2: Group Order (only if in group) */}
          {currentGroupCode ? (
            <button
              className="modal-option-btn group"
              onClick={handleAddToGroupOrder}
              disabled={loading}
            >
              <div className="option-icon">👥</div>
              <div className="option-text">
                <h3>Add to Group Order</h3>
                <p>Code: {currentGroupCode}</p>
              </div>
              <div className="option-arrow">→</div>
            </button>
          ) : (
            <div className="modal-option-disabled">
              <div className="option-icon">👥</div>
              <div className="option-text">
                <h3>Add to Group Order</h3>
                <p>Join a group first</p>
              </div>
            </div>
          )}
        </div>

        <button className="modal-cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AddItemModal;
