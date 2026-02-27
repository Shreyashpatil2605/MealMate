import React, { useEffect, useState } from "react";
import "./List.css";
import axios from "axios";
import { toast } from "react-toastify";
import { useContext } from "react";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";

const List = ({ url }) => {
  const navigate = useNavigate();
  const { token, admin } = useContext(StoreContext);
  const [list, setList] = useState([]);

  const fetchList = async () => {
    const response = await axios.get(`${url}/api/food/list`);
    if (response.data.success) {
      setList(response.data.data);
    } else {
      toast.error("Error");
    }
  };

  const removeFood = async (foodId) => {
    const response = await axios.post(
      `${url}/api/food/remove`,
      { id: foodId },
      { headers: { token } },
    );
    await fetchList();
    if (response.data.success) {
      toast.success(response.data.message);
    } else {
      toast.error("Error");
    }
  };

  // edit description through prompt with current description
  const updateDescription = async (foodId, currentDesc) => {
    const desc = window.prompt("Enter new description:", currentDesc || "");
    if (!desc) return;
    const response = await axios.post(
      `${url}/api/food/updateDescription`,
      { id: foodId, description: desc },
      { headers: { token } },
    );
    await fetchList();
    if (response.data.success) {
      toast.success(response.data.message);
    } else {
      toast.error("Error");
    }
  };

  // show dropdown overlay with category options and return selected value or null
  const showCategoryDropdown = (currentCat) => {
    const categories = [
      "Salad",
      "Rolls",
      "Deserts",
      "Sandwich",
      "Cake",
      "Pure Veg",
      "Pasta",
      "Noodles",
    ];
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "dropdown-overlay";
      const box = document.createElement("div");
      box.className = "dropdown-menu";
      const select = document.createElement("select");
      categories.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.text = cat;
        if (cat === currentCat) opt.selected = true;
        select.appendChild(opt);
      });
      const ok = document.createElement("button");
      ok.textContent = "OK";
      const cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      box.appendChild(select);
      box.appendChild(ok);
      box.appendChild(cancel);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      ok.onclick = () => {
        resolve(select.value);
        document.body.removeChild(overlay);
      };
      cancel.onclick = () => {
        resolve(null);
        document.body.removeChild(overlay);
      };
    });
  };

  // edit category using dropdown overlay
  const updateCategory = async (foodId, currentCat) => {
    const cat = await showCategoryDropdown(currentCat);
    if (!cat) return;
    const response = await axios.post(
      `${url}/api/food/updateCategory`,
      { id: foodId, category: cat },
      { headers: { token } },
    );
    await fetchList();
    if (response.data.success) {
      toast.success(response.data.message);
    } else {
      toast.error("Error");
    }
  };

  // edit price via prompt
  const updatePrice = async (foodId, currentPrice) => {
    const priceStr = window.prompt("Enter new price:", currentPrice || "");
    if (!priceStr) return;
    const price = parseFloat(priceStr);
    if (isNaN(price)) {
      toast.error("Invalid price");
      return;
    }
    const response = await axios.post(
      `${url}/api/food/updatePrice`,
      { id: foodId, price },
      { headers: { token } },
    );
    await fetchList();
    if (response.data.success) {
      toast.success(response.data.message);
    } else {
      toast.error("Error");
    }
  };

  // update image by selecting a file and sending to backend
  const updateImage = async (foodId) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("id", foodId);
      formData.append("image", file);
      const response = await axios.post(
        `${url}/api/food/updateImage`,
        formData,
        {
          headers: { token },
        },
      );
      await fetchList();
      if (response.data.success) {
        toast.success(response.data.message);
      } else {
        toast.error("Error");
      }
    };
    input.click();
  };
  useEffect(() => {
    if (!admin && !token) {
      navigate("/");
    }
    fetchList();
  }, []);

  return (
    <div className="list add flex-col">
      <p>All Food List</p>
      <div className="list-table">
        <div className="list-table-format title">
          <b>Image</b>
          <b>Name</b>
          <b>Category</b>
          <b>Price</b>
          <b>Action</b>
        </div>
        {list.map((item, index) => {
          return (
            <div key={index} className="list-table-format">
              <img src={`${url}/images/` + item.image} alt="" />
              <p>{item.name}</p>
              <p>{item.category}</p>
              <p>₹{item.price}</p>
              <p className="cursor actions">
                <button
                  className="action-btn"
                  onClick={() => updateDescription(item._id, item.description)}
                >
                  Edit description
                </button>
                <button
                  className="action-btn"
                  onClick={() => updateCategory(item._id, item.category)}
                >
                  Edit category
                </button>
                <button
                  className="action-btn"
                  onClick={() => updatePrice(item._id, item.price)}
                >
                  Edit price
                </button>
                <button
                  className="action-btn"
                  onClick={() => updateImage(item._id)}
                >
                  Edit image
                </button>
                <button
                  className="action-btn remove"
                  onClick={() => removeFood(item._id)}
                >
                  Remove
                </button>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default List;
