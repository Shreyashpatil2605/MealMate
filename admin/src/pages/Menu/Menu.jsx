import React, { useEffect, useState } from "react";
import "./Menu.css";
import axios from "axios";
import { toast } from "react-toastify";
import { useContext } from "react";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";

const Menu = ({ url }) => {
  const navigate = useNavigate();
  const { token, admin } = useContext(StoreContext);
  const [list, setList] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [image, setImage] = useState(false);
  const [data, setData] = useState({
    menu_name: "",
    displayOrder: 0,
  });

  const fetchList = async () => {
    const response = await axios.get(`${url}/api/menu/list`);
    if (response.data.success) {
      setList(response.data.data);
    } else {
      toast.error("Error fetching menu categories");
    }
  };

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("menu_name", data.menu_name);
    formData.append("displayOrder", Number(data.displayOrder));
    formData.append("image", image);

    const response = await axios.post(`${url}/api/menu/add`, formData, {
      headers: { token },
    });
    if (response.data.success) {
      setData({
        menu_name: "",
        displayOrder: 0,
      });
      setImage(false);
      setShowAddForm(false);
      toast.success(response.data.message);
      await fetchList();
    } else {
      toast.error(response.data.message);
    }
  };

  const removeMenu = async (menuId) => {
    const response = await axios.post(
      `${url}/api/menu/delete`,
      { id: menuId },
      { headers: { token } },
    );
    await fetchList();
    if (response.data.success) {
      toast.success(response.data.message);
    } else {
      toast.error("Error");
    }
  };

  const updateMenuName = async (menuId, currentName) => {
    const name = window.prompt("Enter new menu name:", currentName || "");
    if (!name) return;
    const response = await axios.post(
      `${url}/api/menu/update`,
      { id: menuId, menu_name: name, displayOrder: 0, isActive: true },
      { headers: { token } },
    );
    await fetchList();
    if (response.data.success) {
      toast.success(response.data.message);
    } else {
      toast.error("Error");
    }
  };

  const updateMenuOrder = async (menuId, currentOrder) => {
    const order = window.prompt("Enter display order:", currentOrder || "0");
    if (order === null) return;
    const orderNum = parseInt(order);
    if (isNaN(orderNum)) {
      toast.error("Invalid order number");
      return;
    }
    const response = await axios.post(
      `${url}/api/menu/update`,
      { id: menuId, displayOrder: orderNum, isActive: true },
      { headers: { token } },
    );
    await fetchList();
    if (response.data.success) {
      toast.success(response.data.message);
    } else {
      toast.error("Error");
    }
  };

  const updateMenuImage = async (menuId) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("id", menuId);
      formData.append("image", file);
      const response = await axios.post(`${url}/api/menu/update`, formData, {
        headers: { token },
      });
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
    <div className="menu add flex-col">
      <p>Menu Categories</p>
      <button
        className="add-menu-btn"
        onClick={() => setShowAddForm(!showAddForm)}
      >
        {showAddForm ? "Cancel" : "Add New Category"}
      </button>

      {showAddForm && (
        <form onSubmit={onSubmitHandler} className="add-menu-form flex-col">
          <div className="add-img-upload flex-col">
            <p>Upload image</p>
            <label htmlFor="image">
              <img
                src={
                  image
                    ? URL.createObjectURL(image)
                    : "https://via.placeholder.com/100"
                }
                alt=""
              />
            </label>
            <input
              onChange={(e) => setImage(e.target.files[0])}
              type="file"
              id="image"
              hidden
              required
            />
          </div>
          <div className="add-menu-name flex-col">
            <p>Menu name</p>
            <input
              onChange={onChangeHandler}
              value={data.menu_name}
              type="text"
              name="menu_name"
              placeholder="Enter menu name"
              required
            />
          </div>
          <div className="add-menu-order flex-col">
            <p>Display Order</p>
            <input
              onChange={onChangeHandler}
              value={data.displayOrder}
              type="number"
              name="displayOrder"
              placeholder="Display order"
              required
            />
          </div>
          <button type="submit" className="submit-btn">
            Add Category
          </button>
        </form>
      )}

      <div className="menu-list-table">
        <div className="menu-list-format title">
          <b>Image</b>
          <b>Name</b>
          <b>Display Order</b>
          <b>Action</b>
        </div>
        {list.map((item, index) => {
          return (
            <div key={index} className="menu-list-format">
              <img src={`${url}/images/` + item.menu_image} alt="" />
              <p>{item.menu_name}</p>
              <p>{item.displayOrder}</p>
              <p className="cursor actions">
                <button
                  className="action-btn"
                  onClick={() => updateMenuName(item._id, item.menu_name)}
                >
                  Edit Name
                </button>
                <button
                  className="action-btn"
                  onClick={() => updateMenuOrder(item._id, item.displayOrder)}
                >
                  Edit Order
                </button>
                <button
                  className="action-btn"
                  onClick={() => updateMenuImage(item._id)}
                >
                  Edit Image
                </button>
                <button
                  className="action-btn remove"
                  onClick={() => removeMenu(item._id)}
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

export default Menu;
