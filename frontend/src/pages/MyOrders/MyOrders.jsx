import React, { useContext, useEffect, useState } from "react";
import "./MyOrders.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { assets } from "../../assets/frontend_assets/assets";

const MyOrders = () => {
  const { url, token } = useContext(StoreContext);
  const [data, setData] = useState([]);

  const fetchOrders = async () => {
    const response = await axios.post(
      url + "/api/order/userorders",
      {},
      { headers: { token } },
    );
    if (response.data.success) {
      setData(response.data.data);
    }
  };

  useEffect(() => {
    if (token) {
      fetchOrders();

      // Refetch orders every 5 seconds for real-time updates
      const interval = setInterval(fetchOrders, 5000);

      // Also refetch when user comes back to the tab
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          fetchOrders();
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Cleanup
      return () => {
        clearInterval(interval);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      };
    }
  }, [token]);
  return (
    <div className="my-orders">
      <h2>Orders</h2>
      <div className="container">
        {data.length === 0 ? (
          <div className="no-orders-card">
            <p>You didn't order Yet!!</p>
          </div>
        ) : (
          data.map((order, index) => {
            return (
              <div key={index} className="my-orders-order">
                <img src={assets.parcel_icon} alt="" />
                <p>
                  {order.items.map((item, index) => {
                    if (index === order.items.length - 1) {
                      return item.name + " X " + item.quantity;
                    } else {
                      return item.name + " X " + item.quantity + ",";
                    }
                  })}
                </p>
                <p>${order.amount}.00</p>
                <p>items: {order.items.length}</p>
                <p>
                  <span>&#x25cf;</span>
                  <b> {order.status}</b>
                </p>
                <button onClick={fetchOrders}>Track Order</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MyOrders;
